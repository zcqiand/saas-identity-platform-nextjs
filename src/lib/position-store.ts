import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { positions, type NewPosition, type Position } from "@/db/schema";

/** M02.F03.I05 — 岗位管理 store（CRUD + members）
 *  v0.3.0：PK 改 text；tenantId required
 */

export async function listPositions(): Promise<Position[]> {
  return db.select().from(positions);
}

export async function getPosition(id: string): Promise<Position | null> {
  const [row] = await db.select().from(positions).where(eq(positions.id, id));
  return row ?? null;
}

export async function createPosition(input: {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  description?: string;
  sort?: number;
  enabled?: boolean;
}): Promise<Position> {
  const [row] = await db
    .insert(positions)
    .values({
      id: input.id,
      tenantId: input.tenantId,
      code: input.code,
      name: input.name,
      description: input.description,
      sort: input.sort ?? 0,
      enabled: input.enabled ?? true,
    } satisfies Omit<NewPosition, "createdAt" | "updatedAt">)
    .returning();
  return row!;
}

export async function updatePosition(
  id: string,
  patch: {
    name?: string;
    description?: string;
    sort?: number;
    enabled?: boolean;
  },
): Promise<Position | null> {
  const existing = await getPosition(id);
  if (!existing) return null;
  const merged: NewPosition = {
    ...existing,
    name: patch.name ?? existing.name,
    description: patch.description ?? existing.description,
    sort: patch.sort ?? existing.sort,
    enabled: patch.enabled ?? existing.enabled,
  };
  await db.update(positions)
    .set({
      name: merged.name,
      description: merged.description,
      sort: merged.sort,
      enabled: merged.enabled,
    })
    .where(eq(positions.id, id));
  return getPosition(id);
}

export async function deletePosition(id: string): Promise<boolean> {
  const result = await db.delete(positions).where(eq(positions.id, id));
  return (result.rowCount ?? 0) > 0;
}