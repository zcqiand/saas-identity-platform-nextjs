import { getDashboardCounts } from "@/lib/dashboard-store";
import { Home } from "@/components/app/home-client";

/** M01.F05.I01 — 控制台首页（server component） */

export default async function DashboardPage() {
  const counts = await getDashboardCounts();
  return <Home counts={counts} />;
}