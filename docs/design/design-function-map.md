# 设计与功能对齐 — saas-identity-platform-nextjs

> 人填、人评审。机器只检查功能 ID 存在性。
> 回答一个问题：**这个功能子项，落到哪段代码、哪张表、哪个权限码上？**
> 答不上来的行，说明设计没做完，别开工。

本表覆盖 v0.5.0 auth 批次新落地 / 增强的 7 项 auth fnId。其余 79 项 fnId（M00/M01/M02/M04/M05/M06/M08/M09 + M03.F03.I06 规划）的设计映射在后续批次 / phase 中陆续补。

## 映射表

| 功能子项 ID | 页面/组件 | 接口 | 数据表 | 权限码 | 设计稿 | 状态 |
|---|---|---|---|---|---|---|
| M03.F01.I01 | src/components/app/login-form.tsx (submit Button) | POST /api/v1/auth/login | users + tenants + audit_events | M03.F01.I01 | – | 已上线 |
| M03.F01.I02 | src/lib/login-lockout.ts (loginLockout.isLockedOut/recordFailure) | POST /api/v1/auth/login (429 ACCOUNT_LOCKED) | (进程内 Map) | M03.F01.I02 | – | 已上线 |
| M03.F02.I03 | app/api/v1/auth/oidc/callback/route.ts | POST /api/v1/auth/oidc/callback | apps + users + oauth-store | M03.F02.I03 | – | 开发中 |
| M03.F02.I04 | app/api/v1/auth/refresh/route.ts | POST /api/v1/auth/refresh | oauth-store (refresh tokens) | M03.F02.I04 | – | 已上线 |
| M03.F03.I05 | src/components/app/sidebar-nav.tsx (logout Button) + app/api/v1/auth/logout/route.ts | POST /api/v1/auth/logout | – (best-effort 204) | M03.F03.I05 | – | 已上线 |
| M04.F03.I07 | app/api/v1/oauth/authorize/route.ts | POST /api/v1/oauth/authorize | apps + users + oauth-store (codes) | M04.F03.I07 | – | 已上线 |
| M04.F03.I08 | app/api/v1/oauth/token/route.ts | POST /api/v1/oauth/token (grantType=authorization_code) | apps + audit_events + oauth-store | M04.F03.I08 | – | 已上线 |
| M04.F03.I09 | app/api/v1/oauth/token/route.ts | POST /api/v1/oauth/token (grantType=refresh_token) | oauth-store (refresh rotation) | M04.F03.I09 | – | 已上线 |

## 关键基础设施（与本批 auth 直接相关）

| 文件 | 职责 |
|---|---|
| src/lib/oauth-store.ts | OAuth 2.0 进程内 Map：oauthCodes（一次性）+ oauthRefreshTokens（rotation）+ TTL 懒清理 |
| src/lib/login-lockout.ts | 登录失败计数器：按 username 计失败次数 + 窗口 + 冷却 |
| src/lib/jwt.ts | JWT 解析（base64url 解码；HS256 真签发 Phase 5 延后） |
| src/lib/tenant-guard.ts | verifyPathTenant + TenantGuardError（401 mismatch） |
| src/db/schema.ts | apps (clientId/redirectUris/scopes/grantTypes)、users、tenants、audit_events、tenant_memberships 等 11 表 |

## 约定

1. **权限码 = 功能子项 ID。** 前端按钮的权限判断直接写 ID。
2. 一个接口服务多个子项时，多行重复写（如 /oauth/token 同时服务 M04.F03.I08 / M04.F03.I09）。
3. 状态列必须与功能清单一致。不一致以功能清单为准。

## 评审时问这三个问题

1. 有没有子项没有权限码？→ 那它就是任何人都能点的按钮
2. 有没有一张表被三个以上模块直接写入？→ 边界破了
3. 「开发中」的行里接口和表填了吗？→ 没填就是还在纸上，别报进度

## 后续

- v0.5.0 auth 批次仅覆盖 M03.F03.I05 (logout) + M03.F01/I02 (login + lockout) + M03.F02 (refresh) + M04.F03 (OAuth 2.0) 共 8 个 fnId 的设计映射。
- 剩余 78 项（M00/M01/M02/M04/M05/M06/M08/M09 + M03.F02.I03 需求阶段 + M03.F03.I06 规划）留后续 phase 补设计映射。
- HS256 真签发（Phase 5）+ oauth-store → Redis（Phase 6）+ 真 OIDC 集成（远期）落地后更新对应行状态。