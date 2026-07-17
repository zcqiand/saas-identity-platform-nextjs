import { listApps } from "@/lib/app-store";
import { AppsClient, type AppRow } from "./apps-client";

export default function AppsPage() {
  const apps = listApps() as unknown as AppRow[];
  return <AppsClient initialApps={apps} />;
}