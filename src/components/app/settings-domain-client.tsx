"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  PlatformSettingDialog,
  type SettingType,
} from "@/components/app/platform-setting-dialog";

/**
 * M06 平台运营 — 通用 settings/* 子页 client。
 *
 * 给 login-methods / password / tokens / notifications / risk /
 * openapi 6 个子页共用。配置项含：
 *   - id: data-fn 挂的 fn-ID（页面根挂在 page root，编辑按钮挂在 row）
 *   - key: platform_settings 表的 key
 *   - title: 中文名（Dialog 标题）
 *   - type: "boolean" | "number" | "string"
 *   - initialValue: 当前值
 *   - description: 可选描述
 */

export interface SettingItem {
  id: string;
  key: string;
  title: string;
  type: SettingType;
  initialValue: string;
  description?: string;
}

export interface SettingsDomainClientProps {
  pageTestId: string;
  pageFnId: string;
  pageTitle: string;
  prefix: string;
  items: SettingItem[];
}

export function SettingsDomainClient({
  pageTestId,
  pageFnId,
  pageTitle,
  prefix,
  items,
}: SettingsDomainClientProps) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const editingItem = items.find((i) => i.key === editingKey) ?? null;

  return (
    <div
      data-testid={pageTestId}
      data-fn={pageFnId}
      className="container mx-auto space-y-6 py-8"
    >
      <Card>
        <CardHeader>
          <CardTitle>{pageTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between gap-2"
              data-testid={`${prefix}-row-${item.id}`}
            >
              <div className="space-y-0.5">
                <div className="text-sm font-medium">{item.title}</div>
                <div className="text-muted-foreground text-xs">
                  key: <code className="font-mono">{item.key}</code>
                  {" · 当前: "}
                  <code className="font-mono">{item.initialValue}</code>
                </div>
              </div>
              <Button
                data-testid={`${prefix}-btn-${item.id}`}
                data-fn={item.id}
                variant="outline"
                size="sm"
                onClick={() => setEditingKey(item.key)}
              >
                编辑
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {editingItem ? (
        <PlatformSettingDialog
          open
          onOpenChange={(o) => !o && setEditingKey(null)}
          keyName={editingItem.key}
          title={editingItem.title}
          initialValue={editingItem.initialValue}
          description={editingItem.description}
          type={editingItem.type}
          testId={`settings-edit-dialog-${editingItem.key.replace(/[^a-z0-9]/gi, "-")}`}
        />
      ) : null}
    </div>
  );
}