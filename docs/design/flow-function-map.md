# 流程与功能对齐 — saas-identity-platform-nextjs

> 业务流程图与功能清单映射。机器从「### 孤儿功能」段读取白名单（未在任何流程的 已上线 子项）。

## 流程：账号密码登录 → 业务操作 → 登出（M03.F01 + M03.F02 + M03.F03）

```
[用户] 打开 /login
   ↓
LoginForm.submit (data-fn=M03.F01.I01)
   ↓
POST /api/v1/auth/login  {username, password, [tenantCode]}
   ↓ loginLockout.isLockedOut(username)
   ├─ true  → 429 ACCOUNT_LOCKED          (M03.F01.I02)
   └─ false → 校验 users.passwordHash
              ├─ 失败 → loginLockout.recordFailure
              │        + audit_events INSERT login_failed (M03.F01.I01)
              │        → 401 UNAUTHORIZED
              └─ 成功 → loginLockout.clearFailures
                       + audit_events INSERT login_success  (M03.F01.I01)
                       → 200 LoginResponse {accessToken, refreshToken, …}

[前端] 保存 accessToken + refreshToken (localStorage)
   ↓ 调后续业务 API 时，axios 拦截器加 Authorization: Bearer <accessToken>

[某业务 API] → JWT 验签失败 → 401
   ↓
POST /api/v1/auth/refresh  {refreshToken, clientId, tenantId}    (M03.F02.I04)
   ↓ oauthStore.rotateRefresh
   ├─ 不存在 / 已用 → 400 INVALID_GRANT
   └─ 存在 → 删除旧 + 签新对 (saas-jwt-… + saas-rt-…)
            + oauthStore.putRefresh(new)
            → 200 TokenResponse

[用户] 点 sidebar 「登出」按钮
   ↓
POST /api/v1/auth/logout  (Authorization: Bearer <token>)         (M03.F03.I05)
   ├─ token 缺失 / 无效 / 解析失败 → 仍 204 (best-effort)
   └─ token 有效 → 204 (服务端无状态 JWT，不维护 server-side session)
   ↓
[前端] 清 localStorage → router.replace('/login')
```

涉及 fnId：
- M03.F01.I01 — 账号密码登录（api + UI 按钮）
- M03.F01.I02 — 登录失败锁定（不可见：失败 N 次 → 429）
- M03.F02.I04 — refresh token 旋转
- M03.F03.I05 — 登出（本地清理）

## 流程：OIDC 回调（dev pseudo-OIDC；M03.F02.I03）

```
[前端] 调用方（lab-react / lab-vue / lab-nextjs 自己）
   ├─ window.location 跳 OIDC provider authorize URL（dev 占位：直接构造 code+state）
   └─ 用户授权 → provider 回跳 redirect_uri?code=…&state=…

POST /api/v1/auth/oidc/callback  {code, state, clientId}    (M03.F02.I03)
   ├─ 缺字段 → 400 INVALID_REQUEST
   ├─ clientId 未注册 → 400 INVALID_CLIENT
   ├─ 无 active 用户 → 400 NO_USER
   └─ 成功 → oauthStore.putRefresh(saas-rt-…)
            → 200 TokenResponse {accessToken: saas-jwt-…, refreshToken: saas-rt-…, scope: "openid"}

[前端] 后续 refresh 走 /api/v1/oauth/token grantType=refresh_token (M04.F03.I09)
```

涉及 fnId：
- M03.F02.I03 — OIDC Code 换取（dev pseudo-OIDC）

注：OIDC 回调产出的 refresh_token 进入 oauthStore 后，可走 `/api/v1/oauth/token grantType=refresh_token` 旋转，与 M03.F02.I04 共享同一 in-memory Map。

## 流程：OAuth 2.0 授权码 / 令牌（M04.F03）

```
[OAuth client] 想代表用户访问资源
   ↓
POST /api/v1/oauth/authorize  {clientId, redirectUri, responseType: "code", scope, state, tenantId}    (M04.F03.I07)
   ├─ 缺字段 → 400 INVALID_REQUEST
   ├─ responseType != "code" → 400 UNSUPPORTED_RESPONSE_TYPE
   ├─ clientId 未注册 → 400 INVALID_CLIENT
   ├─ redirectUri 不在 apps.redirectUris 白名单 → 400 INVALID_REDIRECT_URI
   ├─ tenant 下无用户 → 400 NO_USER
   └─ 成功 → oauthStore.putCode(saas-code-${ts}-${rand}, {appId, userId, tenantId, scope, redirectUri})
            → 200 {code, state}

[OAuth client] 收到 code 后调 token endpoint
   ↓
POST /api/v1/oauth/token  {grantType: "authorization_code", code, redirectUri, clientId, tenantId}    (M04.F03.I08)
   ├─ code 不存在 / 已用 → 400 INVALID_GRANT
   ├─ redirectUri 不匹配 → 400 INVALID_GRANT
   ├─ tenantId 不匹配 → 400 INVALID_GRANT
   └─ 成功 → oauthStore.consumeCode (一次性)
            + 签 saas-jwt-${userId}-${nonce} (M04.F03.I08 accessToken)
            + 签 saas-rt-${userId}-${nonce}-${rand} (refreshToken)
            + oauthStore.putRefresh(refreshToken, entry)
            + audit_events INSERT oauth_token_issued
            → 200 TokenResponse {accessToken, refreshToken, tokenType, expiresIn, scope}

[OAuth client] accessToken 过期后调 refresh
   ↓
POST /api/v1/oauth/token  {grantType: "refresh_token", refreshToken, clientId, tenantId}    (M04.F03.I09)
   ├─ refreshToken 不存在 / 已旋转 → 400 INVALID_GRANT
   └─ 成功 → oauthStore.rotateRefresh (旧删新发)
            + 签 saas-jwt-… + saas-rt-…
            + oauthStore.putRefresh(new)
            → 200 TokenResponse {accessToken, refreshToken, …}
```

涉及 fnId：
- M04.F03.I07 — 授权码签发（/oauth/authorize）
- M04.F03.I08 — 令牌交换（/oauth/token grantType=authorization_code）
- M04.F03.I09 — 令牌刷新（/oauth/token grantType=refresh_token；与 /api/v1/auth/refresh 同 store）

### 孤儿功能

| 子项 ID | 名称 | 类型 | 已上线原因（不在流程图） |
|---|---|---|---|
| M01.F01.I02 | 创建用户（POST /tenants/:t/users，status 固定 active，写 user_created 审计） | 接口 | 跨端契约对齐 oracle（saas-msw）+ 共享 PG 真后端；当前无 UI 表单挂 data-fn（不在「登录 → 操作 → 登出」流程内）；后续若挂 UI 入口再迁入流程 |
| M05.F01.I05 | 物理删 API Key（DELETE /tenants/:t/api-keys/:k，幂等返 204 / 404，无 audit） | 接口 | 跨端契约对齐 oracle；与 M05.F01.I03 revoke 软删并存；tenant admin 操作用，无前端 UI 入口 |
| M09.F02.I02 | 设置角色菜单（PUT /tenants/:t/roles/:r/menus，整批替换 role_menu_grants） | 接口 | tenant admin 操作用；前端角色管理页 M09.F02 流程图尚未落地（v0.x 路线图） |

（M03.F01.I02 login lockout 已纳入 M03.F01.I01 login 流程内。）