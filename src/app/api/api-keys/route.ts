import { NextResponse } from "next/server";
import * as apiKeyStore from "@/lib/api-key-store";

/** M04.F02 API Key CRUD route handlers */

interface CreateApiKeyBody {
  id?: unknown;
  name?: unknown;
  key?: unknown;
  keyPrefix?: unknown;
  appId?: unknown;
  scopes?: unknown;
  expiresAt?: unknown;
  enabled?: unknown;
}

function generateRandomId(): string {
  // "ak-" + 12 hex chars
  const tail = Array.from({ length: 12 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join("");
  return `ak-${tail}`;
}

function generateRandomKey(): string {
  // 32 hex chars
  return Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join("");
}

export async function GET() {
  return NextResponse.json(await apiKeyStore.listApiKeys());
}

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (raw === null || typeof raw !== "object") {
    return NextResponse.json({ error: "body must be object" }, { status: 400 });
  }
  const b = raw as CreateApiKeyBody;
  if (
    typeof b.name !== "string" ||
    typeof b.appId !== "string" ||
    typeof b.keyPrefix !== "string"
  ) {
    return NextResponse.json(
      { error: "missing required fields: name, appId, keyPrefix" },
      { status: 400 },
    );
  }
  const id = typeof b.id === "string" && b.id.trim() ? b.id.trim() : generateRandomId();
  const key = typeof b.key === "string" && b.key.trim() ? b.key.trim() : generateRandomKey();
  const scopes = Array.isArray(b.scopes)
    ? b.scopes.filter((s): s is string => typeof s === "string")
    : undefined;
  const created = await apiKeyStore.createApiKey({
    id,
    name: b.name,
    key,
    keyPrefix: b.keyPrefix,
    appId: b.appId,
    expiresAt: typeof b.expiresAt === "string" ? b.expiresAt : "never",
    enabled: typeof b.enabled === "boolean" ? b.enabled : true,
    ...(scopes !== undefined ? { scopes } : {}),
  });
  return NextResponse.json(created, { status: 201 });
}
