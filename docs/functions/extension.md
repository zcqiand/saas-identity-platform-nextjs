# Function Tree Extension — saas-identity-platform-nextjs

> nextjs 仓独有 7 个 M01 item（OAuth IdP 4 + Dashboard 3）。详见 [ADR 0001](../../../../../saas-identity-platform-shared/docs/adr/0001-shared-submodule-structure.md) §「Function-tree 模型」。
>
> 与 base 划边：本文件不在 shared 仓 base 内，也不被 React/Vue 仓同步。

---

## M01 扩展

### M01.F04 — 扩展（OAuth 委托登录）

| 功能 ID | 功能名称 | 业务闭环 | 状态 |
|---|---|---|---|
| M01.F04 | 扩展 — OAuth 委托登录 (nextjs 独有) | lab-nextjs 委托登录 4 个 OAuth IdP 路由 | 已上线 |

| 子项 ID | 名称 | 类型 | 状态 |
|---|---|---|---|
| M01.F04.I06 | 授权码端点（/api/sso/authorize） | 接口 | 已上线 |
| M01.F04.I07 | 授权码换 token（/api/auth/oauth/callback） | 接口 | 已上线 |
| M01.F04.I08 | 权限集端点（/api/auth/permissions） | 接口 | 已上线 |
| M01.F04.I09 | 业务菜单端点（/api/sso/menus） | 接口 | 已上线 |

### M01.F05 — 仪表盘首页 (nextjs 独有)

| 功能 ID | 功能名称 | 业务闭环 | 状态 |
|---|---|---|---|
| M01.F05 | 仪表盘首页 | tenants/users/todayLogins 3 卡 + 跳转 | 已上线 |

| 子项 ID | 名称 | 类型 | 状态 |
|---|---|---|---|
| M01.F05.I01 | 仪表盘页面 | 页面 | 已上线 |
| M01.F05.I02 | 卡片聚合查询 | 接口 | 已上线 |
| M01.F05.I03 | 卡片点击跳转 | 按钮 | 已上线 |
