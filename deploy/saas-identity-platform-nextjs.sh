#!/bin/sh
# =============================================================================
# deploy/saas-identity-platform-nextjs.sh — VPS 部署脚本
#
# 由 GitHub Actions 通过 SSH 远程调用：
#   ssh deploy@VPS "sh saas-identity-platform-nextjs.sh <DOCKER_USER> <DOCKER_PAT> <TAG>"
#
# 老项目同构脚本：saas-identity-platform/DEPLOYMENT.md §7 第 4 步。
# 这里只是端口改成 8065、image 名改成 nextjs 版。
#
# 数据持久化：
#   -v /srv/saas-identity-platform-nextjs/data:/app/data
#   容器重启 / 升级不丢 SQLite。
#
# 端口：
#   -p 127.0.0.1:8065:80
#   VPS 上 nginx vhost 反代到 http://127.0.0.1:8065。
# =============================================================================

set -e

DOCKER_USER="${1:-zcqiand}"
DOCKER_PAT="${2:?usage: $0 <DOCKER_USER> <DOCKER_PAT> <TAG>}"
TAG="${3:?usage: $0 <DOCKER_USER> <DOCKER_PAT> <TAG>}"

IMAGE="docker.io/${DOCKER_USER}/saas-identity-platform-nextjs:${TAG}"
CONTAINER_NAME="saas-identity-platform-nextjs"
HOST_PORT=8065
DATA_DIR="/srv/${CONTAINER_NAME}/data"

echo "[deploy] image:    ${IMAGE}"
echo "[deploy] port:     127.0.0.1:${HOST_PORT}:80"
echo "[deploy] data dir: ${DATA_DIR}"

# ---- 准备 data 目录 ----
mkdir -p "${DATA_DIR}"

# ---- docker login ----
echo "[deploy] docker login..."
echo "${DOCKER_PAT}" | docker login -u "${DOCKER_USER}" --password-stdin docker.io

# ---- pull image ----
echo "[deploy] docker pull..."
docker pull "${IMAGE}"

# ---- 停 + 删旧容器（如果存在）----
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "[deploy] stopping existing container ${CONTAINER_NAME}..."
    docker stop "${CONTAINER_NAME}" 2>/dev/null || true
    docker rm "${CONTAINER_NAME}" 2>/dev/null || true
fi

# ---- 起新容器 ----
echo "[deploy] starting new container..."
docker run -d \
    --name "${CONTAINER_NAME}" \
    --restart unless-stopped \
    -p 127.0.0.1:${HOST_PORT}:80 \
    -v "${DATA_DIR}:/app/data" \
    -e NODE_ENV=production \
    -e AUTH_JWT_SECRET="${AUTH_JWT_SECRET:-change-me-in-prod-please-32chars-min}" \
    "${IMAGE}"

# ---- 等容器 healthcheck 通过 ----
echo "[deploy] waiting for container health..."
i=0
while [ $i -lt 30 ]; do
    STATUS=$(docker inspect --format='{{.State.Health.Status}}' "${CONTAINER_NAME}" 2>/dev/null || echo "starting")
    if [ "$STATUS" = "healthy" ]; then
        echo "[deploy] container healthy after ${i}s"
        break
    fi
    if [ "$STATUS" = "unhealthy" ]; then
        echo "[deploy] container unhealthy, logs:"
        docker logs --tail 30 "${CONTAINER_NAME}"
        exit 1
    fi
    i=$((i+1))
    sleep 1
done

if [ $i -ge 30 ]; then
    echo "[deploy] container failed to become healthy in 30s, logs:"
    docker logs --tail 30 "${CONTAINER_NAME}"
    exit 1
fi

# ---- 验证可达 ----
echo "[deploy] verifying http://127.0.0.1:${HOST_PORT}/..."
HTTP_CODE=$(wget -qSO- "http://127.0.0.1:${HOST_PORT}/" 2>&1 | grep -E "^  HTTP" | awk '{print $2}' | head -1 || echo "000")
echo "[deploy] http status: ${HTTP_CODE}"
if [ "${HTTP_CODE}" != "200" ] && [ "${HTTP_CODE}" != "307" ] && [ "${HTTP_CODE}" != "302" ]; then
    echo "[deploy] unexpected status, dumping logs:"
    docker logs --tail 30 "${CONTAINER_NAME}"
    exit 1
fi

# ---- 清理老镜像（只清 saas-identity-platform-nextjs 标签下的，不动别的）----
echo "[deploy] pruning old images..."
docker images --format '{{.Repository}}:{{.Tag}} {{.ID}}' \
  | grep "^docker.io/${DOCKER_USER}/saas-identity-platform-nextjs:" \
  | grep -v ":${TAG}" \
  | awk '{print $2}' \
  | xargs -r docker rmi -f 2>/dev/null || true

# ---- docker logout ----
docker logout docker.io > /dev/null 2>&1 || true

echo "[deploy] done at $(date -u +%Y-%m-%dT%H:%M:%SZ) UTC"
echo "[deploy] tag=${TAG} image=${IMAGE} port=${HOST_PORT}"