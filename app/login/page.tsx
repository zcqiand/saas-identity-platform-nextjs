"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthLogin } from "@/api/endpoints/endpoints";
import { useTenant } from "@/state/tenant-context";
import { toApiError } from "@/api/http-client";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [demoUsernames, setDemoUsernames] = useState<string[]>([]);
  const { login } = useTenant();
  const router = useRouter();
  const loginMut = useAuthLogin();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage("");
    try {
      const res = await loginMut.mutateAsync({
        data: { username, password },
      });
      const { accessToken, refreshToken, userId, currentTenantId } = res.data;
      login({
        accessToken,
        refreshToken,
        userId,
        username,
        email: undefined,
        currentTenantId,
        tenantCode: null,
      });
      router.push("/tenants");
    } catch (err) {
      const apiErr = toApiError(err);
      setErrorMessage(apiErr.message);
      if (apiErr.status === 401 && apiErr.body?.availableUsernames) {
        setDemoUsernames(apiErr.body.availableUsernames);
      }
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      style={{
        padding: 32,
        maxWidth: 360,
        margin: "60px auto",
        border: "1px solid #eee",
        borderRadius: 8,
      }}
    >
      <h2 style={{ marginTop: 0 }}>登录 SaaS Identity Platform</h2>
      <label style={{ display: "block", marginBottom: 12 }}>
        <span style={{ display: "block", fontSize: 13, marginBottom: 4 }}>用户名</span>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          data-fn="M03.F01.I01"
          style={{ display: "block", width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 4 }}
        />
      </label>
      <label style={{ display: "block", marginBottom: 16 }}>
        <span style={{ display: "block", fontSize: 13, marginBottom: 4 }}>密码</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          data-fn="M03.F01.I01"
          style={{ display: "block", width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 4 }}
        />
      </label>

      <div
        style={{
          background: "#fffbeb",
          border: "1px solid #fcd34d",
          borderRadius: 6,
          padding: 12,
          fontSize: 12,
          marginBottom: 16,
          lineHeight: 1.6,
        }}
      >
        <p style={{ fontWeight: 600, color: "#92400e", margin: "0 0 6px 0" }}>🔐 演示账号密码不公开</p>
        <p style={{ color: "#92400e", margin: "0 0 6px 0" }}>
          如需体验，请通过下方任一方式获取最新演示密码：
        </p>
        <ul style={{ listStyle: "none", padding: 0, margin: 0, color: "#92400e" }}>
          <li style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: "#10b981",
                color: "#fff",
                fontSize: 10,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              微
            </span>
            关注微信公众号{" "}
            <code style={{ fontFamily: "monospace", background: "#fff", padding: "1px 4px", borderRadius: 3, border: "1px solid #fcd34d" }}>
              SaaS 实战派
            </code>
            ，回复「演示」
          </li>
          <li style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: "#ef4444",
                color: "#fff",
                fontSize: 10,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              书
            </span>
            关注小红书{" "}
            <code style={{ fontFamily: "monospace", background: "#fff", padding: "1px 4px", borderRadius: 3, border: "1px solid #fcd34d" }}>
              @SaaS 实战派
            </code>
            ，查看置顶笔记
          </li>
        </ul>
        {demoUsernames.length > 0 && (
          <p style={{ color: "#92400e", margin: "8px 0 0 0", fontSize: 11 }}>
            可用用户名：<span style={{ fontFamily: "monospace" }}>{demoUsernames.join(" / ")}</span>
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={loginMut.isPending}
        style={{
          width: "100%",
          padding: 10,
          background: "#1f2937",
          color: "#fff",
          border: 0,
          borderRadius: 4,
          cursor: "pointer",
        }}
        data-fn="M03.F01.I01"
      >
        {loginMut.isPending ? "登录中…" : "登录"}
      </button>
      {errorMessage && (
        <p style={{ color: "#c00", margin: "12px 0 0 0", fontSize: 13 }}>
          登录失败：{errorMessage}
        </p>
      )}
    </form>
  );
}