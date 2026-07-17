import { NextResponse } from "next/server";
import * as apiKeyStore from "@/lib/api-key-store";

/** M04.F02 API Key CRUD route handlers */

interface CreateApiKeyBody {
  name?: unknown;
  key?: unknown;
  appId?: unknown;
  expiresAt?: unknown;
  enabled?: unknown;
}

function generateRandomKey(): string {
  // 32 hex chars
  return Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join("");
}

export async function GET() {
  return NextResponse.json(apiKeyStore.listApiKeys());
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
  if (typeof b.name !== "string" || typeof b.appId !== "number") {
    return NextResponse.json(
      { error: "missing required fields: name, appId" },
      { status: 400 },
    );
  }
  const key = typeof b.key === "string" && b.key.trim() ? b.key.trim() : generateRandomKey();
  const created = apiKeyStore.createApiKey({
    name: b.name,
    key,
    appId: b.appId,
    expiresAt: typeof b.expiresAt === "string" ? b.expiresAt : undefined,
    enabled: typeof b.enabled === "boolean" ? b.enabled : undefined,
  });
  return NextResponse.json(created, { status: 201 });
}