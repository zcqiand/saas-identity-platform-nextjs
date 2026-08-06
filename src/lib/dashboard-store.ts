import "server-only";
import { and, eq, gte, like } from "drizzle-orm";
import { db } from "@/db";
import { tenants, users, auditLogs } from "@/db/schema";

/** M01.F05.I02 — 控制台首页聚合查询（3 张卡片） */

export interface DashboardCounts {
  tenants: number;
  users: number;
  todayLogins: number;
}

export async function getDashboardCounts(): Promise<DashboardCounts> {
  const tenantsRows = await db.select().from(tenants);
  const usersRows = await db.select().from(users);

  // 「今日登录」= audit_logs 里今天（>= 起始 ISO）的 action='login' 条数
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const isoStart = startOfDay.toISOString().replace("T", " ").slice(0, 19);
  const todayLoginRows = await db
    .select()
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.action, "login"),
        gte(auditLogs.timestamp, isoStart),
      ),
    );

  return {
    tenants: tenantsRows.length,
    users: usersRows.length,
    todayLogins: todayLoginRows.length,
  };
}

// 占位：仪表盘 future 可能需要的 hook（如 latestActivity）
export async function listRecentLoginLogs(limit: number) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return db
    .select()
    .from(auditLogs)
    .where(
      and(eq(auditLogs.action, "login"), like(auditLogs.timestamp, `${today}%`)),
    )
    .limit(limit);
}
