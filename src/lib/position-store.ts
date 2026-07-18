import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { positions, type NewPosition, type Position } from "@/db/schema";

/** M02.F03.I05 — 岗位管理 store（CRUD + members） */

export function listPositions(): Position[] {
  return db.select().from(positions).all();
}

export function getPosition(id: number): Position | null {
  return db.select().from(positions).where(eq(positions.id, id)).get() ?? null;
}

export function createPosition(input: {
  code: string;
  name: string;
  description?: string;
  sort?: number;
  enabled?: boolean;
}): Position {
  return db
    .insert(positions)
    .values({
      code: input.code,
      name: input.name,
      description: input.description,
      sort: input.sort ?? 0,
      enabled: input.enabled ?? true,
    })
    .returning()
    .get();
}

export function updatePosition(
  id: number,
  patch: {
    name?: string;
    description?: string;
    sort?: number;
    enabled?: boolean;
  },
): Position | null {
  const existing = getPosition(id);
  if (!existing) return null;
  const merged: NewPosition = {
    ...existing,
    name: patch.name ?? existing.name,
    description: patch.description ?? existing.description,
    sort: patch.sort ?? existing.sort,
    enabled: patch.enabled ?? existing.enabled,
  };
  db.update(positions)
    .set({
      name: merged.name,
      description: merged.description,
      sort: merged.sort,
      enabled: merged.enabled,
    })
    .where(eq(positions.id, id))
    .run();
  return getPosition(id);
}

export function deletePosition(id: number): boolean {
  const result = db.delete(positions).where(eq(positions.id, id)).run();
  return result.changes > 0;
}