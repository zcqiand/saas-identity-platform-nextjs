# 0001. 数据层从 SQLite 切到远程 PostgreSQL

- 状态: Accepted
- 日期: 2026-08-06
- 决策者: 用户

> 什么时候读我：动 `src/db/schema.ts`、`drizzle.config.ts`、`tests/setup-db.ts`、
> Dockerfile 数据库相关行，或讨论「为什么不留 sqlite 兜底」时。

## Context

项目初版数据层是 Drizzle ORM over `better-sqlite3`，dev/prod 都吃本地 SQLite 文件
（`data/dev.db`），测试用 `:memory:`。这个组合在三件事上撞墙：

- **生产持久性 / 并发**：SaaS 身份管理要在线上跑，SQLite 的单文件 + 单写者模型经不
  起多副本部署与并发写入；备份、迁移、监控都要重新发明轮子。
- **测试隔离**：`:memory:` SQLite 与 prod 的 PostgreSQL 方言不一致（FK 行为、类型、
  序列），用 SQLite 测出来的语义不能直通生产；过去已经因此踩过差异 bug。
- **远程协作**：开发机分散，本地 SQLite 文件无法共享，schema 漂移难发现。

线上已有一台 PostgreSQL 16.14 实例（`100.79.128.25:5432`），可供 dev / prod / test
三库共用。

## Decision

把数据层整体迁到 **PostgreSQL**，并彻底拆除 SQLite 兜底：

- **三库隔离**：在同一实例上建 `saas_dev` / `saas_prod` / `saas_test` 三个数据库；
  连接串通过 `DATABASE_URL` 环境变量注入（`.env.local` / `.env.test` / 容器 ENV），
  代码里不硬编码。drizzle-kit 配置见 `drizzle.config.ts`。
- **测试期 per-worker schema 隔离**：vitest 用 `pool: 'forks'`，每个 worker 在
  `saas_test` 里建独立 schema（`VITEST_SCHEMA`），跑完丢弃，互不污染；详见
  `tests/setup-db.ts`。这套用自定义 migrator 直接 `CREATE SCHEMA` + 跑 SQL，绕开
  drizzle-kit 默认 migrator（它对 FK 做了 schema-qualifier 处理，与 per-schema 模型
  冲突）。
- **driver 用 `node-postgres`（`pg`）Pool**：Drizzle 的 `drizzle-orm/node-postgres`
  适配器，所有消费方走 async API（不再是 better-sqlite3 的同步 `prepare().all()`）。
- **不留 SQLite 兜底**：`better-sqlite3` / `@types/better-sqlite3` 从 `package.json`
  卸载；`DB_PATH` 环境变量、`:memory:` 分支、SQLite 专属的 native build 工具链
  （`python3` / `make` / `g++` / `libc6-compat` / `npm_config_better_sqlite3_binary_host_mirror`）
  一并从 Dockerfile 删除。`pg` 是纯 JS driver，构建链因此简化。
- schema.ts 的列定义从 sqlite 语义改为 pg 语义（`integer().primaryKey()` 换
  `serial().primaryKey()` 等），但表结构与索引语义保持等价，迁移由 `drizzle/` 下的
  SQL 文件驱动。

CLAUDE.md §1 的栈声明同步改为 `Drizzle ORM (PostgreSQL)`；§2 的「改 schema.ts 后
`npx drizzle-kit generate`」机制不变（drizzle-kit 同样管 pg 迁移）。

## Alternatives considered

### 保留 SQLite 作为 dev 兜底
被拒绝：dev 与 prod 方言不一致本身就是 bug 源；保留它意味着每次 schema 改动要维护
两套迁移、两套类型语义，且 dev 通过的代码在 prod 可能挂。既然已经有共享的远程 pg，
没有理由再养一套本地 DB。

### 用 Docker 起本地 pg 替代远程
被拒绝：开发机分散、配置成本高；远程实例已就绪且三库隔离干净，本地 docker pg 反而
多一层运维。

## Consequences

正面：
- dev / prod / test 同方言，测试语义可直通生产；schema 漂移由 drizzle-kit 迁移文件
  统一管。
- 生产可用多副本 / 备份 / 监控等 pg 生态工具，不再受 SQLite 单写者约束。
- 构建链简化：Dockerfile 不再需要 native 编译工具链，镜像更小、构建更快、CI 更稳。

负面（必填，不能为空）：
- **消费方全部异步化**：所有原来同步 `db.prepare().all()` 的调用点改为 `await
  db.select()...`，调用链路上的 server action / route handler 都得 `async`；漏改一
  处 tsc 会报错（已在本次迁移一并修完，但未来新增消费方需默认 async）。
- **远程 pg 是单点**：dev / prod / test 共用一台实例，实例宕三库全挂；后续若上生产
  规模，需要考虑主从 / 备份策略。
- **测试连远程慢一截**：`beforeAll` 里跑 pg 迁移到远端库，首次连接 + 建 schema 比
  `:memory:` SQLite 慢，已在 `vitest.config.ts` 放宽 `hookTimeout` 到 60s；CI 跑测
  试前需保证网络可达实例。
- **测试自定义 migrator**：必须维护 `tests/setup-db.ts` 里的 migrator，不能直接复
  用 drizzle-kit 的（FK schema-qualifier 冲突）；drizzle-orm 升级时这个绕开点要复
  查。
- **`DATABASE_URL` 必须运行期注入**：镜像里不内置连接串，部署方必须 `-e
  DATABASE_URL=...`；漏注入容器启动会连不上库。
