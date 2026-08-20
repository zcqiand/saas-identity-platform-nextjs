#!/bin/sh
# setup-vps.sh — VPS 一次性 bootstrap（Ubuntu/Debian）— saas-identity-platform-nextjs
#
# 用法:
#   sudo sh deploy/setup-vps.sh saas.example.com
#
# 同一台 VPS 上要先跑 lab-management-system-nextjs 的 setup-vps.sh（如果同时托管
# 两个服务）。本脚本只负责 saas 部分:目录、saas.env、不同 default_server。
#
# 这个脚本干这些事:
#   1. apt 装 nginx、docker（如未装，幂等）
#   2. 创建 deploy 用户（key-only SSH）+ 加进 docker 组
#   3. 建 /home/deploy/saas-identity-platform-nextjs/（无 data/，PG 远程）
#   4. 生成 saas.env（DATABASE_URL + JWT_SIGNING_KEY 随机；已存在则不动）
#   5. 渲染 deploy/nginx-vps.conf.example → /etc/nginx/sites-available/$DOMAIN
#   6. 启用 sites-enabled symlink；删 Ubuntu 默认页避免 default_server 冲突
#   7. nginx -t && reload
#
# 你**还要做**的（不在脚本里）:
#   a) 把 .crt / .key 放到 /etc/nginx/ssl/your-cert.{crt,key}（复用 lab 的 cert 则跳过）
#   b) 本地跑:ssh-copy-id -i ~/.ssh/id_ed25519_gh-deploy.pub deploy@VPS（lab 已做则跳过）
#   c) saas repo 的 GitHub Repository Secrets 加:
#        DOCKER_USERNAME / DOCKER_PASSWORD / VPS_HOST / VPS_USER / VPS_SSH_KEY /
#        DATABASE_URL_PROD

set -eu

DOMAIN="${1:-}"
if [ -z "$DOMAIN" ]; then
  echo "Usage: $0 <saas.example.com>" >&2
  exit 1
fi

BASE="/home/deploy/saas-identity-platform-nextjs"

log() { printf '→ %s\n' "$*"; }

# ── 1. 系统包 ─────────────────────────────────────
if ! command -v nginx >/dev/null 2>&1; then
  log "install nginx"
  apt-get update
  apt-get install -y nginx
fi
if ! command -v docker >/dev/null 2>&1; then
  log "install docker.io"
  apt-get install -y docker.io
fi

# ── 2. deploy 用户（无密码、SSH key only）─────────
if ! id deploy >/dev/null 2>&1; then
  log "create deploy user"
  adduser --disabled-password --gecos "" --shell /bin/bash deploy
fi
log "ensure deploy in docker group"
usermod -aG docker deploy

# ── 3. 部署目录 ───────────────────────────────────
# saas 用 PostgreSQL 远程,容器内不需要 data/ 卷。只建工作目录即可。
log "create $BASE"
sudo -u deploy mkdir -p "$BASE"

# cert 目录占位
mkdir -p /etc/nginx/ssl
chmod 700 /etc/nginx/ssl

# ── 4. saas.env（密钥只落 VPS，不进仓库/CI）──────
# DATABASE_URL:从 github secret 拉取，或手工填。其他 env 由 CI 注入容器。
# 已存在则保留（生产上不允许自动重置密钥）；新增 env 自动追加。
#
# 关键变量:
#   DATABASE_URL        — PostgreSQL 连接串（生产 saas_prod 库）
#   JWT_SIGNING_KEY     — Phase 5 HS256 签名密钥(jose)，与 springboot/aspnetcore
#                         JWT_KEY 同步。env 镜像 CLAUDE.md §JWT。
#   SAAS_CORS_ALLOWED_ORIGINS — 与 springboot SAAS_CORS_ALLOWED_ORIGINS 镜像
#   OAUTH_CODE_TTL / OAUTH_REFRESH_TTL — M04.F03 OAuth 2.0 TTL
if [ ! -f "$BASE/saas.env" ]; then
  log "generate $BASE/saas.env (DATABASE_URL + JWT_SIGNING_KEY)"
  if [ -z "${DATABASE_URL:-}" ]; then
    echo "ERROR: DATABASE_URL env var is required (e.g. DATABASE_URL=postgresql://user:pwd@host:5432/saas_prod sudo -E $0 $DOMAIN)" >&2
    exit 1
  fi
  SECRET="$(openssl rand -hex 32)"
  {
    printf 'DATABASE_URL=%s\n' "$DATABASE_URL"
    printf 'JWT_SIGNING_KEY=%s\n' "$SECRET"
    printf 'JWT_ISSUER=saas-identity-platform\n'
    printf 'JWT_AUDIENCE=saas-identity-platform-clients\n'
    printf 'JWT_TTL_SECONDS=3600\n'
    printf 'LOCKOUT_MAX_FAILS=5\n'
    printf 'LOCKOUT_WINDOW_MIN=15\n'
    printf 'LOCKOUT_COOLDOWN_MIN=30\n'
    printf 'OAUTH_CODE_TTL=600\n'
    printf 'OAUTH_REFRESH_TTL=604800\n'
    printf 'SAAS_CORS_ALLOWED_ORIGINS=https://saas.YOUR_DOMAIN,https://lab-domain.example\n'
    printf 'NEXT_PUBLIC_LAB_BASE_URL=https://lab-domain.example\n'
  } > "$BASE/saas.env"
  chown deploy:deploy "$BASE/saas.env"
  chmod 600 "$BASE/saas.env"
else
  log "keep existing $BASE/saas.env"
fi

# ── 5. 渲染 nginx vhost template ──────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TEMPLATE="${SCRIPT_DIR}/nginx-vps.conf.example"
if [ ! -f "$TEMPLATE" ]; then
  echo "Missing template: $TEMPLATE" >&2
  echo "Either run this from the deploy/ directory or git checkout first." >&2
  exit 2
fi

TARGET="/etc/nginx/sites-available/${DOMAIN}"
log "render → $TARGET"
sed "s/saas.YOUR_DOMAIN/${DOMAIN}/g" "$TEMPLATE" > "$TARGET"

# ── 6. 启用 + 解决 default_server 冲突 ─────────────
# saas 用 default_server（lab-management vhost 反代另起另一端口）。
log "enable site, drop sites-enabled/default"
ln -sf "$TARGET" "/etc/nginx/sites-enabled/${DOMAIN}"
# 仅在 sites-enabled/default 真实存在时删（lab 也可能跑在这台 VPS）
# 真正 default_server 留给本仓 nginx 内部 listen 80 default_server 声明
if [ -f /etc/nginx/sites-enabled/default ] && ! grep -l "default_server" /etc/nginx/sites-enabled/* 2>/dev/null | grep -v "${DOMAIN}" >/dev/null; then
  rm -f /etc/nginx/sites-enabled/default
fi

# ── 7. nginx 检查 + reload ────────────────────────
log "nginx -t"
nginx -t
log "reload"
systemctl reload nginx

log "saas VPS 配置完成"
log "剩下手工:"
log "  1) cert:/etc/nginx/ssl/your-cert.{crt,key}（复用 lab 的可跳过）"
log "  2) ssh-copy-id -i ~/.ssh/id_ed25519_gh-deploy.pub deploy@$(hostname -I | awk '{print $1}')（lab 已做可跳过）"
log "  3) saas repo GitHub Secrets: DOCKER_USERNAME / DOCKER_PASSWORD / VPS_HOST / VPS_USER / VPS_SSH_KEY / DATABASE_URL_PROD"
