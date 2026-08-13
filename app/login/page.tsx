"use client";

// M03.F01.I01 — 账号密码登录（独立布局：登录页绕过 AppShell）
//
// 提交：调 authLogin（orval 1:1 端点函数）；成功后写 tenant-context session；
// 失败：toast.error（sonner）。

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTenant } from "@/state/tenant-context";
import { useBackend } from "@/state/backend-context";
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
  const { backend } = useBackend();
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await authLogin({ username, password });
      const data = res.data;
      login({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        userId: data.userId,
        username,
        email: undefined,
        currentTenantId: data.currentTenantId,
        tenantCode: null,
      });
      router.push("/tenants");
    } catch (err) {
      const apiErr = toApiError(err);
      const msg =
        apiErr.status === 401
          ? "用户名或密码错误"
          : apiErr.status === 0
            ? `后端不可达（${backend}）：${apiErr.message}`
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
          <CardDescription>使用账号密码登录管理控制台</CardDescription>
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
            <Button
              type="submit"
              className="w-full"
              disabled={submitting}
              data-fn="M03.F01.I01"
            >
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
                      SaaS 实战派
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
                      @SaaS 实战派
                    </code>
                    ，查看置顶笔记
                  </span>
                </li>
              </ul>
            </div>

            <div className="text-xs text-slate-500 space-y-1">
              <p className="font-medium text-slate-700">演示账号（用户名公开，密码见上方）</p>
              <ul className="font-mono space-y-0.5">
                {DEMO_ACCOUNTS.map((a) => (
                  <li key={a.username}>
                    {a.username} · {a.tenant}
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-xs text-slate-400">
              当前后端模式：<span className="font-medium text-slate-700">{backend}</span>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
