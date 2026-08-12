"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTenant } from "../../src/state/tenant-context";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { setTenant } = useTenant();
  const router = useRouter();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTenant("00000000-0000-0000-0000-000000000001", "acme", "mock-jwt-token");
    router.push("/tenants");
  }

  return (
    <form onSubmit={onSubmit} style={{ padding: 32, maxWidth: 360, margin: "60px auto" }}>
      <h2>登录 SaaS Identity Platform</h2>
      <label>
        用户名
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          data-fn="M03.F01.I01"
          style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
        />
      </label>
      <label style={{ marginTop: 12, display: "block" }}>
        密码
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          data-fn="M03.F01.I01"
          style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
        />
      </label>
      <button
        type="submit"
        style={{ marginTop: 16, padding: "8px 16px" }}
        data-fn="M03.F01.I01"
      >
        登录
      </button>
    </form>
  );
}