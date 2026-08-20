"use client";

// M03.F01.I01 — 账号密码登录（独立布局：登录页绕过 AppShell）
//
// 提交：调 authLogin（orval 1:1 端点函数）；成功后写 tenant-context session；
// 失败：toast.error（sonner）。
//
// SSO 返回：URL 带 ?redirect=<lab-callback> 时，登录成功后跳回那里（带 token+state）。
//          没有 ?redirect= 时落回 /tenants 默认路径。

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTenant } from "@/state/tenant-context";
import { getApiMode } from "@/api/backend-config";
import { authLogin } from "@/api/endpoints/endpoints";
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
  const [ssoReturn, setSsoReturn] = useState<{ redirect: string; state: string } | null>(null);
  // RFC 6749 §4.1.1 授权码范式：lab 后端（confidential client）已替浏览器领到 code，
  // saas 登录页只负责认证资源所有者，成功后 302 redirect_uri?code&state（§4.1.2）。
  const [oauthReturn, setOauthReturn] = useState<{
    redirectUri: string;
    code: string;
    state: string;
  } | null>(null);

  // 解析 SSO ?redirect=&state=（lab RP 跳来时带）
  // 用 window.location.search 直接读，不依赖 useSearchParams 的 Suspense 时序。
  // URLSearchParams.get 在某些浏览器/Next.js 版本下对 redirect 这种
  // 「已被 URLSearchParams.set 编码过」的值不再二次解码，统一 decodeURIComponent 兜底。
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    // 授权码分支优先：lab 后端 /sso/authorize 领 code 后跳来（带 code+redirect_uri+state）
    const oauthCode = sp.get("code");
    const oauthRedirect = sp.get("redirect_uri");
    if (oauthCode && oauthRedirect) {
      setOauthReturn({ redirectUri: oauthRedirect, code: oauthCode, state: sp.get("state") ?? "" });
      return;
    }
    const raw = sp.get("redirect");
    if (!raw) return;
    let redirect = raw;
    try {
      redirect = decodeURIComponent(raw);
    } catch {
      // 已是 decoded 形式；保留原值
    }
    setSsoReturn({ redirect, state: sp.get("state") ?? "" });
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
    setSubmitting(true);
    try {
      const res = await authLogin({ username, password });
      const data = res.data;
      console.log("[SSO/login] authLogin OK, ssoReturn=", ssoReturn);
      login({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        userId: data.userId,
        username,
        email: undefined,
        currentTenantId: data.currentTenantId,
        tenantCode: null,
      });
      // SSO 回跳：把 token + state 拼到 redirect URL，让 RP 拿
      // 用 setTimeout(0) 让 React 先把 setSession 的 re-render 跑完、RequireAuth
      // 的 useEffect 决定「不抢着跳 /tenants」之后，再做导航，避免 race。
      setTimeout(() => {
        // RFC 6749 §4.1.2 授权码回跳优先：redirect_uri?code=...&state=... 原样透传。
        // code 是 lab 后端领的一次性授权码，saas 只做资源所有者认证，不消费它。
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
        if (ssoReturn) {
          try {
            // lab msw 发的 redirect 通常是 path（"/" 或 "/select-tenant" 等）。
            // new URL(path) 需要 base —— 没有就抛 "Invalid URL"。
            // 同时支持全 URL 形式（lab 给绝对地址 / saas 间调）。
            const LAB_BASE = process.env.NEXT_PUBLIC_LAB_BASE_URL ?? "http://localhost:5173";
            const target = new URL(ssoReturn.redirect, LAB_BASE);
            target.searchParams.set("token", data.accessToken);
            if (ssoReturn.state) target.searchParams.set("state", ssoReturn.state);
            const url = target.toString();
            console.log("[SSO/login] window.location ->", url);
            window.location.href = url;
          } catch (err) {
            console.error("[SSO/login] SSO redirect build failed:", err);
            toast.error("SSO 回跳 URL 构造失败");
          }
          return;
        }
        console.log("[SSO/login] no ssoReturn, router.push /tenants");
        router.push("/tenants");
      }, 0);
    } catch (err) {
      const apiErr = toApiError(err);
      const msg =
        apiErr.status === 401
          ? "用户名或密码错误"
          : apiErr.status === 0
            ? `后端不可达（${apiMode}）：${apiErr.message}`
            : apiErr.message;
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-100 via-white to-slate-200 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-2">
          <CardTitle className="text-lg">SaaS 多租户身份平台</CardTitle>
          <CardDescription>
            {ssoReturn
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
            <Button type="submit" className="w-full" disabled={submitting} data-fn="M03.F01.I01">
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

            <p className="text-xs text-slate-400">
              当前后端模式：<span className="font-medium text-slate-700">{apiMode}</span>
            </p>

            {ssoReturn && (
              <p className="text-xs text-blue-600 break-all">
                SSO 登录后返回：{ssoReturn.redirect}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
