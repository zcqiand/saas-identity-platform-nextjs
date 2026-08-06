import { listApps } from "@/lib/app-store";
import { AppsClient, type AppRow } from "./apps-client";

export default async function AppsPage() {
  const apps = (await listApps()) as unknown as AppRow[];
  return <AppsClient initialApps={apps} />;
}