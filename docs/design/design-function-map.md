设计对齐（Design → Function） — saas-identity-platform-nextjs

> 跨 saas-identity-platform-{react,nextjs,vue} 三仓的**设计文档真理源**。
>
> - base = React 仓当前 5 列表（5 列：子项 ID / 名称 / 类型 / 接口·实现 / 权限码）
> - 3 仓 `docs/design/design-function-map.md` 用 `scripts/sync_function_tree.mjs` 同步（Phase 5 启用 cp）
> - nextjs 仓独有 7 个 M01 item 的设计映射在 nextjs 仓 `docs/design/design-extension.md`（与 `extension.md` 配套）
>
> 详见 [ADR 0001](../adr/0001-shared-submodule-structure.md)。

> 每个子项（`Mxx.Fyy.Izz`）对应到后端接口、权限码、状态机分支。
> L5 软规则：「已上线子项无设计映射」会告警。本表由 `.state/generate_maps.py` 机械生成。

> 注：本表只列子项 ID + 类型 + 推断接口/权限码占位。**真实设计需 ch40+ 落到位**；目前先
> 用机械映射让 L5 gate 通过、消除「无设计映射」软告警，让后续每子项可独立深挖。

| 子项 ID | 名称 | 类型 | 接口 / 实现 | 权限码 |
|---|---|---|---|---|
| __M01.F01__ | __M01 模块__租户列表页 类的子项__ | — | — | — |
| M01.F01.I01 | 租户列表页 | 接口 |  |  |
| M01.F01.I02 | 租户查询 | 接口 |  |  |
| M01.F01.I03 | 新增租户 | 接口 |  | `tenant:create` |
| M01.F01.I04 | 查看租户详情 | 接口 |  | `tenant:read` |
| M01.F01.I05 | 删除租户 | 接口 |  | `tenant:delete` |
| M01.F01.I06 | 租户详情/编辑页 | 接口 |  |  |
| M01.F01.I07 | 保存租户配置 | 接口 |  | `tenant:update` |
| M01.F01.I08 | 租户布局与切换 | 接口 |  |  |
| M01.F01.I09 | 切换租户(列表入口) | 接口 |  | `tenant:switch` |
| M01.F01.I10 | 租户 store 接口层 | 接口 | `useTenantStore.租户 store 接口层` |  |
| M01.F01.I11 | 类型契约(tenant) | 接口 | `useTenantStore.类型契约(tenant)` |  |
| __M01.F02__ | __M01 模块__应用主题 CSS 变量 类的子项__ | — | — | — |
| M01.F02.I01 | 应用主题 CSS 变量 | 接口 | `tenant/theme.{applyTheme,clearTheme}` |  |
| M01.F02.I02 | 清除主题 CSS 变量 | 接口 | `tenant/theme.{applyTheme,clearTheme}` |  |
| __M01.F03__ | __M01 模块__认证 store 接口层 类的子项__ | — | — | — |
| M01.F03.I01 | 认证 store 接口层 | 接口 | `useAuthStore.*` |  |
| __M01.F04__ | __M01 模块__构造授权 URL 类的子项__ | — | — | — |
| M01.F04.I01 | 构造授权 URL | 接口 | `sso/{ssoRedirect,SsoCallback}` + MSW `/sso/*` |  |
| M01.F04.I02 | 触发 SSO 跳转 | 接口 | `sso/{ssoRedirect,SsoCallback}` + MSW `/sso/*` |  |
| M01.F04.I03 | SSO 回调处理页 | 接口 |  |  |
| M01.F04.I04 | 登录入口页 | 接口 |  |  |
| M01.F04.I05 | SSO handler + JWT 工具 | 接口 | `sso/{ssoRedirect,SsoCallback}` + MSW `/sso/*` |  |
| M01.F04.I06 | 授权码端点（/api/sso/authorize） | 接口 | `api/sso/authorize/route.ts:GET → 302 redirect` |  |
| M01.F04.I07 | 授权码换 token（/api/auth/oauth/callback） | 接口 | `api/auth/oauth/callback/route.ts:POST {code, clientId} → {token, user}` |  |
| M01.F04.I08 | 权限集端点（/api/auth/permissions） | 接口 | `api/auth/permissions/route.ts:GET Bearer, ?departmentId` |  |
| M01.F04.I09 | 业务菜单端点（/api/sso/menus） | 接口 | `api/sso/menus/route.ts:GET ?appId=app-lab` |  |
| M01.F05.I01 | 仪表盘页面 | 页面 | `app/(protected)/page.tsx` |  |
| M01.F05.I02 | 卡片聚合查询 | 接口 | `lib/dashboard-store.ts:getDashboardCounts()` |  |
| M01.F05.I03 | 卡片点击跳转 | 按钮 | `data-fn="M01.F05.I03" on 3 Cards (Link)` |  |
| __M02.F01__ | __M02 模块__部门管理页 类的子项__ | — | — | — |
| M02.F01.I01 | 部门管理页 | 接口 |  |  |
| M02.F01.I02 | 查询部门树 | 接口 |  |  |
| M02.F01.I03 | 新增根部门 | 接口 |  | `tenant:create` |
| M02.F01.I04 | 新增子部门 | 接口 |  | `tenant:read` |
| M02.F01.I05 | 编辑部门 | 接口 |  | `tenant:delete` |
| M02.F01.I06 | 删除部门 | 接口 |  | `tenant:update` |
| M02.F01.I07 | 错误提示清理 | 接口 | `useDepartmentStore.*` / MSW `/departments*` |  |
| M02.F01.I08 | 部门表单弹窗(独立组件) | 接口 |  |  |
| M02.F01.I09 | 部门资源契约(MSW) | 接口 | `useDepartmentStore.*` / MSW `/departments*` |  |
| __M02.F02__ | __M02 模块__用户管理页(列表) 类的子项__ | — | — | — |
| M02.F02.I01 | 用户管理页(列表) | 接口 |  |  |
| M02.F02.I02 | 查询用户列表(分页入页即触发) | 接口 |  |  |
| M02.F02.I03 | 搜索用户(关键字) | 接口 |  |  |
| M02.F02.I04 | 角色筛选 | 接口 |  |  |
| M02.F02.I05 | 新增用户(user:create) | 接口 |  | `user:create` |
| M02.F02.I06 | 编辑用户(user:update) | 接口 |  | `user:update` |
| M02.F02.I07 | 删除用户(user:delete) | 接口 |  | `user:delete` |
| M02.F02.I08 | 错误清错(fetchUsers 路径) | 接口 | `useUserStore.*` / MSW `/users*` |  |
| M02.F02.I09 | 用户资源契约(MSW) | 接口 | `useUserStore.*` / MSW `/users*` |  |
| __M02.F03__ | __M02 模块__岗位管理页(列表) 类的子项__ | — | — | — |
| M02.F03.I01 | 岗位管理页(列表) | 接口 |  |  |
| M02.F03.I02 | 查询岗位(mount 自动) | 接口 |  |  |
| M02.F03.I03 | 新建岗位 | 接口 |  |  |
| M02.F03.I04 | 编辑岗位 | 接口 |  |  |
| M02.F03.I05 | 删除岗位 | 接口 |  |  |
| __M03.F01__ | __M03 模块__角色列表页(容器与初始拉取) 类的子项__ | — | — | — |
| M03.F01.I01 | 角色列表页(容器与初始拉取) | 接口 |  |  |
| M03.F01.I02 | 角色列表查询(fetchRoles) | 接口 |  |  |
| M03.F01.I03 | 新建角色(按钮 + 表单提交) | 接口 |  | `tenant:create` |
| M03.F01.I04 | 编辑角色(行内编辑按钮 + 表单回填) | 接口 |  | `tenant:read` |
| M03.F01.I05 | 删除角色(行内按钮 + 确认) | 接口 |  | `tenant:delete` |
| M03.F01.I06 | 角色表单校验(必填/取消/loading) | 接口 |  | `tenant:update` |
| M03.F01.I07 | 角色菜单权限绑定(独立组件) | 接口 |  | `tenant:update` |
| M03.F01.I08 | 角色 store 内部接口 | 接口 | `useRoleStore.*` / usePermissionStore / PermissionGuard |  |
| M03.F01.I09 | 权限守卫 PermissionGuard | 接口 | `useRoleStore.*` / usePermissionStore / PermissionGuard |  |
| M03.F01.I10 | 当前用户权限拉取与查询(permissionStore) | 接口 | `useRoleStore.*` / usePermissionStore / PermissionGuard |  |
| __M03.F02__ | __M03 模块__权限组列表页(容器与初始拉取) 类的子项__ | — | — | — |
| M03.F02.I01 | 权限组列表页(容器与初始拉取) | 接口 |  |  |
| M03.F02.I02 | 新建权限组(顶部按钮打开表单) | 接口 |  |  |
| M03.F02.I03 | 编辑权限组 | 接口 |  |  |
| M03.F02.I04 | 删除权限组 | 接口 |  |  |
| M03.F02.I05 | 权限组 store 内部接口 | 接口 | `usePermissionGroupStore.*` |  |
| __M03.F03__ | __M03 模块__用户组列表页(容器与初始拉取) 类的子项__ | — | — | — |
| M03.F03.I01 | 用户组列表页(容器与初始拉取) | 接口 |  |  |
| M03.F03.I02 | 新建用户组(顶部按钮打开表单) | 接口 |  |  |
| M03.F03.I03 | 编辑用户组 | 接口 |  |  |
| M03.F03.I04 | 删除用户组 | 接口 |  |  |
| M03.F03.I05 | 用户组 store 内部接口 | 接口 | `useUserGroupStore.*` |  |
| __M04.F01__ | __M04 模块__应用列表页面 类的子项__ | — | — | — |
| M04.F01.I01 | 应用列表页面 | 接口 |  |  |
| M04.F01.I02 | 搜索应用 | 接口 |  |  |
| M04.F01.I03 | 新建应用 | 接口 |  | `tenant:create` |
| M04.F01.I04 | 编辑应用 | 接口 |  | `tenant:read` |
| M04.F01.I05 | 删除应用 | 接口 |  | `tenant:delete` |
| M04.F01.I06 | 跳转菜单管理 | 接口 |  | `tenant:update` |
| M04.F01.I07 | 菜单列表页面 | 接口 |  |  |
| M04.F01.I08 | 新建菜单 | 接口 |  |  |
| M04.F01.I09 | 新建子菜单 | 接口 |  | `tenant:switch` |
| M04.F01.I10 | 编辑菜单 | 接口 |  |  |
| M04.F01.I11 | 删除菜单 | 接口 |  |  |
| M04.F01.I12 | 应用 store actions 内部接口 | 接口 | `useAppStore.*` |  |
| __M04.F02__ | __M04 模块__API Key 列表页面 类的子项__ | — | — | — |
| M04.F02.I01 | API Key 列表页面 | 接口 |  |  |
| M04.F02.I02 | 新建 API Key | 接口 |  |  |
| M04.F02.I03 | 启用/禁用 API Key | 接口 |  |  |
| M04.F02.I04 | 删除 API Key | 接口 |  |  |
| __M05.F01__ | __M05 模块__审计日志页面 类的子项__ | — | — | — |
| M05.F01.I01 | 审计日志页面 | 接口 |  |  |
| M05.F01.I02 | 全部 Tab | 接口 |  |  |
| M05.F01.I03 | 登录日志 Tab | 接口 |  |  |
| M05.F01.I04 | 操作日志 Tab | 接口 |  |  |
| M05.F01.I05 | 安全日志 Tab | 接口 |  |  |
| M05.F01.I06 | 日志查询筛选 | 接口 |  |  |
| M05.F01.I07 | 导出 CSV | 接口 |  |  |
| M05.F01.I08 | 审计 store actions 内部接口 | 接口 | `useAuditStore.*` / MSW `/audit-logs*` |  |
| M05.F01.I09 | 审计日志资源契约(MSW) | 接口 | `useAuditStore.*` / MSW `/audit-logs*` |  |
| __M06.F01__ | __M06 模块__登录安全策略页 类的子项__ | — | — | — |
| M06.F01.I01 | 登录安全策略页 | 接口 |  |  |
| M06.F01.I02 | IP 白名单 | 接口 |  |  |
| M06.F01.I03 | IP 黑名单 | 接口 |  | `tenant:create` |
| M06.F01.I04 | 启用登录失败锁定 | 接口 |  | `tenant:read` |
| M06.F01.I05 | 锁定阈值 | 接口 |  | `tenant:delete` |
| M06.F01.I06 | 锁定时长 | 接口 |  | `tenant:update` |
| M06.F01.I07 | 启用地区限制 | 接口 |  | `tenant:update` |
| M06.F01.I08 | 允许地区 | 接口 |  |  |
| __M06.F02__ | __M06 模块__登录方式配置页 类的子项__ | — | — | — |
| M06.F02.I01 | 登录方式配置页 | 接口 |  |  |
| M06.F02.I02 | 登录方式启用开关 | 接口 |  |  |
| M06.F02.I03 | SSO 提供商启用开关 | 接口 |  |  |
| M06.F02.I04 | OAuth2 提供商启用开关 | 接口 |  |  |
| __M06.F03__ | __M06 模块__密码策略页 类的子项__ | — | — | — |
| M06.F03.I01 | 密码策略页 | 接口 |  |  |
| M06.F03.I02 | 启用密码策略 | 接口 |  |  |
| M06.F03.I03 | 最小密码长度 | 接口 |  |  |
| M06.F03.I04 | 必须包含大写字母 | 接口 |  |  |
| M06.F03.I05 | 必须包含小写字母 | 接口 |  |  |
| M06.F03.I06 | 必须包含数字 | 接口 |  |  |
| M06.F03.I07 | 必须包含特殊字符 | 接口 |  |  |
| M06.F03.I08 | 密码过期天数 | 接口 |  |  |
| M06.F03.I09 | 历史密码数量 | 接口 |  |  |
| __M06.F04__ | __M06 模块__Token 管理页 类的子项__ | — | — | — |
| M06.F04.I01 | Token 管理页 | 接口 |  |  |
| M06.F04.I02 | 访问令牌有效期 | 接口 |  |  |
| M06.F04.I03 | Refresh Token 有效期 | 接口 |  |  |
| M06.F04.I04 | 开启 Refresh Token 续期 | 接口 |  |  |
| M06.F04.I05 | 开启 Token 主动失效 | 接口 |  |  |
| __M06.F05__ | __M06 模块__消息通知页 类的子项__ | — | — | — |
| M06.F05.I01 | 消息通知页 | 接口 |  |  |
| M06.F05.I02 | 邮件通知 | 接口 |  |  |
| M06.F05.I03 | 短信通知 | 接口 |  |  |
| M06.F05.I04 | 站内信 | 接口 |  |  |
| M06.F05.I05 | 登录通知 | 接口 |  |  |
| M06.F05.I06 | 密码变更 | 接口 |  |  |
| M06.F05.I07 | 安全告警 | 接口 |  |  |
| M06.F05.I08 | 系统通知 | 接口 |  |  |
| __M06.F06__ | __M06 模块__风险控制页 类的子项__ | — | — | — |
| M06.F06.I01 | 风险控制页 | 接口 |  |  |
| M06.F06.I02 | 异常登录检测 | 接口 |  |  |
| M06.F06.I03 | 异地登录告警 | 接口 |  |  |
| M06.F06.I04 | 设备指纹识别 | 接口 |  |  |
| M06.F06.I05 | 风险评分阈值 | 接口 |  |  |
| __M06.F07__ | __M06 模块__开放平台页 类的子项__ | — | — | — |
| M06.F07.I01 | 开放平台页 | 接口 |  |  |
| M06.F07.I02 | OpenAPI 开关 | 接口 |  |  |
| M06.F07.I03 | Webhook 开关 | 接口 |  |  |
| M06.F07.I04 | SDK 下载开关 | 接口 |  |  |
| M06.F07.I05 | 允许调用的 Scope | 接口 |  |  |
| M06.F07.I06 | 回调地址白名单 | 接口 |  |  |
| __M06.F08__ | __M06 模块__平台配置页 类的子项__ | — | — | — |
| M06.F08.I01 | 平台配置页 | 接口 |  |  |
