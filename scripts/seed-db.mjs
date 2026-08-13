// scripts/seed-db.mjs - 把 @saas/identity-platform-msw 的 seeds/*.json 灌到 PG 库。
//
// 背景：nextjs-self 模式下 Route Handler 直读 PG（saas_dev）。表由 sync-db.mjs 建好
// （12 表 + 9 enum）但空。本脚本读相邻 msw 仓的 seeds JSON，做字段映射后按 FK
// 顺序灌入 9 张有 seed 的表（permissions / role_permissions / audit_retention_policies
// seed 无数据，不灌，保持空）。
//
// 关键映射（PG 列强类型 uuid，而 MSW seeds 的 id 混用三种格式）：
//  - 合法 UUID（仅 tenants.id）：resolveId 透传
//  - 超长可读串（users/roles/api_keys/memberships/audit_events 的 id，形如
//    "00000000-...-000001-user-alice"）：resolveId -> 确定性 UUID
//  - 语义键（apps.id "app-lab"、menus.id "m-lab-dash"）：resolveId -> 确定性 UUID
//  所有【id 与指向它的 FK】用同一个 resolveId(原值)，保证 FK 一致
//  （如 memberships.user_id 与 users.id 同 key -> 同 UUID）。
//  确定性来自 sha256：同一字符串永远映射到同一 UUID。
//
//  其他映射：
//  - camelCase -> snake_case 列名（显式列）
//  - shared SQL V002 的 users 表【没有】role_ids 列（drizzle schema 超前加了但 SQL SSOT
//    未落地）；role 关系由 tenant_memberships.role_ids 承载
//  - 缺字段补默认：tenants.settings={} / api_keys.secret_hash=dev 占位 /
//    apps.client_secret_hash=dev 占位 / audit_events.metadata={}
//  - role_menu_grants 缺 tenantId：从 roleId 反查 roles.tenantId 补上
//  - roles.permissionIds（schema 无此列，permissions 是独立表）：忽略
//  - menus.parent_id 自引用 FK（V005 menus_parent_fk）：分两批插，先 null 后非-null
//
// 幂等：默认先 TRUNCATE 12 张表 RESTART IDENTITY CASCADE，再灌。可重跑。
//
// 用法：
//   node scripts/seed-db.mjs                     # 默认连 saas_dev
//   DATABASE_URL=postgresql://... node scripts/seed-db.mjs

import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const NEXTJS_ROOT = resolve(__dirname, "..");
const MSW_SEEDS_DIR = resolve(
  NEXTJS_ROOT,
  "../saas-identity-platform-msw/src/seeds",
);

// 借 nextjs 的 pg driver（与 sync-db.mjs 同套路；shared 仓禁 runtime 依赖）
const require = createRequire(resolve(NEXTJS_ROOT, "package.json"));
const pg = require("pg");

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:qiand68%2B%2B%2B@100.79.128.25:5432/saas_dev";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── 任意 id -> 合法 uuid（合法则透传，否则 sha256 派生确定性 UUID）─────────────
// 确定性：同一字符串永远产出同一 UUID，故 users.id 与 memberships.user_id 用同一
// 原值时必然落到同一 UUID，FK 完整。
const uuidCache = new Map();
function keyToUuid(key) {
  const cached = uuidCache.get(key);
  if (cached) return cached;
  const b = createHash("sha256").update(key).digest().subarray(0, 16);
  b[6] = (b[6] & 0x0f) | 0x40; // version 4
  b[8] = (b[8] & 0x3f) | 0x80; // variant
  const hex = b.toString("hex");
  const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  uuidCache.set(key, uuid);
  return uuid;
}
function resolveId(id) {
  return id && UUID_RE.test(id) ? id : keyToUuid(id);
}

function loadJson(name) {
  return JSON.parse(readFileSync(resolve(MSW_SEEDS_DIR, name), "utf-8"));
}

const client = new pg.Client({
  connectionString: DATABASE_URL,
  connectionTimeoutMillis: 10000,
});

async function insertAll(table, columns, rows) {
  const colList = columns.join(", ");
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
  const sql = `INSERT INTO ${table} (${colList}) VALUES (${placeholders})`;
  for (const row of rows) {
    await client.query(sql, row);
  }
}

try {
  console.log(
    `[seed-db] 连接 ${DATABASE_URL.replace(/:[^:@/]+@/, ":***@")} ...`,
  );
  await client.connect();
  console.log("[seed-db] 已连接。");

  const tenants = loadJson("tenants.json");
  const users = loadJson("users.json");
  const roles = loadJson("roles.json");
  const permissions = loadJson("permissions.json");
  const rolePermissions = loadJson("role-permissions.json");
  const memberships = loadJson("memberships.json");
  const apiKeys = loadJson("api-keys.json");
  const apps = loadJson("apps.json");
  const menus = loadJson("menus.json");
  const roleMenuGrants = loadJson("role-menu-grants.json");
  const auditEvents = loadJson("audit-events.json");
  const auditRetentionPolicies = loadJson("audit-retention-policies.json");

  console.log(
    `[seed-db] 读入 seeds：tenants=${tenants.length} users=${users.length} ` +
      `roles=${roles.length} permissions=${permissions.length} role_permissions=${rolePermissions.length} ` +
      `memberships=${memberships.length} api_keys=${apiKeys.length} ` +
      `apps=${apps.length} menus=${menus.length} role_menu_grants=${roleMenuGrants.length} ` +
      `audit_events=${auditEvents.length} audit_retention_policies=${auditRetentionPolicies.length}`,
  );

  // ── 幂等：清空 12 张表（不动 __schema_migrations tracking 表）──────────────
  await client.query(
    `TRUNCATE TABLE
       tenants, users, tenant_memberships, roles, permissions, role_permissions,
       api_keys, apps, menus, role_menu_grants, audit_events, audit_retention_policies
     RESTART IDENTITY CASCADE`,
  );
  console.log("[seed-db] 已清空 12 张表（RESTART IDENTITY CASCADE）。");

  // 1. tenants（补 settings={}）
  await insertAll(
    "tenants",
    ["id", "code", "name", "status", "settings", "created_at", "updated_at"],
    tenants.map((t) => [resolveId(t.id), t.code, t.name, t.status, {}, t.createdAt, t.updatedAt]),
  );
  console.log(`[seed-db] tenants: ${tenants.length}`);

  // 2. users（display_name/password_hash=null；role_ids V008 才落地——见文件头注释）
  await insertAll(
    "users",
    [
      "id", "tenant_id", "username", "email", "display_name", "status",
      "password_hash", "role_ids", "created_at", "updated_at",
    ],
    users.map((u) => [
      resolveId(u.id), resolveId(u.tenantId), u.username, u.email,
      u.displayName ?? null, u.status, "plain:dev123456",  // dev-only placeholder; prod must be argon2/bcrypt hash via OAuth password grant
      (u.roleIds ?? []).map(resolveId),
      u.createdAt, u.updatedAt,
    ]),
  );
  console.log(`[seed-db] users: ${users.length}`);

  // 3. roles（忽略 permissionIds；description=null）
  await insertAll(
    "roles",
    ["id", "tenant_id", "code", "name", "description", "created_at", "updated_at"],
    roles.map((r) => [resolveId(r.id), resolveId(r.tenantId), r.code, r.name, null, r.createdAt, r.updatedAt]),
  );
  console.log(`[seed-db] roles: ${roles.length}`);

  // 3.5 permissions（v0.4.1 补：4 code 与 roles.permissionIds 对齐；无 FK 依赖，先灌）
  await insertAll(
    "permissions",
    ["id", "code", "name", "description", "created_at"],
    permissions.map((p) => [
      resolveId(p.code), p.code, p.name, p.description ?? null, new Date().toISOString(),
    ]),
  );
  console.log(`[seed-db] permissions: ${permissions.length}`);

  // 3.6 role_permissions（PK=(role_id, permission_id)；roleId 与 roles.id 对齐,permissionCode 与 permissions.id 对齐）
  await insertAll(
    "role_permissions",
    ["role_id", "permission_id", "granted_at"],
    rolePermissions.map((rp) => [
      resolveId(rp.roleId), resolveId(rp.permissionCode), new Date().toISOString(),
    ]),
  );
  console.log(`[seed-db] role_permissions: ${rolePermissions.length}`);

  // 4. tenant_memberships（id/user_id/role_ids 全 resolveId，与 users/roles 对齐）
  await insertAll(
    "tenant_memberships",
    ["id", "user_id", "tenant_id", "role_ids", "status", "joined_at"],
    memberships.map((m) => [
      resolveId(m.id), resolveId(m.userId), resolveId(m.tenantId),
      (m.roleIds ?? []).map(resolveId), m.status, m.joinedAt,
    ]),
  );
  console.log(`[seed-db] tenant_memberships: ${memberships.length}`);

  // 5. api_keys（secret_hash=dev 占位；last_used_at/revoked_at/expires_at 可空）
  await insertAll(
    "api_keys",
    [
      "id", "tenant_id", "name", "prefix", "secret_hash", "status", "scopes",
      "created_at", "last_used_at", "expires_at", "revoked_at",
    ],
    apiKeys.map((k) => [
      resolveId(k.id), resolveId(k.tenantId), k.name, k.prefix,
      "dev-placeholder-hash",  // dev-only placeholder; prod must be argon2/bcrypt
      k.status, k.scopes ?? [], k.createdAt,
      null, k.expiresAt ?? null, null,
    ]),
  );
  console.log(`[seed-db] api_keys: ${apiKeys.length}`);

  // 6. apps（id 语义键 -> UUID；client_secret_hash=dev 占位）
  await insertAll(
    "apps",
    [
      "id", "code", "name", "description", "icon", "sort_order", "status",
      "client_id", "client_secret_hash", "redirect_uris", "scopes", "grant_types",
      "is_first_party", "created_at", "updated_at",
    ],
    apps.map((a) => [
      resolveId(a.id), a.code, a.name, a.description ?? null, a.icon ?? null,
      a.sortOrder ?? 0, a.status, a.clientId, "dev-placeholder-hash",  // dev-only placeholder; prod must be argon2/bcrypt
      a.redirectUris ?? [], a.scopes ?? [], a.grantTypes ?? [],
      a.isFirstParty ?? false, a.createdAt, a.updatedAt,
    ]),
  );
  console.log(`[seed-db] apps: ${apps.length}`);

  // 7. menus（id/appId/parentId 全 resolveId；parent_id 自引用 FK，分两批：
  //    先 parentId=null 后非-null，保证 child 插入时 parent 已存在）
  const menuCols = [
    "id", "app_id", "parent_id", "code", "name", "path", "icon", "type",
    "sort_order", "status", "created_at", "updated_at",
  ];
  const mapMenu = (m) => [
    resolveId(m.id), resolveId(m.appId),
    m.parentId ? resolveId(m.parentId) : null,
    m.code, m.name, m.path ?? null, m.icon ?? null, m.type,
    m.sortOrder ?? 0, m.status, m.createdAt, m.updatedAt,
  ];
  const menusNullParent = menus.filter((m) => !m.parentId);
  const menusWithParent = menus.filter((m) => m.parentId);
  await insertAll("menus", menuCols, menusNullParent.map(mapMenu));
  await insertAll("menus", menuCols, menusWithParent.map(mapMenu));
  console.log(
    `[seed-db] menus: ${menus.length}（null-parent ${menusNullParent.length} + with-parent ${menusWithParent.length}）`,
  );

  // 8. role_menu_grants（role_id/tenant_id/menu_ids 全 resolveId；TypeSpec RoleMenuGrant 加了 tenantId 字段后直接读 fixture）
  await insertAll(
    "role_menu_grants",
    ["role_id", "tenant_id", "menu_ids", "updated_at"],
    roleMenuGrants.map((g) => [
      resolveId(g.roleId), resolveId(g.tenantId),
      (g.menuIds ?? []).map(resolveId), g.updatedAt,
    ]),
  );
  console.log(`[seed-db] role_menu_grants: ${roleMenuGrants.length}`);

  // 9. audit_events（id/actor/target 全 resolveId；metadata={}）
  await insertAll(
    "audit_events",
    ["id", "tenant_id", "actor_user_id", "action", "target_user_id", "metadata", "occurred_at"],
    auditEvents.map((e) => [
      resolveId(e.id), resolveId(e.tenantId), e.actorUserId ? resolveId(e.actorUserId) : null,
      e.action, e.targetUserId ? resolveId(e.targetUserId) : null, {}, e.occurredAt,
    ]),
  );
  console.log(`[seed-db] audit_events: ${auditEvents.length}`);

  // 10. audit_retention_policies（v0.4.1 补：每租户 1 行 90 天 retention）
  await insertAll(
    "audit_retention_policies",
    ["tenant_id", "retention_days", "updated_at"],
    auditRetentionPolicies.map((p) => [
      resolveId(p.tenantId), p.retentionDays, p.updatedAt,
    ]),
  );
  console.log(`[seed-db] audit_retention_policies: ${auditRetentionPolicies.length}`);

  // ── 验证 count ────────────────────────────────────────────────────────────
  const tables = [
    "tenants", "users", "tenant_memberships", "roles", "permissions",
    "role_permissions", "api_keys", "apps", "menus", "role_menu_grants",
    "audit_events", "audit_retention_policies",
  ];
  console.log("\n[seed-db] 验证（各表行数）：");
  for (const t of tables) {
    const { rows } = await client.query(
      `SELECT count(*)::int AS c FROM ${t}`,
    );
    console.log(`  ${t.padEnd(26)} ${rows[0].c}`);
  }
  console.log("\n[seed-db] ✅ 灌库完成。");
} catch (err) {
  console.error("\n[seed-db] ERROR:", err.message);
  if (err.position) console.error("  位置（字节）:", err.position);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
