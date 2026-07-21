# DEPLOYMENT.md — saas-identity-platform-nextjs

> Next.js 版部署手册。和 `saas-identity-platform/DEPLOYMENT.md` 同构，但有几处实质差异。
> 读这份之前可以先扫一遍姊妹仓那份 ch42 经验汇总（15 个坑），这里只列 Next.js 专属差异。

---

## 1. TL;DR

发布新版本：

```bash
git tag vX.Y-ZZZ master
git push origin vX.Y-ZZZ
```

Action 跑 → vitest → docker build → push 到 Docker Hub → VPS 拉 → 容器起来 → `https://<domain>/` 看到 SPA。整个流程 5-15 分钟。

回滚一次老版本：

```bash
ssh deploy@VPS
cd /home/deploy/saas-identity-platform-nextjs
sh saas-identity-platform-nextjs.sh <DOCKER_USER> <DOCKER_PAT> vX.Y-OLD   # ← 老 tag
```

---

## 2. 架构

```
浏览器
   │
   │  HTTPS
   ▼
┌─────────────────────────────────────────────────────────┐
│ VPS nginx                            nginx/1.24 (Ubuntu)│ ←── TLS 终结 + HSTS 头
│   反代 gateway（public-facing）                            │
└─────────────────────────────────────────────────────────┘
   │
   │  http://127.0.0.1:8065   （docker run -p 决定端口）
   ▼
┌─────────────────────────────────────────────────────────┐
│ 容器内 nginx                       nginx/1.27 (alpine)  │ ←── SPA 静态 serve + 缓存
│   app server（private）    node:20-alpine + next start   │
└─────────────────────────────────────────────────────────┘
   │
   ├─→ /app/.next/static/   ←── Next.js build 静态资源（nginx 直接 serve）
   ├─→ /app/public/         ←── Next.js public/（nginx 直接 serve）
   └─→ http://127.0.0.1:3000   ←── Next.js standalone server（动态 / API / server actions）
```

和老项目（Vite SPA）的**核心差异**：

| 项 | 老项目（Vite SPA） | 本项目（Next.js） |
|---|---|---|
| 容器内运行时 | nginx only（纯静态） | **node + nginx**（node 在后台，nginx 反代） |
| Node 进程 | 无 | `node server.js`（next standalone，PORT=3000） |
| 数据 | 无 | SQLite 文件挂 `/app/data`（prod 用 volume `-v /srv/.../data:/app/data`） |
| 反代目标 | `http://127.0.0.1:8061:80` → nginx 直接 serve 静态 | `http://127.0.0.1:8065:80` → nginx 反代到 `:3000` |
| 数据库迁移 | 无 | 首次部署需要 `npm run db:bootstrap`（prod 用同样路径） |

两层职责彻底分开：外部 TLS / HSTS / 域名前缀在 VPS；SPA 静态、缓存、gzip、Node 进程在容器内。

---

## 3. 前置依赖

| 项 | 要求 |
|---|---|
| VPS | Ubuntu 22.04+ amd64 |
| 公网 IP | 一个 |
| 域名 | 已 A 指向 VPS IP（或 Cloudflare Proxied 但**先切 DNS-only**） |
| Docker | ≥ 24.x |
| SSH | 你本地能给 deploy 用户一把 ed25519 key |
| GitHub Actions | repo 里有 workflow 可跑 |

---

## 4. GitHub Secrets（Repository 级别）

| Name | 用途 | 来源 |
|---|---|---|
| `VPS_HOST` | VPS 公网 IP / 域名 | 静态 |
| `VPS_USER` | SSH 用户名 | 固定 `deploy` |
| `VPS_SSH_KEY` | deploy 用户的 ed25519 **私钥**全文 | `cat ~/.ssh/id_ed25519_gh-deploy` |
| `DOCKER_USERNAME` | Docker Hub 用户名 | 静态 |
| `DOCKER_PASSWORD` | Docker Hub PAT（`dckr_pat_xxx...`） | Docker Hub → Security → New Token，**Read, Write, Delete** |

> **别建 environment**，别用 `environment: VPS` 这种声明——会让 secrets 全部解析成空字符串，CI 跑到 docker/login-action 直接 `Username and password required`。

---

## 5. VPS 一次性配置

`deploy/setup-vps.sh <your-domain>` 一把搞完：

1. apt 装 nginx、docker（如未装）
2. 创建 deploy 用户，key-only SSH
3. 加 deploy 进 docker 组
4. 创建 `/home/deploy/saas-identity-platform-nextjs/`
5. 创建 `/srv/saas-identity-platform-nextjs/data/`（SQLite 数据持久化目录）
6. 渲染 `deploy/nginx-vps.conf.example` → `/etc/nginx/sites-available/<your-domain>`
7. 启用：建 symlink + 删 Ubuntu 默认页（避免 `default_server` 重复）
8. nginx -t && reload

脚本**做完上面的**，你**还要手工**做的 3 件事：

| 事项 | 怎么 |
|---|---|
| Cert | 把 `fullchain.pem` + `privkey.pem` 拷到 VPS `/etc/nginx/ssl/your-cert.{crt,key}` |
| SSH key | 本地：`ssh-copy-id -i ~/.ssh/id_ed25519_gh-deploy.pub deploy@<VPS-IP>` |
| GitHub Secrets | 加 5 个如上表 |

---

## 6. 首次启动数据库

容器起来后，`/app/data` 是空的。SQLite 表还没建。

```bash
ssh deploy@VPS
docker exec -it saas-identity-platform-nextjs sh
cd /app
# 在容器里跑（standalone 不带 drizzle-kit，要单独装）
# 或者：你把 data/dev.db 从本地拷过来
# 或者：在 Dockerfile 加一层 seed 阶段（CI 跑 build 时 generate → bake 进镜像）
```

**当前做法**：把本地 `data/dev.db` 用 `docker cp` 拷进去：

```bash
docker cp data/dev.db saas-identity-platform-nextjs:/app/data/dev.db
docker exec saas-identity-platform-nextjs chown nextjs:nodejs /app/data/dev.db
docker restart saas-identity-platform-nextjs
```

未来要做：把 `npm run db:bootstrap` 加进 Dockerfile 的 builder 阶段，把 seed 好的 dev.db 烤进镜像，prod 启动时直接有数据。

---

## 7. 触发发布

```bash
git checkout master
git pull --rebase origin master
git tag vX.Y-ZZZ master    # ← Project 号 NNN，自增
git push origin vX.Y-ZZZ
```

Action 自动跑 4 个 step：

```
test            vitest run（阈值检查走 suite 端的 gate.py，不在 CI 重复）
docker login    DOCKER_USERNAME + DOCKER_PASSWORD
docker build    多阶段 build（npm ci + next build + standalone 拷贝）
docker push     :latest + :vX.Y-ZZZ 双 tag
ssh → VPS       sh saas-identity-platform-nextjs.sh USER PASS vX.Y-ZZZ
                docker login + pull + stop + rm + run + prune
                → deploy done at 2026-07-21Txx:xx:xxZ UTC  ← 整链绿
```

---

## 8. 回滚

```bash
ssh -i ~/.ssh/id_ed25519_gh-deploy deploy@VPS
cd /home/deploy/saas-identity-platform-nextjs
sh saas-identity-platform-nextjs.sh zcqiand <DOCKER_PAT> v1.0-001   # 老 tag
# 容器立刻把镜像切到老 tag、起 nginx
```

或更简单：**re-tag 老 commit** 走 Action。回头 `git tag -f v1.0-002 <old-commit-sha> && git push origin v1.0-002 --force` —— 但 GitHub Releases 会指向错乱，**生产慎用**。

---

## 9. 与老项目（Vite SPA）的差异清单

| 差异点 | 老项目 | 本项目 | 怎么改 |
|---|---|---|---|
| 端口 | 8061 | **8065** | `deploy/saas-identity-platform-nextjs.sh` `-p 127.0.0.1:8065:80` |
| 反代目标 | nginx 直接 serve 静态 | nginx 反代到 `:3000` | `deploy/nginx.conf` `proxy_pass http://127.0.0.1:3000` |
| 容器内进程 | 1 个（nginx） | **2 个**（node + nginx） | `deploy/entrypoint.sh` 先拉 node、再拉 nginx |
| 启动顺序 | nginx 起就 ready | node 起 → 等 ready → nginx 起 | entrypoint `wget 127.0.0.1:3000` 30s 探活 |
| 数据持久化 | 无（纯静态） | SQLite 文件 | `-v /srv/.../data:/app/data` |
| next.config | n/a | `output: 'standalone'` | next.config.ts 加这一行 |
| better-sqlite3 | n/a | native binding 必须 COPY 进镜像 | Dockerfile 显式 COPY `node_modules/better-sqlite3` 等 |

---

## 10. Next.js 专属坑（按出现顺序）

### 坑 N1：`output: 'standalone'` 没开
- **症状**：docker build 报找不到 `server.js`，或镜像跑起来只启了 nginx 但 502
- **根因**：next 默认 build 产物不带 standalone server，必须显式开
- **修法**：`next.config.ts` 加 `output: 'standalone'`，重新 build

### 坑 N2：better-sqlite3 找不到 `.node` 文件
- **症状**：容器起 node 后日志 `Error: Cannot find module 'better-sqlite3'`，或 `invalid ELF header`
- **根因**：standalone 只 follow JS 依赖图，不带 native binding
- **修法**：Dockerfile 显式 COPY `node_modules/better-sqlite3` + 它依赖的 `bindings` + `file-uri-to-path`
- **验证**：进容器 `node -e "require('better-sqlite3')"` 不报错

### 坑 N3：容器 node 进程 dlopen 权限错
- **症状**：node 起不了 `Error: EACCES: permission denied, open '/app/node_modules/better-sqlite3/build/Release/...node'`
- **根因**：COPY 时 owner 是 nextjs，但 entrypoint USER root 启动进程，dlopen 受限
- **修法**：entrypoint.sh 跑 `chmod -R a+rX /app/node_modules/better-sqlite3`

### 坑 N4：serverExternalPackages 没用
- **症状**：next build 把 better-sqlite3 打进 server bundle，容器跑 standalone 时找不到
- **根因**：默认 next 不 externalize native binding
- **修法**：`next.config.ts` 已有 `serverExternalPackages: ["better-sqlite3"]`，不要删

### 坑 N5：standalone server 起来后 nginx 502
- **症状**：nginx 起得了，但所有动态请求 502
- **根因**：entrypoint 启 nginx 时 node 还没 ready，或 nginx 配置 `proxy_pass` 写错端口
- **修法**：
  - entrypoint 等 node ready 才起 nginx（当前实现）
  - 容器内 nginx `proxy_pass http://127.0.0.1:3000`（不是 `:8065`，那是宿主机端口）

### 坑 N6：dev.db 不在容器内
- **症状**：API 一调就 `SQLITE_CANTOPEN`，或 drizzle schema 找不到
- **根因**：data/ 不在镜像里（被 .dockerignore 排除），volume 也没挂
- **修法**：
  - 短期：本地 build 后 `docker cp data/dev.db ...:/app/data/dev.db`
  - 长期：Dockerfile 加 seed 阶段把 db 烤进镜像

### 坑 N7：`AUTH_JWT_SECRET` 走默认 test secret
- **症状**：prod 登录的 token 是用 test secret 签的，重启容器后所有 token 失效
- **根因**：deploy.sh 没传 `AUTH_JWT_SECRET` 环境变量
- **修法**：deploy.sh 加 `-e AUTH_JWT_SECRET="${AUTH_JWT_SECRET:-}"`，从 CI secrets 注入

### 坑 N8：静态资源 404
- **症状**：浏览器访问首页，HTML 拿到了但 `/_next/static/...` 全 404
- **根因**：standalone 不带 static 目录，必须 COPY
- **修法**：Dockerfile `COPY --from=builder ./.next/static ./.next/static`

---

## 11. 文件索引

```
.github/workflows/ci.yml                  # workflow：test → docker build & push → ssh deploy
Dockerfile                                # 多阶段 build：deps → builder → runtime (node + nginx)
.dockerignore                             # 排除 node_modules / .next / data / .git 等
deploy/nginx.conf                         # 容器内 nginx（serve SPA + cache + gzip + 反代 :3000）
deploy/entrypoint.sh                      # 容器启动（先拉 node、等 ready、再拉 nginx）
deploy/nginx-vps.conf.example             # VPS nginx 参考模板（含 cert / proxy_pass 占位）
deploy/saas-identity-platform-nextjs.sh   # VPS deploy 脚本（CI ssh 调用，跑容器切换）
deploy/setup-vps.sh                       # VPS bootstrap 脚本（一次性）
docs/DEPLOYMENT.md                        # 你正在读的这篇
```

---

## 12. 关键提醒（贴在每次部署前）

```
1. ls /etc/nginx/sites-enabled/                                       ← 看到 symlink 才证明 vhost 真生效
2. sudo nginx -t                                                      ← 改了 vhost 必跑
3. docker ps -a --filter name=saas-identity-platform-nextjs           ← 看到 Up 才证明镜像跑的版本对
4. docker logs saas-identity-platform-nextjs --tail 30                 ← 头一次发现 crash loop
5. curl -kI https://<VPS-IP>/ -H "Host: <DOMAIN>"                      ← 直连验 VPS 后置 proxy
6. Cloudflare DNS Records: A record 状态                                ← 灰云 / 橙云
7. ls -la /srv/saas-identity-platform-nextjs/data/                     ← SQLite 文件存在 + 权限
8. docker exec saas-identity-platform-nextjs node -e "require('better-sqlite3')"  ← dlopen 验证
```