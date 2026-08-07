import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { loginSecurity, type LoginSecurity, type NewLoginSecurity } from "@/db/schema";

const SINGLETON_ID = "default";

export async function getLoginSecurity(): Promise<LoginSecurity | null> {
  const [row] = await db
    .select()
    .from(loginSecurity)
    .where(eq(loginSecurity.id, SINGLETON_ID))
    .orderBy(asc(loginSecurity.updatedAt));
  return row ?? null;
}

export async function upsertLoginSecurity(
  values: Omit<NewLoginSecurity, "id" | "updatedAt">,
): Promise<LoginSecurity> {
  const existing = await getLoginSecurity();
  if (existing) {
    const merged: NewLoginSecurity = { ...existing, ...values };
    await db
      .update(loginSecurity)
      .set({
        ipWhitelist: merged.ipWhitelist,
        ipBlacklist: merged.ipBlacklist,
        regionRestrictionEnabled: merged.regionRestrictionEnabled,
        allowedRegions: merged.allowedRegions,
        failedAttemptLockEnabled: merged.failedAttemptLockEnabled,
        lockThreshold: merged.lockThreshold,
        lockDuration: merged.lockDuration,
      })
      .where(eq(loginSecurity.id, existing.id));
    const updated = await getLoginSecurity();
    if (!updated) throw new Error("login_security row missing after upsert");
    return updated;
  }
  const [row] = await db
    .insert(loginSecurity)
    .values({ id: SINGLETON_ID, ...values })
    .returning();
  if (!row) throw new Error("login_security insert returned no row");
  return row;
}
