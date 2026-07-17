import { NextResponse } from "next/server";
import * as platformSettingsStore from "@/lib/platform-settings-store";

/** M06 平台运营 — 单条 setting GET/PUT */

function parseValue(raw: unknown): string | null {
  if (typeof raw === "string") return raw;
  if (typeof raw === "number" || typeof raw === "boolean") return String(raw);
  if (raw === null || raw === undefined) return null;
  return null;
}

export async function GET(
  _req: Request,
  { params }: { params: { key: string } },
) {
  const setting = platformSettingsStore.getPlatformSetting(params.key);
  if (!setting) {
    return NextResponse.json(
      { error: "platform setting not found" },
      { status: 404 },
    );
  }
  return NextResponse.json(setting);
}

export async function PUT(
  req: Request,
  { params }: { params: { key: string } },
) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (raw === null || typeof raw !== "object") {
    return NextResponse.json({ error: "body must be object" }, { status: 400 });
  }
  const b = raw as { value?: unknown; description?: unknown };
  const value = parseValue(b.value);
  if (value === null) {
    return NextResponse.json(
      { error: "missing required field: value" },
      { status: 400 },
    );
  }
  const description =
    typeof b.description === "string" ? b.description : undefined;
  const updated = platformSettingsStore.setPlatformSetting(
    params.key,
    value,
    description,
  );
  return NextResponse.json(updated);
}