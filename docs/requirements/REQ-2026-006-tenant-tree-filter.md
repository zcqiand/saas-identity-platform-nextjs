# 需求 — 5 个管理页租户树过滤

## 1. 背景与目标

5 个管理页（部门 / 岗位 / 用户组别 / 角色 / 用户）当前以 admin 视角展示所有租户数据，规模小（2 租户）时尚可；一旦多租户接入或数据量上升，运营/管理员需要按租户快速切片。

加左栏租户树后，点租户节点即自动按 `tenantId` 等值过滤右侧 5 页列表，跨 5 页保留选择；切出 5 个管理页时左栏消失。

## 2. 验收标准

- [ ] 5 个管理页（departments / positions / user-groups / roles / users）任一进入时，左侧 240px 租户树渲染，节点 = tenants.json 2 行（acme + tenant-lab）+ 「N 部门 / N 用户 / N 角色」汇总
- [ ] 点租户节点后，右侧 5 个表的查询自动加 `WHERE tenant_id = $1`，URL 同步加 `?tenant=acme` 或 `?tenant=tenant-lab`
- [ ] 5 页之间切换，租户选择保留
- [ ] F5 刷新若无 `?tenant=` 参数，5 个表回退到「全部租户」视图（admin 视角）
- [ ] 切出 5 个管理页（如去 audit-logs / settings），左栏租户树消失
- [ ] 点「全部」按钮清除选择，5 个表回到所有租户
- [ ] store 层加 `tenantId` 参数；drizzle query 加 `eq(roles.tenantId, $tenantId)` 等透传
- [ ] 5 个 page 顶部容器挂 `data-fn=M0X.F0Y.IZ` 对应新增子项

## 3. 范围外

- 不动 audit-logs / permission-groups / api-keys / apps / settings 等非管理页
- 不动 tenants 自身的 CRUD（树读来自 M01.F01 已有 list 接口）
- 不重做 5 个页的 dialog / 列表 / 业务逻辑
- 不增加新 schema 或 migration（仅读 tenants 表 + 既有 store）
- 不做跨租户隔离的写权限检查
- 不引入新依赖（pinia 已存在；URL 双向同步用原生 router）

## 4. 功能影响

| 变更类型 | 功能 ID | 说明 |
|---|---|---|
| 改动 | M02.F01.I01 部门列表 / M02.F02.I01 用户列表 / M02.F03.I01 岗位列表 / M03.F01.I01 角色列表 / M03.F03.I01 用户组列表 | 加 tenantId filter 参数，list query 透传到 drizzle where |
| 改动 | M01.F01.I08 租户布局与切换 | 5 个管理页共用此 layout；左栏 tenant-tree-sidebar 嵌入 |
| 新增 | M02.F01.I10 部门租户树过滤 | store listDepartments(tenantId?) + page 顶部 data-fn |
| 新增 | M02.F02.I10 用户租户树过滤 | store listUsers(tenantId?) + page 顶部 data-fn |
| 新增 | M02.F03.I06 岗位租户树过滤 | store listPositions(tenantId?) + page 顶部 data-fn |
| 新增 | M03.F01.I11 角色租户树过滤 | store listRoles(tenantId?) + page 顶部 data-fn |
| 新增 | M03.F03.I06 用户组别租户树过滤 | store listUserGroups(tenantId?) + page 顶部 data-fn |

新子项走 `/tree-change` 提案，由人批准。
