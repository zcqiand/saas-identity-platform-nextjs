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

# saas.env 自举保护:缺失时 fail fast。saas.env 含 DATABASE_URL,绝不能由 CI 凭空
# 写一个默认 URL(它会触发对 saas_dev 的生产容器写入,跨域事故)。setup-vps.sh
# 必须先跑过。
if [ ! -f "$BASE/saas.env" ]; then
  echo "ERROR: $BASE/saas.env missing. Run setup-vps.sh first." >&2
  exit 1
fi
# 校验 saas.env 里有 DATABASE_URL
if ! grep -q '^DATABASE_URL=' "$BASE/saas.env"; then
  echo "ERROR: $BASE/saas.env has no DATABASE_URL line" >&2
  exit 1
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
