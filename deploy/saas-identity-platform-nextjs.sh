#!/bin/sh
# Usage: saas-identity-platform-nextjs.sh <DOCKER_USERNAME> <DOCKER_PASSWORD> [VERSION]
#
# 由 .github/workflows/ci.yml 的 deploy job 远程调用:
#   ssh deploy@vps -- cd /home/deploy/saas-identity-platform-nextjs
#                    && sh saas-identity-platform-nextjs.sh $DOCKER_USERNAME $DOCKER_PASSWORD $VERSION
#
# VERSION 默认是 latest。tag-based deploy 时显式传 tag 名(v1.1-001)。
# CI 同时 push :latest + :<tag> 两份镜像,回滚只要手动指定旧 tag 再跑一次本脚本。
#
# 与姊妹仓 lab-management-system-nextjs.sh 的差异:
#   - 数据库:PostgreSQL 远程,DATABASE_URL 从 saas.env 注入(无本地 ./data 卷)
#   - 容器内是 Node(next start :3000)→ -p 127.0.0.1:8022:3000
#   - 密钥走 ./saas.env(DATABASE_URL + JWT_SIGNING_KEY),由 setup-vps.sh 生成,
#     只存在于 VPS
#
# 前置:deploy 用户需在 docker 组中(sudo usermod -aG docker deploy)。
#       saas.env 必须由 setup-vps.sh 提前生成(DATABASE_URL 必填)。

set -eu

USERNAME="${1:-}"
PASSWORD="${2:-}"
VERSION="${3:-latest}"
IMAGE="${USERNAME}/saas-identity-platform-nextjs:${VERSION}"
BASE="/home/deploy/saas-identity-platform-nextjs"
CONTAINER_NAME="saas-identity-platform-nextjs"
HOST_PORT=8022

if [ -z "$USERNAME" ] || [ -z "$PASSWORD" ]; then
  echo "Usage: $0 <DOCKER_USERNAME> <DOCKER_PASSWORD> [VERSION]" >&2
  exit 2
fi

# saas.env 自举保护:缺失时,如 $DATABASE_URL 在环境里,自动生成(密钥随机);
# 否则 fail fast(避免凭空写默认 URL 触发对 saas_dev 的生产事故)。
# setup-vps.sh 仍是首推(VPS 一次性,生成 nginx + saas.env + cert),本分支仅
# 给"先有 DATABASE_URL 临时上线"的场景。
if [ ! -f "$BASE/saas.env" ]; then
  if [ -n "${DATABASE_URL:-}" ]; then
    echo "→ bootstrapping $BASE/saas.env from env DATABASE_URL"
    umask 077
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
      printf 'SAAS_CORS_ALLOWED_ORIGINS=https://saas.YOUR_DOMAIN,https://lab-nextjs.xiangru.uk\n'
      printf 'NEXT_PUBLIC_ENABLE_MSW=false\n'
      printf 'NEXT_PUBLIC_API_BASE_URL=\n'
      printf 'NEXT_PUBLIC_LAB_BASE_URL=https://lab-nextjs.xiangru.uk\n'
      printf 'NEXT_PUBLIC_LAB_APP_CODE=lab-management\n'
    } > "$BASE/saas.env"
    chown deploy:deploy "$BASE/saas.env" 2>/dev/null || true
    chmod 600 "$BASE/saas.env"
  else
    echo "ERROR: $BASE/saas.env missing. Set DATABASE_URL env or run setup-vps.sh first." >&2
    exit 1
  fi
fi
# 校验 saas.env 里有 DATABASE_URL
if ! grep -q '^DATABASE_URL=' "$BASE/saas.env"; then
  echo "ERROR: $BASE/saas.env has no DATABASE_URL line" >&2
  exit 1
fi

# nginx vhost 自举（缺时创建,不 reload —— reload 要 root）:
# 检测 /etc/nginx/sites-enabled/<NGINX_DOMAIN> 是否存在;缺时从 nginx-vps.conf.example
# 模板渲染,做 symlink。reload 需 sudo,留给手工:
#   sudo nginx -t && sudo systemctl reload nginx
NGINX_DOMAIN="${NGINX_DOMAIN:-saas-nextjs.xiangru.uk}"
NGINX_CERT_BASENAME="${NGINX_CERT_BASENAME:-xiangru-uk}"
NGINX_SITES_AVAILABLE="/etc/nginx/sites-available"
NGINX_SITES_ENABLED="/etc/nginx/sites-enabled"
NGINX_VHOST_FILE="${NGINX_SITES_AVAILABLE}/${NGINX_DOMAIN}"
NGINX_VHOST_LINK="${NGINX_SITES_ENABLED}/${NGINX_DOMAIN}"
NGINX_TEMPLATE="${BASE}/nginx-vps.conf.example"

# 拉模板（deploy/ 目录随仓库 deploy 脚本一起,但首次拉时可能不存在,补一下）
if [ ! -f "${NGINX_TEMPLATE}" ]; then
  echo "→ fetching nginx-vps.conf.example template"
  curl -fsSL "https://raw.githubusercontent.com/zcqiand/saas-identity-platform-nextjs/refs/heads/master/deploy/nginx-vps.conf.example" -o "${NGINX_TEMPLATE}"
fi

if [ -e "${NGINX_VHOST_LINK}" ] || [ -e "${NGINX_VHOST_FILE}" ]; then
  echo "→ nginx vhost ${NGINX_VHOST_FILE} already exists, skip bootstrap"
else
  echo "→ nginx vhost missing, bootstrapping ${NGINX_VHOST_FILE} (domain=${NGINX_DOMAIN} cert=${NGINX_CERT_BASENAME})"
  umask 022
  sed \
    -e "s/saas.YOUR_DOMAIN/${NGINX_DOMAIN}/g" \
    -e "s|/etc/nginx/ssl/your-cert.crt|/etc/nginx/ssl/${NGINX_CERT_BASENAME}.crt|g" \
    -e "s|/etc/nginx/ssl/your-cert.key|/etc/nginx/ssl/${NGINX_CERT_BASENAME}.key|g" \
    "${NGINX_TEMPLATE}" > "${NGINX_VHOST_FILE}"
  ln -sf "${NGINX_VHOST_FILE}" "${NGINX_VHOST_LINK}"
  echo "→ nginx vhost created. To enable: sudo nginx -t && sudo systemctl reload nginx"
fi

# 必要时补 JWT_SIGNING_KEY(JWT 是 Phase 5 上;HS256 真签发需要这个密钥,与
# springboot/aspnetcore 同步)。已有则不覆盖,避免失效所有登录态。
if ! grep -q '^JWT_SIGNING_KEY=' "$BASE/saas.env"; then
  echo "→ append JWT_SIGNING_KEY to existing $BASE/saas.env"
  umask 077
  printf 'JWT_SIGNING_KEY=%s\n' "$(openssl rand -hex 32)" >> "$BASE/saas.env"
  printf 'JWT_ISSUER=saas-identity-platform\n' >> "$BASE/saas.env"
  printf 'JWT_AUDIENCE=saas-identity-platform-clients\n' >> "$BASE/saas.env"
  printf 'JWT_TTL_SECONDS=3600\n' >> "$BASE/saas.env"
fi

# 补 NEXT_PUBLIC_* 走真后端 (MSW 关,同源 API_BASE_URL 空 → 本仓 Route Handler)
if ! grep -q '^NEXT_PUBLIC_ENABLE_MSW=' "$BASE/saas.env"; then
  echo "→ append NEXT_PUBLIC_ENABLE_MSW=false + NEXT_PUBLIC_API_BASE_URL="
  umask 077
  printf 'NEXT_PUBLIC_ENABLE_MSW=false\n' >> "$BASE/saas.env"
  printf 'NEXT_PUBLIC_API_BASE_URL=\n' >> "$BASE/saas.env"
  printf 'NEXT_PUBLIC_LAB_BASE_URL=https://lab-nextjs.xiangru.uk\n' >> "$BASE/saas.env"
  printf 'NEXT_PUBLIC_LAB_APP_CODE=lab-management\n' >> "$BASE/saas.env"
fi

echo "→ image: $IMAGE"
echo "→ docker login"
printf '%s' "$PASSWORD" | docker login -u "$USERNAME" --password-stdin

echo "→ docker pull"
docker pull "$IMAGE"

echo "→ docker stop & rm $CONTAINER_NAME"
docker stop "$CONTAINER_NAME" 2>/dev/null || true
docker rm "$CONTAINER_NAME" 2>/dev/null || true

echo "→ docker run"
docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  -p "127.0.0.1:${HOST_PORT}:3000" \
  --env-file "$BASE/saas.env" \
  "$IMAGE"

echo "→ docker image prune"
docker image prune -f

echo "→ docker ps"
docker ps --filter name="$CONTAINER_NAME"

# 健康检查:容器 healthcheck 30s 内应 healthy
echo "→ waiting for container health..."
i=0
while [ $i -lt 30 ]; do
  STATUS=$(docker inspect --format='{{.State.Health.Status}}' "$CONTAINER_NAME" 2>/dev/null || echo "starting")
  if [ "$STATUS" = "healthy" ]; then
    echo "→ container healthy after ${i}s"
    break
  fi
  if [ "$STATUS" = "unhealthy" ]; then
    echo "→ container unhealthy, logs:"
    docker logs --tail 30 "$CONTAINER_NAME"
    exit 1
  fi
  i=$((i+1))
  sleep 1
done

if [ $i -ge 30 ]; then
  echo "→ container failed to become healthy in 30s, logs:"
  docker logs --tail 30 "$CONTAINER_NAME"
  exit 1
fi

echo "→ deploy done at $(date -u)"
