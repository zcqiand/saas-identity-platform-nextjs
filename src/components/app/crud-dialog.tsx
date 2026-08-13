// 通用 CRUD Dialog（创建/编辑共用）
// 字段配置驱动（fields: FieldDef[]），统一提交/取消/loading。
// 弹窗内 form 标签 + 控件布局用 <Field> 包，子组件负责渲染控件（用 render 函数）。

import { useEffect, useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "./field";

export type FieldValue = string | number | boolean | string[] | undefined | null;

export interface FieldDef {
  /** 字段名，作为 form state 的 key */
  name: string;
  label: string;
  required?: boolean;
  hint?: string;
  placeholder?: string;
  type?: "text" | "number" | "textarea" | "select" | "checkbox";
  options?: Array<{ value: string; label: string }>;
  defaultValue?: FieldValue;
}

export interface CrudDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  fields: FieldDef[];
  /** 初始值（编辑模式）；不传则用 fields 的 defaultValue */
  initialValues?: Record<string, FieldValue>;
  submitText?: string;
  cancelText?: string;
  loading?: boolean;
  onSubmit: (values: Record<string, FieldValue>) => void | Promise<void>;
  /** 自定义字段渲染，覆盖默认控件。键为 field.name */
  renderField?: (field: FieldDef, value: FieldValue, onChange: (v: FieldValue) => void) => ReactNode;
}

function defaultRenderField(
  field: FieldDef,
  value: FieldValue,
  onChange: (v: FieldValue) => void,
): ReactNode {
  const { type = "text", name } = field;
  const id = `crud-field-${name}`;
  if (type === "textarea") {
    return (
      <Textarea
        id={id}
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
      />
    );
  }
  if (type === "select" && field.options) {
    return (
      <Select value={String(value ?? "")} onValueChange={(v) => onChange(v)}>
        <SelectTrigger id={id}>
          <SelectValue placeholder={field.placeholder ?? "请选择"} />
        </SelectTrigger>
        <SelectContent>
          {field.options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  if (type === "checkbox") {
    return (
      <div className="flex items-center gap-2">
        <Checkbox
          id={id}
          checked={Boolean(value)}
          onCheckedChange={(v) => onChange(Boolean(v))}
        />
        {field.hint && <span className="text-sm text-slate-600">{field.hint}</span>}
      </div>
    );
  }
  // 默认 text / number
  return (
    <Input
      id={id}
      type={type}
      value={String(value ?? "")}
      onChange={(e) => onChange(type === "number" ? Number(e.target.value) : e.target.value)}
      placeholder={field.placeholder}
    />
  );
}

export function CrudDialog({
  open,
  onOpenChange,
  title,
  description,
  fields,
  initialValues,
  submitText = "保存",
  cancelText = "取消",
  loading = false,
  onSubmit,
  renderField,
}: CrudDialogProps) {
  const [values, setValues] = useState<Record<string, FieldValue>>(() => {
    const init: Record<string, FieldValue> = {};
    for (const f of fields) {
      init[f.name] = initialValues?.[f.name] ?? f.defaultValue ?? "";
    }
    return init;
  });

  useEffect(() => {
    if (!open) return;
    const init: Record<string, FieldValue> = {};
    for (const f of fields) {
      init[f.name] = initialValues?.[f.name] ?? f.defaultValue ?? "";
    }
    setValues(init);
  }, [open]);

  function setField(name: string, value: FieldValue) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSubmit(values);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>

          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
            {fields.map((f) => (
              <Field key={f.name} label={f.label} htmlFor={`crud-field-${f.name}`} required={f.required}>
                {renderField
                  ? renderField(f, values[f.name], (v) => setField(f.name, v))
                  : defaultRenderField(f, values[f.name], (v) => setField(f.name, v))}
              </Field>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
              {cancelText}
            </Button>
            <Button type="submit" disabled={loading} data-fn="crud.submit">
              {loading ? "提交中…" : submitText}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}