"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildAuthorizeUrl } from "@/lib/oauth-url";

/** M01.F04.I04 — LoginForm 组件
 *  渲染「使用 SSO 登录」按钮：点击触发 window.location.href 跳到 /api/sso/authorize
 *  data-fn="M01.F04.I04"
 */
export function LoginForm() {
  function handleSSOClick() {
    if (typeof window === "undefined") return;
    window.location.href = buildAuthorizeUrl({
      clientId: "saas-web",
      redirectUri: `${window.location.origin}/api/sso/callback`,
      state: crypto.randomUUID(),
    });
  }

  return (
    <div
      data-testid="login-page"
      className="flex min-h-screen items-center justify-center bg-background p-4"
    >
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>登录 — SaaS 统一身份管理</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            data-testid="sso-login-btn"
            data-fn="M01.F04.I04"
            onClick={handleSSOClick}
            className="w-full"
          >
            使用 SSO 登录
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}