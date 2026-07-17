"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * M01.F01 租户详情/编辑页（client form）
 *
 * fn-ID：
 *   - I06 页面根 → data-fn="M01.F01.I06"
 *   - I07 保存配置 → 「保存」按钮 data-fn="M01.F01.I07"
 *
 * code 字段不可编辑（unique + ref 引用），只允许改 name / theme。
 */
interface TenantRow {
  id: number;
  code: string;
  name: string;
  theme: string;
  createdAt: string;
}

export interface TenantEditFormProps {
  tenant: TenantRow;
}

export function TenantEditForm({ tenant }: TenantEditFormProps) {
  const [name, setName] = useState(tenant.name);
  const [theme, setTheme] = useState(tenant.theme);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/tenants/${tenant.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, theme }),
      });
      if (!res.ok) {
        alert(`保存失败 (${res.status})`);
        return;
      }
      alert("保存成功");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      data-testid="tenant-edit-page"
      data-fn="M01.F01.I06"
      className="container mx-auto max-w-2xl py-8"
    >
      <Card>
        <CardHeader>
          <CardTitle>编辑租户 — {tenant.code}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">Code（不可改）</Label>
            <Input id="code" value={tenant.code} disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">名称</Label>
            <Input
              id="name"
              data-testid="name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="theme">主题</Label>
            <Input
              id="theme"
              data-testid="theme-input"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
            />
          </div>
          <Button
            data-testid="save-btn"
            data-fn="M01.F01.I07"
            onClick={handleSave}
            disabled={saving}
            className="w-full"
          >
            {saving ? "保存中…" : "保存配置"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}