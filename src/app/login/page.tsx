"use client";

// M01.F04.I03 — 账号密码登录（独立布局：登录页绕过 AppShell）
//
// 提交：调 authLogin（orval 1:1 端点函数）；成功后写 tenant-context session；
// 失败：toast.error（sonner）。
//
// SSO 返回（OAuth 2.0 授权码模式，RFC 6749）：URL 带 ?code=&redirect_uri=&state=
// （lab RP 经 /api/auth/sso/authorize 领 code 后跳来）。saas 认证资源所有者后，
// 302 redirect_uri?code&state（§4.1.2）原样透传给 RP。
// 旧 ?token= 捷径（?redirect=&state= 把 JWT 放 URL）已删除：与 lab-* 子仓的
// OAuth 2.0 code 流不匹配 + JWT 泄漏到 referer/log。

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import { useTenant } from "@/state/tenant-context";
import { getApiMode, getSelectedBackend } from "@/api/backend-config";
import { BackendBadge } from "@/components/app/backend-badge";
import { useSessionsLogin } from "@/api/endpoints/auth/auth";
import type { LoginResponse } from "@/api/endpoints.schemas";
// 2026-09-11 ④（E2E REQ-2026-006）：补 OAuth 跳板分支，authorize 走真源
// （此前 nextjs 缺 onSubmit 跳板分支——带 ?redirect_uri=&client_id= 登录后落
//  /tenants 而非回跳 RP，react/vue 均有此分支，parity 分歧由 E2E 抓出）
import { useOAuthAuthorize } from "@/api/endpoints/oauth/oauth";
import { toApiError } from "@/api/http-client";
import { toast } from "sonner";

const DEMO_ACCOUNTS = [
  { username: "alice", tenant: "ACME Corp" },
  { username: "bob", tenant: "ACME Corp" },
  { username: "dave", tenant: "Globex Industries" },
  { username: "eve", tenant: "Initech" },
];

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();
  const { login } = useTenant();
  const apiMode = getApiMode();
  const [submitting, setSubmitting] = useState(false);
  // IdP 流程钉死同源：登录页是 IdP 自己的页面，登录 + authorize 必须打到与
  // 页面同源的后端。此前走全局拦截器 baseURL（读 localStorage 切换器）——dev
  // 把切换器留在 msw/springboot 时，authorize 领的 code 落在别家后端内存里，
  // lab RP 拿去自己配对的 saas 换 token 必 INVALID_GRANT「code 不存在或已被使用」。
  // 拦截器只在 config.baseURL 为空时才覆盖，这里显式给值即绕开切换器。
  const idpAxios = useMemo(() => ({ axios: { baseURL: window.location.origin } }), []);
  const loginMut = useSessionsLogin(idpAxios);
  const authorizeMut = useOAuthAuthorize(idpAxios);

  // B 方案（2026-09-11，对齐 vue 基准）：clientId 取 ?client_id= ?? env
  // （NEXT_PUBLIC_LOGIN_CLIENT_ID，值 = saas-console 自身应用）；缺即拒，不猜。
  const loginClientId = useMemo(() => {
    if (typeof window === "undefined") return "";
    const fromUrl = new URLSearchParams(window.location.search).get("client_id");
    if (fromUrl) return fromUrl;
    const fromEnv = (process.env.NEXT_PUBLIC_LOGIN_CLIENT_ID ?? "").trim();
    if (fromEnv) return fromEnv;
    return "";
  }, []);
  // RFC 6749 §4.1.1 授权码范式：lab 后端（confidential client）已替浏览器领到 code，
  // saas 登录页只负责认证资源所有者，成功后 302 redirect_uri?code&state（§4.1.2）。
  const [oauthReturn, setOauthReturn] = useState<{
    redirectUri: string;
    code: string;
    state: string;
  } | null>(null);

  // 解析 OAuth 2.0 authorize 回跳：?code=&redirect_uri=&state=
  // 用 window.location.search 直接读，不依赖 useSearchParams 的 Suspense 时序。
  // 旧 ?redirect=&state= 捷径已删 — 不再解析（与 lab-* 子仓 OAuth code 流一致）。
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const oauthCode = sp.get("code");
    const oauthRedirect = sp.get("redirect_uri");
    if (oauthCode && oauthRedirect) {
      setOauthReturn({ redirectUri: oauthRedirect, code: oauthCode, state: sp.get("state") ?? "" });
    }
  }, []);

  // RFC 6749 §4.1.2：授权码回跳不依赖 onSubmit —— 资源所有者已登录（saas session
  // 已在）时无需再认证，解析出 code+redirect_uri 即刻回跳。否则已登录用户落在
  // 登录页没表单可提交，code 永远回不到 RP（RequireAuth 已放行本页渲染）。
  useEffect(() => {
    if (!oauthReturn || typeof window === "undefined") return;
    try {
      const target = new URL(oauthReturn.redirectUri);
      target.searchParams.set("code", oauthReturn.code);
      if (oauthReturn.state) target.searchParams.set("state", oauthReturn.state);
      console.log("[SSO/login] auto oauth redirect (already authenticated) ->", target.toString());
      window.location.href = target.toString();
    } catch (err) {
      console.error("[SSO/login] auto oauth redirect failed:", err);
    }
  }, [oauthReturn]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!loginClientId) {
      toast.error("缺少 clientId：请通过 OAuth 跳转访问，或配置 NEXT_PUBLIC_LOGIN_CLIENT_ID");
      return;
    }
    setSubmitting(true);
    try {
      const res = await loginMut.mutateAsync({
        data: { username, password, clientId: loginClientId },
      });
      // Phase C5：响应类型直用生成 LoginResponse（契约 required：user/
      // availableTenants/userId/clientId；accessToken/refreshToken optional），
      // 不再手写结构 shim。运行时字段缺失按「缺 token」分支拒绝。
      const data: LoginResponse | undefined = res.data;
      if (!data?.accessToken || !data.refreshToken) {
        toast.error("登录响应缺少 token，请联系管理员");
        return;
      }
      login({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        userId: data.user?.id ?? "",
        username,
        email: data.user?.email,
        currentTenantId: data.availableTenants?.[0]?.tenantId ?? "",
        tenantCode: null,
      });
      // OAuth 2.0 code 回跳：把 code+state 原样透传给 RP 的 redirect_uri。
      // 用 setTimeout(0) 让 React 先把 setSession 的 re-render 跑完、RequireAuth
      // 的 useEffect 决定「不抢着跳 /tenants」之后，再做导航，避免 race。
      // 旧 ?token= 捷径已删 — 不再有 LAB_BASE 回跳逻辑。
      setTimeout(() => {
        if (oauthReturn) {
          try {
            const target = new URL(oauthReturn.redirectUri);
            target.searchParams.set("code", oauthReturn.code);
            if (oauthReturn.state) target.searchParams.set("state", oauthReturn.state);
            const url = target.toString();
            console.log("[SSO/login] oauth code redirect ->", url);
            window.location.href = url;
          } catch (err) {
            console.error("[SSO/login] oauth redirect build failed:", err);
            toast.error("OAuth 回跳 URL 构造失败");
          }
          return;
        }
        // OAuth 2.0 跳板（RFC 6749 §4.1.1）：?redirect_uri=&state=&client_id= 且无 ?code=——
        // 登录成功后调 /oauth/authorize 领 code 跳回 RP（不落 /tenants）。镜像 react/vue。
        const sp = new URLSearchParams(window.location.search);
        const redirectUri = sp.get("redirect_uri");
        const state = sp.get("state") ?? "";
        const clientId = sp.get("client_id") ?? "";
        if (redirectUri && clientId) {
          void (async () => {
            try {
              const authRes = await authorizeMut.mutateAsync({
                data: {
                  clientId,
                  redirectUri,
                  responseType: "code",
                  scope: "lab.read lab.write",
                  state,
                },
              });
              const target = new URL(redirectUri);
              target.searchParams.set("code", authRes.data.code);
              if (state) target.searchParams.set("state", state);
              window.location.href = target.toString();
            } catch (err) {
              console.error("[SSO/login] oauth authorize (after submit) failed:", err);
              toast.error("OAuth 授权失败，请重试");
              // 留在登录页让用户重试
            }
          })();
          return;
        }
        router.push("/tenants");
      }, 0);
    } catch (err) {
      const apiErr = toApiError(err);
      // M01.F04.I02 - 423 (aspnetcore) / 429 (nextjs Route Handler) =
      // 失败 5 次锁定（后端 15min 自动解锁）
      const msg =
        apiErr.status === 423 || apiErr.status === 429
          ? "账号已被锁定，请 15 分钟后再试"
          : apiErr.status === 401
            ? "用户名或密码错误"
            : apiErr.status === 0
              ? // 显示实际请求目标（选择器可切，env 标签会误导）：未选择 = env 默认
                `后端不可达（${getSelectedBackend() || `${apiMode}·env 默认`}）：${apiErr.message}`
              : apiErr.message;
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-100 via-white to-slate-200 p-4">
      {/* 登录页独立于 AppShell（其内才有全局 <Toaster/>）——错误 toast 靠这里自挂 */}
      <Toaster />
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-2">
          <CardTitle className="text-lg">SaaS 多租户多应用身份平台</CardTitle>
          <CardDescription>
            {oauthReturn
              ? "有外部应用通过 SSO 请求登录，登录后将自动返回"
              : "使用账号密码登录管理控制台"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">用户名</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="alice"
                required
                autoComplete="username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                required
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting} data-fn="M01.F04.I03">
              {submitting ? "登录中…" : "登录"}
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t space-y-4">
            <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-xs space-y-2">
              <p className="font-medium text-amber-900">🔐 演示账号密码不公开</p>
              <p className="text-amber-800 leading-relaxed">
                如需体验，请通过下方任一方式获取最新演示密码：
              </p>
              <ul className="space-y-1 text-amber-800">
                <li className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-500 text-white text-[10px] font-bold shrink-0">
                    微
                  </span>
                  <span>
                    关注微信公众号{" "}
                    <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-amber-200">
                      南荣相如
                    </code>
                    ，回复「演示」
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold shrink-0">
                    书
                  </span>
                  <span>
                    关注小红书{" "}
                    <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-amber-200">
                      @南荣相如
                    </code>
                    ，查看置顶笔记
                  </span>
                </li>
              </ul>
            </div>

            {/* 2026-09-12：静态 env 标签 → BackendBadge 切换器（dev 诊断，
                选择持久化 localStorage，下一个请求即生效，含登录 POST 本身） */}
            <div className="space-y-1">
              <p className="text-xs text-slate-400">后端模式（切换后下一个请求即生效）</p>
              <BackendBadge variant="plain" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
