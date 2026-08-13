// tests/integration/seed-three-way-alignment.test.ts
//
// 三方对齐门禁(Step 9 of DB 对齐 9 步 plan):
// 验证 msw fixture JSON 的 items 数 == manifest 期望;SQL 9 enum 全部注册;
// users.role_ids 三方一致。
//
// 跑法:`npx vitest run tests/integration/seed-three-way-alignment.test.ts`
// 频率:L4 门禁自动包含(每次 sync-db + seed-db 后回归)。

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../../..");
const MSW_SEEDS = resolve(ROOT, "saas-identity-platform-msw/src/seeds");
const SHARED_SQL = resolve(
  ROOT,
  "saas-identity-platform-shared/sql/migrations",
);

function loadSeed(name: string): unknown[] {
  return JSON.parse(readFileSync(resolve(MSW_SEEDS, name), "utf-8"));
}

describe("seed 三方对齐 — msw fixture count == manifest 期望", () => {
  const manifest = JSON.parse(
    readFileSync(resolve(MSW_SEEDS, "manifest.json"), "utf-8"),
  );
  const cases: { file: string; expected: number }[] = (manifest.tables as Array<{
    file: string;
    count: number;
  }>).map((t) => ({ file: t.file, expected: t.count }));

  for (const { file, expected } of cases) {
    it(`${file} msw fixture 长度 == manifest.count (${expected})`, () => {
      const items = loadSeed(file);
      expect(items.length).toBe(expected);
    });
  }
});

describe("shared SQL 9 enum 全部注册(V001-V008)", () => {
  // 9 个 enum,每个 V 文件对应一组
  const expected: Array<{ enum: string; file: string }> = [
    { enum: "tenant_status", file: "V001" },
    { enum: "user_status", file: "V002" },
    { enum: "membership_status", file: "V002" },
    { enum: "api_key_status", file: "V004" },
    { enum: "app_status", file: "V005" },
    { enum: "oauth_grant_type", file: "V005" },
    { enum: "menu_type", file: "V005" },
    { enum: "menu_status", file: "V005" },
    { enum: "audit_action", file: "V006" },
  ];

  for (const { enum: enumName, file } of expected) {
    it(`${enumName} 在 ${file}.sql 里 CREATE TYPE`, () => {
      const path = require("node:path") as typeof import("node:path");
      const fs = require("node:fs") as typeof import("node:fs");
      const files = fs.readdirSync(SHARED_SQL).filter((f) =>
        f.startsWith(file),
      );
      expect(files.length, `${file} 至少 1 个 SQL 文件`).toBeGreaterThanOrEqual(1);
      const sqlAll = files
        .map((f) => fs.readFileSync(path.join(SHARED_SQL, f), "utf-8"))
        .join("\n");
      expect(sqlAll).toContain(`CREATE TYPE ${enumName}`);
    });
  }
});

describe("users.role_ids 三方一致", () => {
  it("msw users.json 5 条都带 roleIds", () => {
    const users = loadSeed("users.json") as Array<{ roleIds?: string[] }>;
    expect(users.length).toBe(5);
    for (const u of users) {
      expect(Array.isArray(u.roleIds)).toBe(true);
    }
  });

  it("shared SQL V008 加 ADD COLUMN role_ids", () => {
    const fs = require("node:fs") as typeof import("node:fs");
    const v008 = fs
      .readdirSync(SHARED_SQL)
      .find((f) => f.startsWith("V008"));
    expect(v008, "V008 SQL 文件必须存在").toBeDefined();
    const sql = fs.readFileSync(resolve(SHARED_SQL, v008!), "utf-8");
    expect(sql).toMatch(/ADD COLUMN.*role_ids/);
  });

  it("nextjs Drizzle schema.ts:128 有 roleIds 字段", () => {
    const fs = require("node:fs") as typeof import("node:fs");
    const schema = fs.readFileSync(
      resolve(ROOT, "saas-identity-platform-nextjs/src/db/schema.ts"),
      "utf-8",
    );
    expect(schema).toMatch(/roleIds:\s+uuid\("role_ids"\)/);
  });
});

describe("role_menu_grants.tenantId 三方一致", () => {
  it("msw role-menu-grants.json 3 条都带 tenantId", () => {
    const grants = loadSeed("role-menu-grants.json") as Array<{
      tenantId?: string;
    }>;
    expect(grants.length).toBe(3);
    for (const g of grants) {
      expect(typeof g.tenantId).toBe("string");
    }
  });

  it("shared TypeSpec role-menu-grant.tsp 有 tenantId", () => {
    const fs = require("node:fs") as typeof import("node:fs");
    const tsp = fs.readFileSync(
      resolve(
        ROOT,
        "saas-identity-platform-shared/tsp/models/role-menu-grant.tsp",
      ),
      "utf-8",
    );
    expect(tsp).toMatch(/tenantId:\s+string/);
  });
});
