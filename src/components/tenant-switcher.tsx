"use client";

// TenantSwitcher — 顶部栏右侧 Dropdown，切换当前用户可访问的租户。
// 用于跨租户操作场景（admin 视角）。

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTenant } from "@/state/tenant-context";

interface Membership {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  status: "active" | "invited" | "removed";
}

export function TenantSwitcher() {
  const { currentTenantId, setTenant } = useTenant();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const router = useRouter();

  useEffect(() => {
    // M00.F02.I02 — list current user memberships (mocked)
    setMemberships([
      {
        id: "m1",
        tenantId: "00000000-0000-0000-0000-000000000001",
        code: "acme",
        name: "ACME Corp",
        status: "active",
      },
      {
        id: "m2",
        tenantId: "00000000-0000-0000-0000-000000000002",
        code: "globex",
        name: "Globex Industries",
        status: "active",
      },
      {
        id: "m3",
        tenantId: "00000000-0000-0000-0000-000000000003",
        code: "initech",
        name: "Initech",
        status: "active",
      },
    ]);
  }, []);

  const current = memberships.find((m) => m.tenantId === currentTenantId);

  function onSwitch(tenantId: string) {
    // M00.F02.I03 — switch tenant via POST /api/me/tenants/{tenantId}/switch
    setTenant(tenantId, null, "mock-token-" + tenantId);
    router.push(`/tenants/${tenantId}/users`);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          data-testid="tenant-switcher"
          data-fn="M00.F02.I03"
        >
          <Building2 className="h-4 w-4 text-slate-500" />
          <span className="font-medium">{current?.name ?? "选择租户"}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 text-slate-400" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>切换租户</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {memberships.map((m) => (
          <DropdownMenuItem
            key={m.id}
            onSelect={() => onSwitch(m.tenantId)}
            className="cursor-pointer"
          >
            <Building2 className="h-4 w-4 mr-2 text-slate-500" />
            <div className="flex flex-col">
              <span className="font-medium">{m.name}</span>
              <span className="text-xs text-slate-500 font-mono">{m.code}</span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
