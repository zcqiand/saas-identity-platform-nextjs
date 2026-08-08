// scripts/inspect-seed.mjs —— 把 shared seeds 直插 PG 并对比行数
import "dotenv/config";
import { readFileSync } from "node:fs";
import { Pool } from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL required");
  process.exit(1);
}
const schema = "test_align_" + Date.now().toString(36);
process.env.VITEST_SCHEMA = schema;
const pool = new Pool({ connectionString: url });
await pool.query("CREATE SCHEMA IF NOT EXISTS " + schema);
const admin = new Pool({ connectionString: url, options: "-c search_path=" + schema });
const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8"));
const client = await admin.connect();
await client.query("BEGIN");
for (const e of journal.entries) {
  const raw = readFileSync("drizzle/" + e.tag + ".sql", "utf8");
  const sql = raw.replace(/"public"\./g, "");
  const stmts = sql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const s of stmts) await client.query(s);
}
await client.query("COMMIT");
client.release();

const seeds = await import("../../saas-identity-platform-shared/seeds/index.ts");
const {
  TENANTS,
  USERS,
  DEPARTMENTS,
  POSITIONS,
  ROLE_PERMISSIONS,
  USER_GROUPS,
  USER_GROUP_MEMBERS,
  PERMISSION_GROUPS,
  APPS,
  APP_MENUS,
  API_KEYS,
  OAUTH_SCOPES,
  PLATFORM_SETTINGS,
  AUDIT_LOGS,
  LOGIN_METHODS,
  SSO_PROVIDERS,
  OAUTH2_PROVIDERS,
} = seeds;

function iso(s) {
  return s ? s.replace("T", " ").slice(0, 19) : new Date().toISOString().replace("T", " ").slice(0, 19);
}

// 先 apps → 再 menus（依赖 apps）→ 再 user-groups（无依赖）→ permission-groups（依赖 apps）
await admin.query("BEGIN");
try {
  // tenants / departments / positions / roles / users 先 first
  for (const t of TENANTS)
    await admin.query(
      "INSERT INTO tenants (id, code, name, theme, created_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING",
      [t.id, t.id, t.name, typeof t.theme === "string" ? t.theme : "default", iso()]
    );
  for (const d of DEPARTMENTS)
    await admin.query(
      "INSERT INTO departments (id, tenant_id, name, parent_id, sort, enabled, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING",
      [d.id, d.tenantId, d.name, d.parentId || null, d.sort || 0, d.enabled ?? true, iso(d.createdAt), iso(d.updatedAt || d.createdAt)]
    );
  for (const p of POSITIONS)
    await admin.query(
      "INSERT INTO positions (id, tenant_id, code, name, description, sort, enabled, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING",
      [p.id, p.tenantId, p.code, p.name, p.description || null, p.sort || 0, p.enabled ?? true, iso(p.createdAt), iso(p.updatedAt || p.createdAt)]
    );
  for (const u of USERS)
    await admin.query(
      "INSERT INTO users (id, username, display_name, email, tenant_id, department_id, position_id, roles, status, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT DO NOTHING",
      [u.id, u.username, u.displayName, u.email, u.tenantId, u.departmentId || null, u.positionId || null, u.roles, u.status, iso(u.createdAt), iso(u.updatedAt || u.createdAt)]
    );
  for (const r of ROLE_PERMISSIONS)
    await admin.query(
      "INSERT INTO roles (id, tenant_id, code, name, description, sort, enabled, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING",
      [r.id, r.tenantId, r.code, r.name, r.description || null, r.sort || 0, r.enabled ?? true, iso(r.createdAt), iso(r.updatedAt || r.createdAt)]
    );
  for (const a of APPS)
    await admin.query(
      "INSERT INTO apps (id, code, name, type, description, theme, sort, enabled, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING",
      [a.id, a.code, a.name, a.type || "web", a.description || null, a.theme || null, a.sort || 0, a.enabled ?? true, iso(a.createdAt), iso(a.updatedAt || a.createdAt)]
    );
  // menus: parent first then children
  for (const m of [...APP_MENUS].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0)).filter((x) => !x.parentId))
    try {
      await admin.query(
        "INSERT INTO app_menus (id, app_id, parent_id, code, name, path, icon, permission, sort, enabled, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT DO NOTHING",
        [m.id, m.appId, null, m.code || m.id, m.name, m.path, m.icon || null, m.permission || null, m.sort || 0, m.enabled ?? true, iso(m.createdAt), iso(m.updatedAt || m.createdAt)]
      );
    } catch (e) { console.log('menu parent skip:', m.id, e.message?.slice(0, 80)); }
  for (const m of [...APP_MENUS].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0)).filter((x) => x.parentId))
    try {
      await admin.query(
        "INSERT INTO app_menus (id, app_id, parent_id, code, name, path, icon, permission, sort, enabled, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT DO NOTHING",
        [m.id, m.appId, m.parentId, m.code || m.id, m.name, m.path, m.icon || null, m.permission || null, m.sort || 0, m.enabled ?? true, iso(m.createdAt), iso(m.updatedAt || m.createdAt)]
      );
    } catch (e) { console.log('menu child skip:', m.id, e.message?.slice(0, 80)); }
  for (const g of USER_GROUPS)
    await admin.query(
      "INSERT INTO user_groups (id, tenant_id, name, description, enabled, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING",
      [g.id, g.tenantId, g.name, g.description || null, g.enabled ?? true, iso(g.createdAt), iso(g.updatedAt || g.createdAt)]
    );
  for (const g of USER_GROUPS)
    for (const userId of g.userIds || [])
      await admin.query(
        "INSERT INTO user_group_members (group_id, user_id, joined_at) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING",
        [g.id, userId, iso(g.createdAt)]
      );
  for (const pg of PERMISSION_GROUPS)
    try {
      await admin.query(
        "INSERT INTO permission_groups (id, app_id, name, description, permissions, menu_ids, sort, enabled, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING",
        [pg.id, pg.appId, pg.name, pg.description || null, pg.permissions || [], pg.menuIds || [], pg.sort || 0, pg.enabled ?? true, iso(pg.createdAt), iso(pg.updatedAt || pg.createdAt)]
      );
    } catch (e) { console.log('perm-group skip:', pg.id, e.message?.slice(0, 80)); }
  for (const r of ROLE_PERMISSIONS)
    for (const mp of r.menuPermissions || []) {
      const actions = mp.actions || ["view"];
      const arrayLiteral = "{" + actions.join(",") + "}";
      try {
        await admin.query(
          "INSERT INTO role_menu_permissions (role_id, menu_id, actions, created_at) VALUES ($1,$2,$3::text[],$4) ON CONFLICT DO NOTHING",
          [r.id, mp.menuId, arrayLiteral, iso(r.createdAt)]
        );
      } catch (e) {}
    }
  for (const k of API_KEYS)
    await admin.query(
      "INSERT INTO api_keys (id, name, key, key_prefix, app_id, scopes, last_used_at, enabled, expires_at, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING",
      [k.id, k.name, k.keyPrefix + "_complete_secret", k.keyPrefix, k.appId, k.scopes || ["read"], k.lastUsedAt || null, k.enabled ?? true, k.expiresAt || "never", iso(k.createdAt)]
    );
  for (const s of OAUTH_SCOPES)
    await admin.query(
      "INSERT INTO oauth_scopes (id, app_id, name, description, category, risk_level, enabled) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING",
      [s.id, s.appId, s.name, s.description, s.category, s.riskLevel, s.enabled ?? true]
    );
  for (const ps of PLATFORM_SETTINGS)
    await admin.query(
      "INSERT INTO platform_settings (id, key, value, description, updated_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING",
      [ps.id, ps.id, ps.value, ps.description || null, iso()]
    );
  for (const a of AUDIT_LOGS)
    await admin.query(
      "INSERT INTO audit_logs (id, tenant_id, action, operator, resource, resource_id, ip, detail, timestamp) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING",
      [a.id, a.tenantId || null, a.action, a.operator, a.resource, a.resourceId, a.ip || "127.0.0.1", a.detail || "", iso(a.timestamp)]
    );
  for (const m of LOGIN_METHODS)
    await admin.query(
      "INSERT INTO login_methods (id, method, name, description, enabled, sort) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING",
      [m.id, m.method, m.name, m.description || null, m.enabled, m.sort]
    );
  for (const p of SSO_PROVIDERS)
    await admin.query(
      "INSERT INTO sso_providers (id, name, type, client_id, issuer_url, enabled) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING",
      [p.id, p.name, p.type, p.clientId || p.id, p.issuerUrl || null, p.enabled ?? true]
    );
  for (const p of OAUTH2_PROVIDERS)
    await admin.query(
      "INSERT INTO oauth2_providers (id, name, provider, client_id, enabled) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING",
      [p.id, p.name, p.type || "google", p.clientId || p.id, p.enabled ?? true]
    );
  await admin.query("COMMIT");
} catch (e) {
  await admin.query("ROLLBACK");
  console.error("seed error:", e.message?.slice(0, 200));
  process.exit(1);
}

const tables = [
  "tenants", "users", "departments", "positions", "roles", "role_menu_permissions",
  "user_groups", "user_group_members", "permission_groups", "apps", "app_menus",
  "api_keys", "oauth_scopes", "platform_settings", "audit_logs", "health_check",
  "login_methods", "sso_providers", "oauth2_providers"
];
console.log("table".padEnd(28) + " | shared_seed | pg_after_seed | drift");
for (const t of tables) {
  const r = await admin.query(`SELECT count(*) FROM ${t}`);
  let seedCount;
  if (t === "tenants") seedCount = TENANTS.length;
  else if (t === "users") seedCount = USERS.length;
  else if (t === "departments") seedCount = DEPARTMENTS.length;
  else if (t === "positions") seedCount = POSITIONS.length;
  else if (t === "roles") seedCount = ROLE_PERMISSIONS.length;
  else if (t === "user_groups") seedCount = USER_GROUPS.length;
  else if (t === "user_group_members") seedCount = (USER_GROUPS.reduce((acc, g) => acc + (g.userIds?.length || 0), 0));
  else if (t === "permission_groups") seedCount = PERMISSION_GROUPS.length;
  else if (t === "apps") seedCount = APPS.length;
  else if (t === "app_menus") seedCount = APP_MENUS.length;
  else if (t === "api_keys") seedCount = API_KEYS.length;
  else if (t === "oauth_scopes") seedCount = OAUTH_SCOPES.length;
  else if (t === "platform_settings") seedCount = PLATFORM_SETTINGS.length;
  else if (t === "audit_logs") seedCount = AUDIT_LOGS.length;
  else if (t === "health_check") seedCount = 0;
  else if (t === "login_methods") seedCount = LOGIN_METHODS.length;
  else if (t === "sso_providers") seedCount = SSO_PROVIDERS.length;
  else if (t === "oauth2_providers") seedCount = OAUTH2_PROVIDERS.length;
  else seedCount = "?";
  const actual = parseInt(r.rows[0].count);
  const drift = actual - (typeof seedCount === "number" ? seedCount : 0);
  const driftStr = drift === 0 ? "OK" : (drift > 0 ? "+" + drift : String(drift));
  console.log(
    t.padEnd(28) +
      " | " + String(seedCount).padStart(10) +
      " | " + String(actual).padStart(12) +
      " | " + driftStr
  );
}
await pool.query("DROP SCHEMA " + schema + " CASCADE");
await pool.end();