# M03.F02.I03 — OIDC Code 换取（dev pseudo-OIDC）

> v0.5.0 auth 批次落地。开发中状态（路由已加，fnTest 未覆盖）。

## 要什么

提供一个 `POST /api/v1/auth/oidc/callback` 端点，接受 IdP 回调（dev 模式信任客户端传回的 `code` + `state`），按 `clientId` 找 App，签发 access token + refresh token，回 `TokenResponse`。语义与 saas-identity-platform-msw `handlers-extra.ts:315-491` 同款。

## 怎么算做到了

- `POST /api/v1/auth/oidc/callback` 存在且 200 响应 `TokenResponse { accessToken, refreshToken, tokenType, expiresIn, scope }`
- `accessToken` 形如 `saas-jwt-${userId}-${nonce}`
- `refreshToken` 形如 `saas-rt-${userId}-${nonce}-${rand}`，写入 `oauthStore.putRefresh`（可被后续 `/oauth/token grantType=refresh_token` rotation）
- 缺字段 → `400 INVALID_REQUEST`；clientId 未注册 → `400 INVALID_CLIENT`；dev 系统无 active 用户 → `400 NO_USER`
- 与 `/api/v1/oauth/token grantType=authorization_code` 行为对齐：code 一次性 + redirectUri 比对 + tenantId 比对
- fnTest：`tests/integration/auth-oidc-callback.test.ts` 4 个 `it()`（valid / invalid body / invalid clientId / no user），fnReporter 自动写入 `.state/trace.json`

## 动了哪些功能

| ID | | 风险 |
|---|---|---|
| M03.F02.I03 | dev pseudo-OIDC：信任客户端回传 code，不接真 IdP；生产必须切换到真 OIDC provider（`OIDC_ISSUER` / `OIDC_CLIENT_SECRET` 已留 env 但未启用） | 中 |
| M03.F02.I04 | 同 oauthStore.putRefresh store，与 refresh 路径共享：refresh_token 必须在 oauth-store 进程内 Map 中存在，否则 rotation 失败 | 低 |
| M03.F01.I02 | OIDC 路径不经过 loginLockout（直发 token），失败计数器只覆盖 username 密码登录路径 | 低 |

## dev 阶段简化

dev 不接真 IdP，而是从 `apps` 表找 `clientId` 对应 App，从 `users` 表取任一 active 用户作为 dev mock 用户。这与 msw handler-extra.ts:362 「dev mock 用 clientId 直接绑定到第一个匹配用户」语义对齐。

## 远期 TODO

- 接真 OIDC provider（`OIDC_ISSUER` 验证 issuer claim、`OIDC_CLIENT_SECRET` 验签 ID token、`clientId` 白名单）
- 增加 `state` 持久化校验（防 CSRF）：把 authorize 阶段生成的 state 存进 oauthCodes，callback 阶段比对
- 增加 `nonce` claim 校验（防 replay）

## 参考

- 设计映射：[../design/design-function-map.md](../design/design-function-map.md) M03.F02.I03 行
- msw 语义源：`../../saas-identity-platform-msw/src/handlers-extra.ts:315-491`
- TypeSpec DTO：[../../saas-identity-platform-shared/generated/openapi/openapi.yaml](../../../saas-identity-platform-shared/generated/openapi/openapi.yaml) `OidcCallbackRequest`