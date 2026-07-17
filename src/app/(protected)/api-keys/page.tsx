import { listApiKeys } from "@/lib/api-key-store";
import { listApps } from "@/lib/app-store";
import { ApiKeysClient, type ApiKeyRow } from "./api-keys-client";

export default function ApiKeysPage() {
  const keys = listApiKeys() as unknown as ApiKeyRow[];
  const apps = listApps().map((a) => ({ id: a.id, code: a.code, name: a.name }));
  return <ApiKeysClient initialKeys={keys} apps={apps} />;
}