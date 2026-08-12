"use client";

// 通用 CRUD Dialog（创建/编辑共用）
// 字段配置驱动（fields: FieldDef[]），统一提交/取消/loading。
// v0.2.0 nextjs 仓：plain CSS 实现（未引入 shadcn/ui Dialog；其他 React 仓可用 shadcn）。

import { useEffect, useState, type ReactNode } from "react";

export type FieldValue = string | number | boolean | string[] | undefined | null;

export interface FieldDef {
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
  initialValues?: Record<string, FieldValue>;
  submitText?: string;
  cancelText?: string;
  loading?: boolean;
  onSubmit: (values: Record<string, FieldValue>) => void | Promise<void>;
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
      <textarea
        id={id}
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        style={{ width: "100%", padding: 6, border: "1px solid #ccc", borderRadius: 4 }}
      />
    );
  }
  if (type === "select" && field.options) {
    return (
      <select
        id={id}
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%", padding: 6, border: "1px solid #ccc", borderRadius: 4 }}
      >
        <option value="" disabled>
          {field.placeholder ?? "请选择"}
        </option>
        {field.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }
  if (type === "checkbox") {
    return (
      <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <input
          id={id}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
        {field.hint && <span style={{ fontSize: 12, color: "#666" }}>{field.hint}</span>}
      </label>
    );
  }
  return (
    <input
      id={id}
      type={type}
      value={String(value ?? "")}
      onChange={(e) => onChange(type === "number" ? Number(e.target.value) : e.target.value)}
      placeholder={field.placeholder}
      style={{ width: "100%", padding: 6, border: "1px solid #ccc", borderRadius: 4 }}
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

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div
        style={{
          background: "#fff",
          padding: 24,
          borderRadius: 8,
          minWidth: 360,
          maxWidth: 560,
          maxHeight: "80vh",
          overflowY: "auto",
        }}
      >
        <h3 style={{ marginTop: 0 }}>{title}</h3>
        {description && <p style={{ color: "#666", marginBottom: 16 }}>{description}</p>}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {fields.map((f) => (
            <div key={f.name}>
              <label
                htmlFor={`crud-field-${f.name}`}
                style={{ display: "block", fontSize: 13, marginBottom: 4 }}
              >
                {f.label}
                {f.required && <span style={{ color: "#c00" }}>*</span>}
              </label>
              {renderField
                ? renderField(f, values[f.name], (v) => setField(f.name, v))
                : defaultRenderField(f, values[f.name], (v) => setField(f.name, v))}
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              data-fn="crud.cancel"
              style={{ padding: "6px 12px" }}
            >
              {cancelText}
            </button>
            <button
              type="submit"
              disabled={loading}
              data-fn="crud.submit"
              style={{
                padding: "6px 12px",
                background: "#1f2937",
                color: "#fff",
                border: 0,
                borderRadius: 4,
              }}
            >
              {loading ? "提交中…" : submitText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}