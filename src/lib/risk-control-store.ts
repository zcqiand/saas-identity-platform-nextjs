/**
 * M06.F09.I04 风控配置 singleton — risk_control 表 store
 *
 * 数据：Drizzle 直查 src/db/schema.ts 的 riskControl 表。
 * 单例：id 固定为 "default"；get 返回该行（不存在则取首行）；upsert 不存在则插入。
 */
import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { riskControl, type NewRiskControl, type RiskControl } from "@/db/schema";

const SINGLETON_ID = "default";

export async function getRiskControl(): Promise<RiskControl | null> {
  const [row] = await db
    .select()
    .from(riskControl)
    .where(eq(riskControl.id, SINGLETON_ID))
    .orderBy(asc(riskControl.updatedAt));
  return row ?? null;
}

export async function upsertRiskControl(
  values: Omit<NewRiskControl, "id" | "updatedAt">,
): Promise<RiskControl> {
  const existing = await getRiskControl();
  if (existing) {
    const merged: NewRiskControl = { ...existing, ...values };
    await db
      .update(riskControl)
      .set({
        anomalyDetectionEnabled: merged.anomalyDetectionEnabled,
        crossRegionAlertEnabled: merged.crossRegionAlertEnabled,
        deviceFingerprintEnabled: merged.deviceFingerprintEnabled,
        riskScoreThreshold: merged.riskScoreThreshold,
      })
      .where(eq(riskControl.id, existing.id));
    const updated = await getRiskControl();
    if (!updated) throw new Error("risk_control row missing after upsert");
    return updated;
  }
  const [row] = await db
    .insert(riskControl)
    .values({ id: SINGLETON_ID, ...values })
    .returning();
  if (!row) throw new Error("risk_control insert returned no row");
  return row;
}