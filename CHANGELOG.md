# CHANGELOG — saas-identity-platform-nextjs

格式参照 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

## [Unreleased]
- chore(rename): 系统显示名统一（suite 全家族批）——「实验室管理系统」→「建筑工程实验室管理系统」；「身份平台」名称位（标题/品牌/包描述/UI 标签）→「SaaS 多租户多应用身份平台」，行文短称保留。同批兄弟仓同节奏提交。
 — 2026-11-04

### Refactored — 批 24 simplify（2026-11-07，/simplify 四路审查复用/简化/效率/高度，门禁 L0-L5 全绿 exit 0）

**源码面**
- **StatusBadge 默认文案翻正**：`LABEL_ZH` active→启用 / suspended→停用（此前默认 活跃/已暂停 零消费，四页面全靠 labels 传同一份 map）——租户页 `TENANT_STATUS_LABELS`、应用页 `CLIENT_STATUS_LABELS`、平台用户页 `STATUS_LABELS` 全删；成员页 7 键全同值 map 收敛为 status 归一（非 active 一律 disabled）+ `labels={{disabled:"停用"}}`。
- **菜单页父菜单下拉收敛**：`tree-table.tsx` 新增 `parentMenuOptions(rows, excludeId?)`（顶级占位 + 树形缩进项 + 自身排除），新建/编辑/移动三处同形 option 数组收敛；**顺手修掉批 22 残影**——FIELDS 死 `parentId` 条目（`options:[]`）+ 弹窗显式追加同名 select = 新建弹窗渲染两个父菜单控件（React 重复 key），现 FIELDS 不含 parentId、三弹窗统一 `makeParentMenuField()`。
- **members POST 复用分支回真值**：命中既有 sys_user 只 select id、响应回请求字面量 + nowIso 伪造时间戳（email 命中而 username 不同时连 username 都是编的）→ 整行 select，回真实 username/email/createdAt/updatedAt（status 固定 active 仍成立=新挂成员行 status 1）。
- **admin/users 路由**：count 与 items 两独立查询 `Promise.all` 并行（省一串行往返）；私有 `statusFromSmallint`（全仓第 7 份副本）上收 `src/lib/status.ts#sysUserStatusFromSmallint`（唯一正本含 2=invited，其余 6 份旧副本随触碰收敛）。
- **成员页搜索防抖**：`useDeferredValue(searchQuery)`——逐键更新 queryKey = 每键一次 listSysUsers 请求；无效 `useMemo`（users 每渲染新数组永不命中）删除改直算。
- **app-switcher barrel 切真源**：`@/api/endpoints` → `@/api/endpoints/admin-clients/admin-clients`（ADR-0012 死桩 shadow 纪律；barrel 不跟进新 tag）。
- **app-shell**：`SUB_PATH_LABEL` 纯别名删除；**admin/users 页**裸 input 换 ui `Input`；members 路由/页死注释（指向已删 invitations 路由、与 EDIT_FIELDS 矛盾的 invited 说明）清理。

**测试面**
- `tests/state-helpers.tsx` 新增共享桩 `queryResult` / `mutStub` / `openDropdownMenu`，7 个测试文件局部复制删除（user-list 的 mutStub 定制捕获版保留）；`scrollIntoView` polyfill 收进 `tests/setup.ts`（与 ResizeObserver 同居）；app-switch 测试补真源 tag 模块 mock（组件切真源后 barrel 全局桩不再覆盖它）。
- 全量 149 passed + 5 skipped（数量与批 23 持平，均为等价重构）。

**审查后跳过项（记录在案）**
- drizzle `@/db` 链式桩 7 处复制（3 个新测试文件形状趋同）——抽共享 `mockDb()` 是较大测试基建重构，各文件「表名锚」测试已防桩烂，另批议。
- 分页 clamp 第 5 份副本——其余 4 份在 diff 外，全量收敛超本批范围。
- `PATH_SEGMENT_LABELS` 派生机器（占位 tenantId 构造 nav 再提 label）——有 breadcrumb 测试钉住，taste call 不动。
- clientSecret 前端 `sec-<random>` 生成——正解=后端生成一次性返回，需改 shared 契约（人批域），跨仓候选挂起。
- members POST 处理器内联（不抽 lib）——唯一调用方，抽了反而多一层；SSO JIT 等第二消费者出现再抽。
- breadcrumb 跳段规则位置特判——小且已注释，通用化（无 label 段=参数段）属重写，不动。

### Fixed — 租户管理页三处人工测试反馈（2026-11-04 人工测试，TDD：3 红测试先取证再修）

1. **编辑租户 Code 不可编辑**（tenantKey 是身份字段，创建后不可改）
   - `src/components/app/crud-dialog.tsx`：`FieldDef` 增 `disabled?: boolean`，Input/Textarea/Select 控件透传 `disabled`；三处控件补 `data-testid="crud-field-<name>"`（测试锚）。
   - `src/app/tenants/page.tsx`：新增 `EDIT_FIELDS`（tenantKey disabled），编辑弹窗 `fields={EDIT_FIELDS}`；新建弹窗仍用 `FIELDS` 可填 Code。
2. **租户列表状态徽章统一两态**：`active→启用`、`suspended→暂停`（不再显示 活跃/已暂停）
   - `src/components/app/status-badge.tsx`：`StatusBadge` 增可选 `labels?: Partial<Record<Status,string>>` 覆盖默认文案（用户/成员等其余页面不受影响）。
   - `src/app/tenants/page.tsx`：列表徽章传 `TENANT_STATUS_LABELS = { active: "启用", suspended: "暂停" }`（与新建/编辑表单下拉文案一致）。
3. **「已选中」显示 tenantKey**：`已选中 ACME Corp(00000000)` → `ACME Corp(acme)`
   - `src/state/selection-context.tsx`：`Selection` 增可选 `key?: string`（旧 localStorage 条目缺省，消费侧 `?? id.slice(0,8)` 兜底）。
   - `src/app/tenants/page.tsx`：`setSelectedTenant` 带 `key: t.tenantKey`；头部渲染 `(key)` 兜底 UUID 前缀。
   - 测试：`tests/integration/tenant-list.test.tsx` +3 例（徽章两态断言/编辑 Code 禁用/选中展示 acme），用 fireEvent（@testing-library/user-event 本仓未装，勿再引）。
   - 门禁：L0-L5 全绿 exit 0；全量测试 94 passed + 5 skipped。

   **兄弟仓同步清单（同批反馈很可能各前端同病）**：vue / react / angular 租户管理页同款三处（编辑弹窗 Code 可编辑、状态徽章文案、已选中 UUID 前缀）——同步时逐仓 grep 租户页（vue `TenantsPage`/react `tenants` 页/angular `tenants-page`）核实后回放；shared 契约无涉（纯前端展示面）。
4. **应用订阅列表列序与列宽**（同日第二笔人工测试反馈）
   - `src/app/tenants/[tenantId]/applications/page.tsx`：表头与行体列序 `应用名称|Client ID|…` → `Client ID|应用名称|…`；Client ID `w-44`、状态 `w-20`、到期时间 `w-28` 定宽，应用名称不定宽吃剩余。
   - 测试：`tests/integration/tenant-applications-list.test.tsx` +1 例（columnheader 顺序断言 + 定宽 class 断言），红→绿。门禁 L0-L5 全绿 exit 0。
   - 兄弟仓同步：同款订阅列表页 vue/react/angular 若存在同列序，一并回放。
5. **租户列表表头与列宽**（同日第三笔人工测试反馈）
   - `src/app/tenants/page.tsx`：表头 `Code` → `代码`；代码 `w-32`、状态 `w-20` 定宽，名称不定宽吃剩余（勾选列 `w-12` 不变）。
   - 测试：`tests/integration/tenant-list.test.tsx` +1 例（columnheader 顺序 + 定宽断言），红→绿。门禁 L0-L5 全绿 exit 0；全量 96 passed + 5 skipped。
   - 兄弟仓同步：vue/react/angular 租户列表页同款表头/列宽一并回放。
   - 运维注记：本批起 UI 批次转绿后**主动重启 dev server** 再通知复测（Next dev watcher 漏 agent 外部改盘事件，用户见旧 UI；见记忆 nextjs-dev-watcher-misses-agent-edits）。
6. **文案统一（第四批人工测试反馈）**：成员域全中文
   - `src/app/tenants/[tenantId]/members/page.tsx`：PageHeader 标题 用户管理→租户成员、按钮 创建成员→添加成员（`data-fn=M01.F04.I03` 不变）、卡片标题 用户列表→租户成员列表、行按钮 删除→移除成员、ConfirmDialog 标题/确认文案「移除成员…/移除」、toast 文案（成员已添加/已移除/添加失败/移除失败）、EmptyState（还没有成员/添加第一个成员加入租户）；I06 邀请注释保留（退役注记）。
   - 测试：`tests/integration/user-list.test.tsx` 断言更新（添加成员/租户成员列表/移除成员×3），红→绿。
   - 兄弟仓同步：vue/react/angular 成员页同款文案一并回放。
7. **面包屑段名公共化（第五批）**：`应用`→`租户应用`，段名映射公共
   - `src/components/app/nav-items.tsx`：新增公共导出 `PATH_SEGMENT_LABELS`——由 `buildNavItems` 菜单定义推导（末段非占位符 → label），加/改菜单只动 buildNavItems 一处。
   - `src/components/app/app-shell.tsx`：页内散落 `SUB_PATH_LABEL` 手写字典删除，改引公共映射。
   - 测试：`tests/integration/breadcrumb.test.tsx` 新文件（锚 `getByLabelText("breadcrumb")` 容器断言，避免与侧边栏同名 label 撞多元素），红→绿。
   - 兄弟仓同步：vue/react/angular 面包屑同款段名映射公共化（labels 同源 nav 菜单定义）。
8. **页面标题与菜单名同源（第六批）** + **面包屑去租户名** + **应用下拉框（第七批）** + **下拉只显名称/界面去英文（第八批）** + **登出收进用户菜单（第九批）**
   - 页面标题：`src/app/tenants/page.tsx` 租户管理→**租户维护**；`src/app/admin/clients/page.tsx` 应用管理→**应用维护**；`src/app/tenants/[tenantId]/roles/page.tsx` 角色权限→**租户角色**（菜单管理/租户成员/租户应用本就同名不动）。
   - 面包屑：不再显示租户名——直接 `首页 > 一级菜单 > 二级菜单`（`app-shell.tsx` `useBreadcrumbs` 去掉租户 crumb 与 `useTenantMap`；参数段跳过：`tenants` 后租户段、`clients` 后 clientId 段）。
   - 应用下拉框：新组件 `src/components/app-switcher.tsx`（数据源 `useAdminClientsListClients`，选中态落 `SelectionContext.selectedApp`，localStorage `saas.selected.app` 持久化；纯前端选择不切会话）；头部顺序 = 租户切换器 → 应用切换器。
   - 下拉只显名称：`tenant-switcher.tsx` 下拉项删 tenantKey 代码行（`tenantKeyById` map 删）；`app-switcher.tsx` 项删 clientId。
   - 界面去英文：6 处 label/表头/文案 Code→代码（tenants/roles 表头+弹窗、menus 弹窗、clients 表头）、Client ID→客户端 ID（applications 表头+弹窗、clients 弹窗）、Scopes→授权范围（clients 弹窗）、描述文案（租户创建「代码与名称不可重复」、订阅「客户端 ID」）。
   - 登出收进用户菜单：新组件 `src/components/user-menu.tsx`（触发器=图标+用户名，源 `useMeWhoami`；下拉含登出，`data-fn=M01.F04.I06` 随功能迁移）；`app-shell.tsx` 删独立登出按钮（`data-testid=logout-btn` 不复存在）。
   - 测试基建：`tests/setup.ts` 补 jsdom `ResizeObserver` polyfill（Radix Dialog use-size 依赖，应用维护弹窗测试实证）。
   - 测试（全 TDD 红→绿）：`tenant-list.test.tsx` +2（标题/弹窗代码标签）、`role-list.test.tsx` +2（标题/表头代码）、`client-list.test.tsx` 新文件 +2（标题/弹窗标签）、`tenant-applications-list.test.tsx` 表头断言更新、`tenant-switch.test.tsx` +1（项只显名称；本文件级 mock `meListMyTenants` 覆盖全局空桩）、`app-switch.test.tsx` 新文件 +4（位置序/选项/选中落 localStorage/只显名称）、`user-menu.test.tsx` 新文件 +2（触发器/登出在菜单）、`breadcrumb.test.tsx` 断言更新（无租户名）。全量 112 passed + 5 skipped；门禁 L0-L5 全绿 exit 0。
   - 已选中描述（tenants 页）：旧 localStorage 条目缺 key 时从列表按 id 解析 tenantKey 兜底（不再闪 UUID 前缀）。
   - **兄弟仓同步清单（批 6-9 全量）**：① 页面标题同源（租户维护/应用维护/租户角色）②面包屑 = 首页>一级>二级、无租户名、段名映射公共源=菜单定义 ③应用切换下拉（若产品要）④下拉只显名称 ⑤界面去英文 6 处 ⑥登出收进用户菜单（logout data-fn 迁移）。vue/react/angular 逐仓回放；contract-test 无涉（纯展示面）；L5 data-fn 未变（M01.F04.I06 仍在 DOM，仅位置移动）。
9. **人工测试反馈批 10-15（2026-11-04 下午，全 TDD 红→绿）**
   - **批 10 未登录 bug（真 bug 修复）**：`user-menu.tsx` 读 `useMeWhoami().data.username`，但 CurrentUser 契约**没有 username 字段**（契约漂移坑，同族见 saas /me/menus title-not-name）→ 恒显「未登录」。改读会话 `useTenant().user?.username`；`user-menu.test.tsx` 的 whoami 桩对齐真契约（无 username）取红。
   - **批 11 分配角色只显角色名称**：`members/page.tsx` 角色弹窗选项删 roleCode 拼接，只显 `roleName`；`user-list.test.tsx` 断言弹窗不含 admin/member。
   - **批 12/13 状态两态化**：租户 `暂停→停用`（`TENANT_STATUS_LABELS`）；成员弹窗 status 只提供 启用/停用 两选项（defaultValue active），列表徽章 `MEMBER_STATUS_LABELS` 把 invited/suspended 等存量枚举全归一显示 停用（契约枚举不动，纯展示面收敛）。
   - **批 14 角色下钻面包屑 + 页头描述**：`app-shell.tsx` `useBreadcrumbs` 跳过 roles 后 roleId 段与 menus 段（`首页 > 租户角色` 到头；admin/clients 的 menus 段不受影响——条件限定 `segments[i-2]==="roles"`）；`roles/[roleId]/menus/page.tsx` 页头描述 `租户 ACME Corp（acme） / 角色 00000000` → `角色 角色名称（代码）`（`useTenantRolesGetSysRole` 取真源，tenant 查询删除）。
   - **批 15 菜单授权单应用 + 树形**：授权页重构——原逐 app 平铺 Card（全量菜单一次渲染）→ 应用下拉选择器（`data-testid=role-grant-app-select`，默认第一个应用）+ 只拉选中的应用菜单 + `buildTree`/`TreeTable` 树形渲染（depth 缩进/展开折叠；行 `data-testid=menu-grant-row data-depth`）。grant/save/清空逻辑不变（menuIds 仍是角色级全量集合）。
   - **页面健壮性副产品**：`grantQ.data` effect 改内容比较守卫——hook 桩每渲染给新引用时直接 `setGranted(new Set)` 会无限重渲染（jsdom 堆爆实证）。
   - 测试（全 TDD 红→绿）：`breadcrumb.test.tsx` +1（角色下钻段断言）、`role-menu-grant.test.tsx` 新文件 +5（描述/单应用/树形/切应用/勾选）。全量 122 passed + 5 skipped。
   - **测试基建坑（下会话必读）**：setup.ts 的 react `use` 桩是恒等函数不拆 Promise——页面测试的 `params` 必须传**已解析对象**（`await Promise.resolve({...})` 或字面量），传 Promise 得 undefined（本批 role-menu-grant 首版踩坑）；orval hook 桩形状=queryResult(AxiosResponse)，载荷在 `data.data`，多包一层 = 字段恒 undefined。
   - **兄弟仓同步清单**：①分配角色只显名称（vue/react/angular 成员页）②状态两态文案（租户/成员）③角色下钻面包屑+描述 ④授权页单应用+树形（各栈 tree 组件等价物）⑤grantQ effect 内容守卫（同款 useEffect set(new Set) 模式全查）。contract-test 无涉（纯展示面，data-fn 未动）。
10. **createTenantUser 重建即复用语义（批 16，2026-11-05 人工测试反馈 + 人裁，家族级行为变更）**
   - **现象**：移除成员 carol 后再添加 carol/carol@acme.io → 500「添加失败」。根因：DELETE 成员只删 tenant_member（sys_user 跨租户共享是 2026-09-09 pivot 既定设计），POST 无条件 INSERT sys_user → 撞全局唯一索引 uk_sys_user_username/email（23505）→ 未捕获 → 500。四个后端同病（语义契约未定义）。
   - **人裁方向（2026-11-05，AskUserQuestion 三选一）**：重建即复用——username/email 命中既有 sys_user 时**不插新行**，直接建 tenant_member 挂上去（body.password 忽略，原口令与 user id 保留）；同租户已是成员 → 409 ALREADY_MEMBER；username/email 分属不同用户 → 409 USER_CONFLICT 不猜；**不存在 → 原路径插新行**（人补确认）。
   - 实现：`src/app/api/v1/tenants/[tenantId]/members/route.ts` POST 前置 matched 查询（or username/email，limit 2 区分单命中/双命中）。
   - 本仓测试：`tests/integration/members-create-relink.test.ts` 新文件 +5（复用不插新行/ALREADY_MEMBER/双命中不猜/原路径/表名锚；mock @/db+tenant-guard 直调 handler，node 环境）。红→绿 5/5。
   - **contract-test 同 commit 同步**（suite 硬规则 §2）：`tests/tenant-members-relink.test.ts` 新文件——live 四方断言 ①移除后重加 → 201 且 user id 不变 ②在册重复 POST → 409 ALREADY_MEMBER。挂在 I19 op 语义下（未新铸 M96 ID，铸新 ID 走树审批另批）。**其余后端同步前此文件对其红**（可执行规格先行）。
   - **shared tsp 欠账**：createTenantUser 重复语义 @doc 未补（改 shared 描述=全消费仓生成物漂移，走人批另批；契约测试已是可执行规格）。
   - **兄弟仓同步清单（后端语义变更，全部要回放）**：aspnetcore / springboot / rails / fastapi / kotlin(ktor) / laravel / go / django 的 createTenantUser 同款重建即复用 + 两类 409（ALREADY_MEMBER / USER_CONFLICT）；前端仓无涉（错误 toast 走 toApiError 透传 message）。shared contract-test 仓已随本批同步。
11. **添加成员 400 修复——UI 表单补初始密码字段（批 17，2026-11-05 人工测试反馈）**
   - **现象**：批 16 后复测仍失败，400。根因不在后端：UI「添加成员」表单只有 用户名/邮箱/状态，而契约 CreateUserBody 要求 `password`（min8 max256）→ zod 400 BAD_REQUEST。UI 从未传过 password（此前种子用户掩盖了这一点——加新用户本就会 400）。
   - 实现：`crud-dialog.tsx` FieldDef type 联合加 `"password"`（默认分支 `<Input type={type}>` 直通，零额外渲染代码）；`members/page.tsx` FIELDS 加 `初始密码`（password/required/至少 8 位）；EDIT_FIELDS 同时排除 password（契约 PATCH 仅 email，密码变更不走本页）。
   - 测试：`user-list.test.tsx` +1（弹窗含 crud-field-password 且 type=password、文案 初始密码），红→绿。
   - **兄弟仓同步清单**：vue/react/angular（及各端）成员创建表单同补密码字段——契约 CreateUserRequest.password 必填，缺字段的创建表单全是 400。（**批 18 起本清单作废**：产品方向改「不创建用户」，见下条）
12. **添加成员改「搜索选人不建用户」（批 18，2026-11-05 人工测试反馈 + 人裁两问：模糊搜索端点 + 搜索下拉选人 UI）**
   - **产品语义**：添加成员 = 选择不在成员中的平台已有用户（username/email 模糊查找），**本页不再创建 sys_user 行**；批 17 的初始密码字段随之删除。命中既有用户仍走批 16 重建即复用语义（只建 tenant_member）。
   - **shared 契约**（人裁后已改，openapi 重算）：`tsp/routes/admin-users.tsp` 新文件——`listSysUsers(@query query?, @query page?, @query pageSize?): Page<SysUser>`（@doc 挂 op 级：contains 大小写不敏感、page 0 基）；`main.tsp` 加 import；`tsp/models/sys-user.tsp` `CreateSysUserRequest.password` → **optional**（复用路径无密码可传；创建新用户仍必填由后端校验，@doc 注记）。`npm run lint` 绿 + openapi 重算。
   - 本仓生成物：`bash scripts/gen-shared.sh` 绿 → `src/api/endpoints/admin-users/admin-users.ts`（`adminUsersListSysUsers` + `useAdminUsersListSysUsers`）。
   - **后端**：`src/app/api/v1/admin/users/route.ts` 新文件（GET 模糊搜索：`ilike` contains username/email、Page 信封 {items,page,pageSize,total}、status smallint→字符串映射、`verifyPathTenant(null)` 平台级守卫、响应无 password 字段）；`members/route.ts` zod `password` 改 optional + 创建新用户路径显式守卫（无命中且缺 password → 400 "password is required when creating a new user"）。
   - **前端**：`members/page.tsx` 创建 CrudDialog → 搜索选人 Dialog（`data-testid=member-search-input` 占位「输入用户名或邮箱搜索」、候选 `member-search-option[<id>]` username+email、已在租户置灰标「已在租户中」（username/email 小写集合比对）、确认 `member-pick-confirm` 提交仅 {username, email} 无 password/status）；FIELDS 删除（EDIT_FIELDS 独立定义 email+status 不变）。
   - 本仓测试（TDD 红→绿）：`admin-users-search.test.ts` 新文件 +4（Page 信封与 status 映射与无 password/query 收 where/平台守卫/表名锚）、`members-create-relink.test.ts` +2（无 password 命中 → 201 复用；无 password 无命中 → 400）、`user-list.test.tsx` 批 17 密码测试替换为 picker 3 例（搜索框无表单字段/候选+已在租户置灰/提交仅 username+email）。全量 136 passed + 5 skipped；门禁 L0-L5 全绿 exit 0。
   - **contract-test 同 commit 同步**（硬规则 §2）：`tests/admin-users-search.test.ts` 新文件——live 每目标两断言（query 命中自建用户 + items 无 password；无 password 命中复用 201 同 id + 无命中 400）。**其余后端同步前此文件对其红**。
   - **树欠账**：listSysUsers 新 op 未挂 fn-ID（挂树=人批另批；路由注记挂 M01.F04.I03 语义下）。
   - **兄弟仓同步清单（契约变更，量大）**：①shared 仓 openapi 已重算——全消费仓须重跑 gen-shared（生成物含 admin-users 组与 CreateSysUserRequest.password optional）；②八后端（aspnetcore/springboot/rails/fastapi/kotlin/laravel/go/django）实现 GET /admin/users listSysUsers + createTenantUser password 可缺省（创建新用户路径仍必填 400）；③各前端成员页「添加成员」改搜索选人 UI（数据源 admin/users，不再创建用户）；④contract-test `tests/admin-users-search.test.ts` 已随本批提交。
13. **角色菜单授权页去掉「选择应用」（批 19，2026-11-07 人工测试反馈）**
   - **产品语义**：授权页不再按应用过滤——选择应用下拉删除，一次拉全部应用的菜单合成一棵树（`Promise.all` 逐 app `clientMenusListSysMenus` 后 flatMap，queryKey 含全部 clientId）；授权集合本就是角色级全量 menuIds，保存语义不变。卡片标题 选择应用→全部应用菜单。
   - 实现：`src/app/tenants/[tenantId]/roles/[roleId]/menus/page.tsx`——`pickedApp`/`currentAppCode` state 删、select 删、空态文案 该应用暂无菜单→暂无菜单。
   - 测试：`role-menu-grant.test.tsx` 批 15 两条重构（单应用/切应用 → 合树 4 行无选择器 + ERP菜单独立根 depth 0）；mock 数据 ERP 根 sortOrder 1→2（buildTree 根排序 tie 不确定，sortOrder 区分——多应用合树时各应用根 sortOrder 值域真实数据须错开，无则渲染顺序不稳定）。全量 136 passed + 5 skipped；门禁 L0-L5 全绿 exit 0。
   - **兄弟仓同步清单**：vue/react/angular（及各端）角色菜单授权页同款「选择应用」过滤一并移除（数据源改全量菜单合树）；contract-test 无涉（纯前端展示面，data-fn 未动）。（**批 20 起本清单修正**：不是合树，是跟随头部应用切换器，见下条）
14. **角色菜单授权页跟随头部应用切换器（批 20，2026-11-07 人工测试反馈二连）**
   - **产品语义**：批 19 理解偏了——不是显示全部应用合树，而是显示**当前应用**（头部应用切换器选中项，`useSelection().selectedApp`，其 id 即 clientId）的菜单；另「当前授权摘要」卡片删除（勾选数已在保存按钮上）。
   - 实现：`roles/[roleId]/menus/page.tsx`——`useAdminClientsListClients`/apps 数组删除，`useSelection` 接入，menusQ 单应用拉取（queryKey 含 selectedApp.id，切换应用即刷新）；卡片标题 全部应用菜单→当前应用菜单（+应用名+N 项）；摘要卡片整卡删除。
   - 测试：`role-menu-grant.test.tsx` 批 19 两条重构（合树 → 只显当前应用 3 行无摘要卡；跨应用根 → localStorage 预置 `saas.selected.app=erp` 断言跟随切换器显示 ERP 菜单）。全量 136 passed + 5 skipped；门禁 L0-L5 全绿 exit 0。
   - **兄弟仓同步清单**：vue/react/angular（及各端）角色菜单授权页数据源=应用切换器当前选中项（不是页内下拉、不是全量合树），勾选摘要卡删除；contract-test 无涉（纯前端展示面）。
15. **功能树全量 GA + 用户管理菜单/页（批 21，2026-11-07 人裁指令「function-tree 打算让全部上线，请处理。另外增加用户管理菜单，放到租户管理前面」）**
   - **功能树 GA（REQ-2026-038）**：mirror 13 行 开发中→已上线（--apply 免批 GA 翻转凭 REQ 验收记录）；shared SSOT 15 变更走人批正门（--approve，含同 13 行 GA + M01.F05 新增）——**教训在案**：树写入必须一笔 Edit 落完（hook 逐笔校验 sha，多笔=首笔焚令牌）；首笔事故后重提案重批（提案 summary 留【重提-令牌首笔即焚事故】审计前缀），二批后逐笔落完。全树现 0 数据行「开发中」。
   - **新功能 M01.F05 平台用户管理**：shared 人批新增 F05 + F05.I01（用户列表·平台级）；mirror 随后 --apply 镜像登记（reason 须引 REQ-YYYY-NNN，免批校验必带）。
   - **页面**：`src/app/admin/users/page.tsx` 新文件（只读列表：搜索框 username/email contains + 表格 用户名/邮箱/状态；数据源 `useAdminUsersListSysUsers`（批 18 op）；状态徽章契约三态 启用/已邀请/已禁用；wrapper 挂 `data-fn=M01.F05.I01`）。
   - **导航**：`src/components/app/nav-items.tsx` 新增「用户管理」组（置租户管理组**前面**，UserCog 图标，`to=/admin/users`，fnId=M01.F05.I01）；PATH_SEGMENT_LABELS 自动推导 users 段名（批 7 机制白吃）。
   - **L5 UI 入口锚**：whoami（M01.F01.I01）翻已上线后 L5 报「无 UI 入口」——前端消费 2026-11-04 起改走登录会话（user-menu 会话态），API 路由保留；`src/app/api/v1/me/route.ts` 头部补 `// @entry M01.F01.I01` 标准形状锚（非标准写法不识别）。
   - 测试（TDD 红→绿）：`admin-users-page.test.tsx` 新文件 +5（行渲染/三态徽章/data-fn/搜索参数透传/只读无写按钮）、`nav-modules.test.tsx` 重构（三组层序 用户管理→租户管理→应用管理 + M01.F05.I01 断言）。全量 141 passed + 5 skipped；门禁 L0-L5 全绿 exit 0。
   - 测试坑复证：orval hook 桩载荷在 `data.data`（queryResult 包一层 AxiosResponse.data），本批再踩一次多包一层致列表恒空（批 10 注记同坑）。
   - **兄弟仓同步清单**：①各前端仓 mirror 树同批 GA 翻转（各仓 --apply 免批，引 REQ-2026-038）+ M01.F05 镜像登记；②vue/react/angular（及各端）用户管理菜单+页同款回放（菜单置租户管理前、/admin/users 只读列表）；③shared 树已收口（其他仓 mirror 只镜像 shared 现状，无需再动 shared）。contract-test 无涉（listSysUsers live 断言批 18 已挂）。
16. **应用维护/菜单管理四条人工测试反馈（批 22，2026-11-07，全 TDD 红→绿，门禁 L0-L5 全绿 exit 0）**
   - **① 编辑应用保存 400**：PATCH 口 zod `status: z.enum(["active","disabled"])` 偏离契约（UpdateOAuthClientRequest.status?: int32），页面按契约发数字 → 400（创建口 union 双收所以创建没事）。修：`admin/clients/[clientId]/route.ts` PATCH 对齐创建口 `z.union([0,1,"active","disabled"])` + 数字落库映射（`typeof status === "number" ? status : …`——原三目把数字 1 也打成 0）。测试 `admin-clients-update.test.ts` 新文件 +3（数字 1/0 落库映射、枚举串兼容）。
   - **② 应用列表状态徽章 启用/停用**：`admin/clients/page.tsx` StatusBadge 传 `CLIENT_STATUS_LABELS`（原默认文案 活跃/已暂停）。测试 `client-list.test.tsx` +1（行内徽章与切换按钮同文案 → getAllByText 计数断言）。
   - **③ 菜单树类型列 分组/页面/操作**：契约 SysMenuType=directory/menu/button 全链一致，但树单元格渲染旧文案 目录/菜单/按钮（菜单永远落 else 显示「菜单」）。修：`menus/page.tsx` 映射 分组/页面/操作；顺手把谎报的 as cast `"group"|"page"|"action"` 改真（`"directory"|"menu"|"button"`）。测试 `app-menus-page.test.tsx` +1（3 行契约类型逐行断言类型列文本）。
   - **④ 父菜单下拉树形显示**：原 label 全角缩进缺失（半角空格被 HTML 折叠）= 平铺「code · 名称」。修：抽公共构造器 `tree-table.tsx#treeOptionLabel`（全角空格 U+3000 缩进 + └─ 引导，顶级平文名，只显名称符合批 8 先例），父菜单下拉三处（新建/编辑/移动）统一换用。**坑在案**：App Router 页面文件禁止具名导出（L3 next 类型门 TS2344），构造器必须放公共模块；radix Select 在 Dialog 内 jsdom 开不了窗（焦点陷阱+pointer-events 锁），下拉文案断言走纯函数 + 弹窗锚存在性，开窗复测归人工。测试 `app-menus-page.test.tsx` +1。
   - 测试基建坑：radix SelectTrigger 会镜像一个隐藏原生 `<select>`（同 testid）——getByTestId 撞双元素，按 `tagName==="BUTTON"` 过滤；jsdom 无 `scrollIntoView`（radix 聚焦项要调），beforeAll polyfill。
   - **兄弟仓同步清单**：①后端八仓 PATCH status 契约形状自查（数字 int32 必须收——contract-test 若无 PATCH live 断言建议补）；②vue/react/angular（及各端）应用列表徽章 启用/停用、菜单树类型列 分组/页面/操作、父菜单下拉树形缩进同款回放。
   - **isFirstParty 幻影字段（问询在案，未动）**：应用表单「一方应用（一方应用对租户可见）」hint 无实现支撑——isFirstParty 不在契约、不在 DB、不在任何逻辑，勾选即被 zod 丢弃；同表单 icon/sortOrder 亦超契约（属 sys_menu 域字段）。待人裁：删三字段 or 补实现（改 shared 契约走人批）。
17. **应用表单幻影字段删除（批 23，2026-11-07 人裁「删掉」，TDD 红→绿，门禁 L0-L5 全绿 exit 0）**
   - 删 `admin/clients/page.tsx` 表单三控件：一方应用（isFirstParty，hint「一方应用对租户可见」）/ 图标（icon）/ 排序（sortOrder）——契约（Create/UpdateOAuthClientRequest）、DB（oauth_client 列）、业务逻辑三处全无，提交后被 zod 静默丢弃，界面许诺不存在的能力。
   - 同步清 payload 面：toClientInput / onUpdate data / initialValues / AppRow 接口全部移除三字段。**seed fixture（`src/seeds/oauth_client.json`）isFirstParty 数据面遗留未动**（zod 丢弃无害，非 UI 面，另批议）。
   - 测试 `client-list.test.tsx` +2（新建/编辑弹窗断言 一方应用/图标/排序 不出现、真实字段 客户端 ID/状态 仍在）。全量 149 passed + 5 skipped。
   - **兄弟仓同步清单**：vue/react/angular（及各端）应用表单同删三幻影控件（各端表单若同病）。契约/DB/后端无涉（字段本来就不存在）。

### Removed — M00.F02.I06/I07 邀请链本仓退役（人裁 2026-11-04，范围=仅本仓；invited 状态枚举保留）

- `docs/functions/function-tree.md` L53/L54：I06（邀请成员）、I07（接受邀请）状态 → **已废弃**，备注列记人裁日期与范围。走 `tree_change.py` 正门：提案 `.state/tree-change.json`（废弃=人裁项）→ 人交互式 `--approve` → 才动树。「行不删，号不回收」。
- 删 `src/app/api/v1/tenants/[tenantId]/members/invitations/route.ts` 整文件（-122 行，POST /tenants/{t}/members/invitations 实现）。
- `src/app/tenants/[tenantId]/members/page.tsx`：撤 `@entry M00.F02.I06` 注释、`useTenantMembersInviteTenantUser` import、`INVITE_FIELDS`、`inviteMut`、`inviteOpen` state、`onInvite` 函数、页头「邀请成员」按钮（`data-fn="M00.F02.I06"`）、邀请 `CrudDialog`；EmptyState 文案「邀请第一个用户」→「创建第一个用户」。
- `tests/integration/user-list.test.tsx`：删 mock 表里 `useTenantMembersInviteTenantUser` 条目；测试名「邀请按钮挂 data-fn」→「创建按钮挂 data-fn」（该测试本就断言 M01.F04.I03 创建按钮，原名单错）。
- `.state/trace.json` 重刷（trace_cmd=vitest+TRACE_MAP）：I06/I07 清零。
- **保留不动**：`invited` 状态枚举（tsp/sys-user.tsp、tenant-member.tsp、种子 carol=invited）、orval 生成客户端 `src/api/endpoints/tenant-members/tenant-members.ts` 的 `useTenantMembersInviteTenantUser`（shared 契约未删 op，生成物不手改）、共享契约 tsp `inviteTenantUser` op（其他兄弟仓仍在用）。
- 门禁：L0-L5 全绿 exit 0（113 条软告警为存量）。**已知欠账**：contract-test `tenant-members-write-2.test.ts` I42「四方比对」打活后端，nextjs 端点已删，live 跑 CT 该条对 nextjs 红（405，请求落入 `members/[userId]` 动态路由无 POST handler）。

### 兄弟仓同步清单（待「同步其他仓」指令，照单回放 I06/I07 退役）

> 本仓退役时范围人裁为仅 nextjs。同步=把同样的退役铺到家族其他仓；每仓 mirror 行废弃均需 `tree_change.py --approve` 人批（废弃不在免批三类）。已 grep 核实的挂点：

- **mirror 树**（每仓 `docs/functions/function-tree.md` L53/L54 同位置两行）：I06 已上线→已废弃、I07 规划→已废弃。涉及：react / vue / angular / miniprogram / flutter / react-native / swift / android / harmonyos / aspnetcore / springboot / rails / fastapi / go / kotlin / laravel（draft：逐仓 grep `M00.F02.I0[67]` 定实际行号）。
- **前端邀请 UI**：vue `src/pages/UserListPage.vue`（L10 @entry + L300 邀请按钮 + 邀请弹窗）；angular `src/app/pages/user-list-page.html` L3 邀请按钮（+对应 ts `openInvite`）；react UserListPage 有同款邀请入口（nextjs 页注释「react UserListPage 同款」所指，同步时 grep `invite` 核实）。
- **后端实现**（`POST /tenants/{t}/members/invitations`）：aspnetcore `src/Controllers/Implementation/TenantMembersController.cs`（L19 `@impl M00.F02.I06`）+ `tests/TenantMembersControllerTests.cs` L49 起 I06 测试；springboot `TenantMembersController.java`；rails `app/controllers/tenant_members_controller.rb` + `config/routes.rb`；fastapi `apis/tenant_members_api.py` + `tests/test_tenant_plane.py`；go `internal/impl/api/tenant_members_impl.go` + `tenant_members_feature_test.go` + `route_parity_test.go`；laravel `app/Http/Controllers/TenantMembersController.php` + `routes/api.php` + `tests/Feature/TenantFlowTest.php`；kotlin 实现位同步时 grep `invitation` 核实。
- **contract-test**：`tests/tenant-members-write-2.test.ts` I42 四方比对块（硬规则 §2：端点删与 CT 断言删同 commit）。
- **shared 契约**（最大件，需单独人裁）：`tsp/routes/tenant-members.tsp` L53-60 `inviteTenantUser` op 删除 → 全家族生成物重算（gen-shared FATAL 护栏流程）；若做，各仓生成客户端随 `gen:shared`/orval 重生成而非手改。I07 无 op 无需动契约。
- **不动**：invited 状态枚举与种子（家族约定 2026-09-10 值域含 2=invited）；REQ-2026-024 §2.3 文档章节随家族裁定再定。

### 环境/数据（非代码）

- saas_dev 发现空库（表结构齐、数据 0 行，根因未明）：shared 仓 `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54321/saas_dev node scripts/seed-db.mjs` 重灌完成（tenant 3 / oauth_client 4 / sys_user 5 / sys_role 4 / tenant_member 6 / tenant_member_role 6 / tenant_application 3 / sys_menu 41 / sys_role_menu 70）；live 验证 alice/dev123456+clientId=saas-console 登录通。若复发：先查 pgdata 建库时间戳与 `create-pg-databases.mjs` 执行痕迹。

## [0.7.46] — 2026-08-27

- 初始化台账：Next.js 15 全栈仓（前端 + IdP Route Handlers）。历史变更见 git log 与 `.state/session.json`。
