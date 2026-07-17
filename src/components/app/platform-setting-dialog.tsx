"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/app/field";

/**
 * M06 平台运营 — 单条 setting 编辑对话框（复用）。
 *
 * 6 个 settings/* 子页（login-methods / password / tokens /
 * notifications / risk / openapi）都调它，根据 type 渲染不同控件：
 *   - "boolean" → checkbox
 *   - "number"  → number input
 *   - "string"  → text input
 *
 * 用 data-fn 包裹容器，data-testid="settings-edit-dialog-<key>"
 */
export type SettingType = "boolean" | "number" | "string";

export interface PlatformSettingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  keyName: string;
  title: string;
  initialValue: string;
  description?: string;
  type: SettingType;
  testId?: string;
}

export function PlatformSettingDialog({
  open,
  onOpenChange,
  keyName,
  title,
  initialValue,
  description,
  type,
  testId,
}: PlatformSettingDialogProps) {
  const [value, setValue] = useState(() => initialValue);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setValue(initialValue);
  }

  async function handleSubmit() {
    // 校验
    if (type === "number" && value.trim() !== "" && Number.isNaN(Number(value))) {
      toast.error("请输入有效数字");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/platform-settings/${encodeURIComponent(keyName)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          value: type === "boolean" ? (value === "true" ? "true" : "false") : value,
          description,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(err.error ?? `保存失败 (${res.status})`);
        return;
      }
      toast.success(`${title} 已更新`);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "网络错误");
    } finally {
      setSubmitting(false);
    }
  }

  const tid = testId ?? `settings-edit-dialog-${keyName.replace(/[^a-z0-9]/gi, "-")}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid={tid}>
        <DialogHeader>
          <DialogTitle>编辑 {title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Key" htmlFor={`${tid}-key`} hint="只读">
            <Input id={`${tid}-key`} value={keyName} disabled readOnly />
          </Field>
          <Field label="当前值" required htmlFor={`${tid}-value`}>
            {type === "boolean" ? (
              <div className="flex items-center gap-2 pt-2">
                <input
                  id={`${tid}-value`}
                  data-testid={`${tid}-value`}
                  type="checkbox"
                  className="size-4"
                  checked={value === "true"}
                  onChange={(e) =>
                    setValue(e.target.checked ? "true" : "false")
                  }
                />
                <span>{value === "true" ? "启用" : "禁用"}</span>
              </div>
            ) : (
              <Input
                id={`${tid}-value`}
                data-testid={`${tid}-value`}
                type={type === "number" ? "number" : "text"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            )}
          </Field>
          {description ? (
            <p className="text-muted-foreground text-xs">{description}</p>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
            disabled={submitting}
          >
            取消
          </Button>
          <Button
            data-testid={`${tid}-submit`}
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? "保存中..." : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}