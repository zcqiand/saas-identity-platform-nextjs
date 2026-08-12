"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTenant } from "../state/tenant-context";

interface Membership {
  id: string;
  tenantId: string;
  status: "active" | "invited" | "removed";
}

export function TenantSwitcher() {
  const { currentTenantId, setTenant } = useTenant();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const router = useRouter();

  useEffect(() => {
    setMemberships([
      {
        id: "m1",
        tenantId: "00000000-0000-0000-0000-000000000001",
        status: "active",
      },
    ]);
  }, []);

  function onSwitch(e: React.ChangeEvent<HTMLSelectElement>) {
    const tenantId = e.target.value;
    setTenant(tenantId, null, "mock-token-" + tenantId);
    router.push(`/t/${tenantId}/users`);
  }

  return (
    <div data-testid="tenant-switcher" style={{ padding: "8px 16px", borderBottom: "1px solid #eee" }}>
      <label style={{ marginRight: 8 }}>当前租户:</label>
      <select value={currentTenantId ?? ""} onChange={onSwitch} data-fn="M00.F02.I03">
        <option value="" disabled>
          请选择
        </option>
        {memberships.map((m) => (
          <option key={m.id} value={m.tenantId}>
            {m.tenantId.slice(0, 8)}…
          </option>
        ))}
      </select>
    </div>
  );
}