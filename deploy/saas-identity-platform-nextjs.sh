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
#   - 容器内 Node(next start :5101)；host=container=5101（ADR-0018 单层 port 方案，
#     docker run -p 127.0.0.1:5101:5101；saas 家族 X01 段）
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

# nginx domain（v0.7.40 middleware 跨域白名单要用到，提前到 bootstrap 块之前）
NGINX_DOMAIN="${NGINX_DOMAIN:-saas-nextjs.xiangru.uk}"
NGINX_CERT_BASENAME="${NGINX_CERT_BASENAME:-xiangru-uk}"

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
    echo "→ bootstrapping $BASE/saas.env from env DATABASE_URL (key 集合 = .env.production)"
    umask 077
    SECRET="$(openssl rand -hex 32)"
    {
      printf 'DATABASE_URL=%s\n' "$DATABASE_URL"
      printf 'DATABASE_NAME=saas_prod\n'
      printf 'DATABASE_USER=postgres\n'
      printf 'DATABASE_PASSWORD=changeme\n'
      printf 'JWT_SIGNING_KEY=%s\n' "$SECRET"
      printf 'JWT_AUTHORITY=https://auth.example.com\n'
      printf 'JWT_ISSUER=saas-identity-platform\n'
      printf 'JWT_AUDIENCE=saas-identity-platform-clients\n'
      printf 'JWT_TTL_SECONDS=3600\n'
      printf 'SERVER_PORT=5101\n'
      printf 'PG_HOST=100.79.128.25\n'
      printf 'PG_PORT=5432\n'
      printf 'PG_USER=postgres\n'
      printf 'PG_PASSWORD=changeme\n'
      printf 'PG_DATABASE=saas_prod\n'
      printf 'NEXT_PUBLIC_SAAS_BASE_URL=https://%s\n' "$NGINX_DOMAIN"
      printf 'NEXT_PUBLIC_API_BASE_URL=\n'
      # 2026-08-28 key 对齐:key 集合与 .env.production 由 suite L0.5 check_deploy_parity 锁死
      printf 'SAAS_CORS_ALLOWED_ORIGINS=https://saas-nextjs.xiangru.uk,https://saas-react.xiangru.uk,https://saas-vue.xiangru.uk\n'
      printf 'NEXT_PUBLIC_API_MODE=nextjs\n'
      printf 'LOCKOUT_MAX_FAILS=5\n'
      printf 'LOCKOUT_WINDOW_MIN=15\n'
      printf 'LOCKOUT_COOLDOWN_MIN=30\n'
      printf 'OAUTH_CODE_TTL=600\n'
      printf 'OAUTH_REFRESH_TTL=604800\n'
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

# nginx vhost 重渲染（每次 deploy 都跑,ADR-0018:容器端口变了 vhost 必须跟）:
# 模板从 master 拉,渲染后写入 sites-available,symlink sites-enabled,再 sudo nginx -t + reload。
# diff 检测:内容未变跳过 reload (nginx -t 也省)。
NGINX_SITES_AVAILABLE="/etc/nginx/sites-available"
NGINX_SITES_ENABLED="/etc/nginx/sites-enabled"
NGINX_VHOST_FILE="${NGINX_SITES_AVAILABLE}/${NGINX_DOMAIN}"
NGINX_VHOST_LINK="${NGINX_SITES_ENABLED}/${NGINX_DOMAIN}"
NGINX_TEMPLATE="${BASE}/nginx-vps.conf.example"

# 拉模板:每次都从 master 拉最新 —— VPS 本地会留 7 月老模板(801x 端口时代),
# fetch-if-missing 让它永不更新 → 渲染出 proxy_pass 8010 全家族 502
# (2026-09-03 事故根因之二)
echo "→ fetching nginx-vps.conf.example template (always fresh from master)"
if ! curl -fsSL "https://raw.githubusercontent.com/zcqiand/saas-identity-platform-nextjs/refs/heads/master/deploy/nginx-vps.conf.example" -o "${NGINX_TEMPLATE}"; then
  echo "ERROR: failed to fetch nginx template, vhost re-render aborts"
  exit 1
fi

# 渲染到临时文件 —— sed 同时覆盖 3 种 placeholder:
#   Style A (lab-vue/react):      <domain>
#   Style B/C (nextjs/sp/aspc):   lab.YOUR_DOMAIN / saas.YOUR_DOMAIN
#   cert 路径: your-cert.{crt,cert} / <domain>.crt → 统一到 ${NGINX_CERT_BASENAME}.cert
TMP_VHOST="$(mktemp -t vpstpl.XXXXXX)"
# cert 归一化规则必须排在 <domain>/YOUR_DOMAIN 通配之前:sed -e 按顺序执行,
# 先替换 <domain> 会把 cert 路径里的占位符一并吃掉,后面的 cert 规则全部失配
# (2026-09-03 VPS nginx -t "cannot load certificate <域名>.crt" 事故根因)
sed \
  -e "s|/etc/nginx/ssl/<domain>\.crt|/etc/nginx/ssl/${NGINX_CERT_BASENAME}.cert|g" \
  -e "s|/etc/nginx/ssl/<domain>\.cert|/etc/nginx/ssl/${NGINX_CERT_BASENAME}.cert|g" \
  -e "s|/etc/nginx/ssl/<domain>\.key|/etc/nginx/ssl/${NGINX_CERT_BASENAME}.key|g" \
  -e "s|/etc/nginx/ssl/your-cert\.crt|/etc/nginx/ssl/${NGINX_CERT_BASENAME}.cert|g" \
  -e "s|/etc/nginx/ssl/your-cert\.cert|/etc/nginx/ssl/${NGINX_CERT_BASENAME}.cert|g" \
  -e "s|/etc/nginx/ssl/your-cert\.key|/etc/nginx/ssl/${NGINX_CERT_BASENAME}.key|g" \
  -e "s|<domain>|${NGINX_DOMAIN}|g" \
  -e "s|lab\.YOUR_DOMAIN|${NGINX_DOMAIN}|g" \
  -e "s|saas\.YOUR_DOMAIN|${NGINX_DOMAIN}|g" \
  "${NGINX_TEMPLATE}" > "${TMP_VHOST}"

# diff 检测:已有 vhost 且内容相同就 skip,不同才重写 + reload
if [ -e "${NGINX_VHOST_FILE}" ] && diff -q "${TMP_VHOST}" "${NGINX_VHOST_FILE}" >/dev/null 2>&1; then
  echo "→ nginx vhost ${NGINX_VHOST_FILE} unchanged, skip"
  rm -f "${TMP_VHOST}"
else
  echo "→ rendering nginx vhost ${NGINX_VHOST_FILE} (domain=${NGINX_DOMAIN} cert=${NGINX_CERT_BASENAME})"
  # 写入 sites-available (deploy 用户可能没写权限,需要 sudoers 配 nginx 白名单)
  if [ -w "${NGINX_SITES_AVAILABLE}" ]; then
    cp "${TMP_VHOST}" "${NGINX_VHOST_FILE}"
  else
    sudo cp "${TMP_VHOST}" "${NGINX_VHOST_FILE}" \
      || { echo "ERROR: sudo cp ${NGINX_VHOST_FILE} failed"; rm -f "${TMP_VHOST}"; exit 1; }
  fi
  # symlink sites-enabled
  if [ -w "${NGINX_SITES_ENABLED}" ]; then
    ln -sf "${NGINX_VHOST_FILE}" "${NGINX_VHOST_LINK}"
  else
    sudo ln -sf "${NGINX_VHOST_FILE}" "${NGINX_VHOST_LINK}" \
      || { echo "ERROR: sudo ln ${NGINX_VHOST_LINK} failed"; rm -f "${TMP_VHOST}"; exit 1; }
  fi
  rm -f "${TMP_VHOST}"
  # nginx config test + reload (CI 自动完成,不再依赖手工)
  echo "→ nginx -t"
  sudo nginx -t
  echo "→ systemctl reload nginx"
  sudo systemctl reload nginx
  echo "✓ nginx reloaded"
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

# 补 NEXT_PUBLIC_API_BASE_URL= (同源空 → 本仓 Route Handler; MSW 已删 ADR-0012)
if ! grep -q '^NEXT_PUBLIC_API_BASE_URL=' "$BASE/saas.env"; then
  echo "→ append NEXT_PUBLIC_API_BASE_URL="
  umask 077
  printf 'NEXT_PUBLIC_API_BASE_URL=\n' >> "$BASE/saas.env"
fi

# 2026-08-28 key 对齐: 补 NEXT_PUBLIC_API_MODE(老 env-file 停在 key 集合扩充前)
if ! grep -q '^NEXT_PUBLIC_API_MODE=' "$BASE/saas.env"; then
  echo "→ append NEXT_PUBLIC_API_MODE=nextjs"
  umask 077
  printf 'NEXT_PUBLIC_API_MODE=nextjs\n' >> "$BASE/saas.env"
fi

# 2026-09-11 B 方案 (ADR-0030 REQ-2026-001): 补 NEXT_PUBLIC_LOGIN_CLIENT_ID
# (登录页 clientId 兜底 = saas-console 自身应用；缺了 prod 直接打开登录页会被 clientId 门拒绝)
# 2026-09-12 值修正：老值 …1114 是 oauth_client.id (UUID)，不是 client_id 字符串；
# springboot login 把 clientId 写 oauth_*_token.client_id (FK→oauth_client.client_id)，
# UUID 值 → 23503 → 空 401「用户名或密码错误」。migrate_if_stale 锚定整行换掉老值。
if grep -q '^NEXT_PUBLIC_LOGIN_CLIENT_ID=11111111-1111-1111-1111-111111111114$' "$BASE/saas.env" 2>/dev/null; then
  echo "→ migrate NEXT_PUBLIC_LOGIN_CLIENT_ID: …1114 (id) → saas-console (client_id)"
  sed -i 's|^NEXT_PUBLIC_LOGIN_CLIENT_ID=11111111-1111-1111-1111-111111111114$|NEXT_PUBLIC_LOGIN_CLIENT_ID=saas-console|' "$BASE/saas.env"
fi
if ! grep -q '^NEXT_PUBLIC_LOGIN_CLIENT_ID=' "$BASE/saas.env"; then
  echo "→ append NEXT_PUBLIC_LOGIN_CLIENT_ID=saas-console"
  umask 077
  printf 'NEXT_PUBLIC_LOGIN_CLIENT_ID=saas-console\n' >> "$BASE/saas.env"
fi

# 2026-09-09 key 对齐 (L0.5 env 一致性): 老 env-file 逐 key append-if-missing 到 .env.production 全集
# (key 集合契约由 suite L0.5 check_deploy_parity 锁死。SAAS_CORS_ALLOWED_ORIGINS 是活键 —
# middleware.ts 读它挂 /api/v1/* 的 CORS 头,读不到时 fail-safe 全拒,2026-09-13 修复曾误删)
if [ -f "$BASE/saas.env" ]; then
  append_if_missing() {
    key="$1"; val="$2"
    if ! grep -q "^${key}=" "$BASE/saas.env"; then
      echo "→ append ${key} to existing $BASE/saas.env"
      umask 077
      printf '%s=%s\n' "$key" "$val" >> "$BASE/saas.env"
    fi
  }
  append_if_missing DATABASE_NAME 'saas_prod'
  append_if_missing SAAS_CORS_ALLOWED_ORIGINS 'https://saas-nextjs.xiangru.uk,https://saas-react.xiangru.uk,https://saas-vue.xiangru.uk'
  append_if_missing DATABASE_USER 'postgres'
  append_if_missing DATABASE_PASSWORD 'changeme'
  append_if_missing JWT_AUTHORITY 'https://auth.example.com'
  append_if_missing SERVER_PORT '5101'
  append_if_missing PG_HOST '100.79.128.25'
  append_if_missing PG_PORT '5432'
  append_if_missing PG_USER 'postgres'
  append_if_missing PG_PASSWORD 'changeme'
  append_if_missing PG_DATABASE 'saas_prod'
  append_if_missing NEXT_PUBLIC_SAAS_BASE_URL "https://${NGINX_DOMAIN}"

  # 2026-09-13 CORS origin 级无损追加（aspnetcore 仓同款）：三前端（react/vue/nextjs）
  # 都可以跨源调本后端 /api/v1/*（middleware.ts 白名单），存量 env-file 缺哪个 origin 就
  # 补哪个（origin 级，不整值覆盖，运维手工 origin 保留）。
  for cors_origin in "https://saas-nextjs.xiangru.uk" \
                     "https://saas-react.xiangru.uk" \
                     "https://saas-vue.xiangru.uk"; do
    if grep -q '^SAAS_CORS_ALLOWED_ORIGINS=' "$BASE/saas.env" && ! grep '^SAAS_CORS_ALLOWED_ORIGINS=' "$BASE/saas.env" | grep -qF "$cors_origin"; then
      sed -i "s#^\(SAAS_CORS_ALLOWED_ORIGINS=.*\)#\1,${cors_origin}#" "$BASE/saas.env"
      echo "→ reconcile SAAS_CORS_ALLOWED_ORIGINS: 追加缺失 origin ${cors_origin}（origin 级，不整值覆盖）"
    fi
  done

  # 一次性 stale 值 reconcile —— append_if_missing 只补 key, 不覆盖值。
  # 同 springboot 仓 reconcile 范本 (migrate_if_stale KEY OLD NEW)。
  # 1) port-scheme 5100/5200 迁移前老 saas.env 写 SERVER_PORT=8080, 与 next start :5101 +
  #    docker run -p ...:5101 不一致 → Node 监听错端口, healthcheck 永远 connection-refused。
  if grep -q '^SERVER_PORT=8080$' "$BASE/saas.env"; then
    sed -i 's/^SERVER_PORT=8080$/SERVER_PORT=5101/' "$BASE/saas.env"
    echo "→ reconcile SERVER_PORT: 8080 → 5101 (port-scheme 5100/5200 迁移残留)"
  fi
  # 2) env-key-unification (2026-08-28) 前老 saas.env 的 DATABASE_URL 是 jdbc:/Host= 老格式
  #    (springboot jdbc: / aspnetcore Host= 连接串), Drizzle (postgres-js) 只认 postgresql://。
  #    新值含密码无法整行预知 → 用当前部署环境的 $DATABASE_URL 覆盖 (bootstrap 段同源);
  #    环境里没有则不静默兜底 (禁 env 默认值兜底), 老格式留给下方 fail-fast 提示。
  #    护栏: sed replacement 里 # 是分隔符、& 反指整个匹配, URL 含这些字符时自动迁移不安全 → fail-fast。
  case "${DATABASE_URL:-}" in *'#'*|*'&'*|*'\'*)
    echo "✗ DATABASE_URL 含 sed 特殊字符（# & \\），自动迁移不安全；请手工改为 postgresql:// 格式" >&2
    exit 1;;
  esac
  if grep -Eq '^DATABASE_URL=(jdbc:|Host=)' "$BASE/saas.env" && [ -n "${DATABASE_URL:-}" ]; then
    sed -i "s#^DATABASE_URL=.*#DATABASE_URL=$DATABASE_URL#" "$BASE/saas.env"
    echo "→ reconcile DATABASE_URL: 老格式（jdbc:/Host=）→ postgresql:// (env-key-unification)"
  elif grep -Eq '^DATABASE_URL=(jdbc:|Host=)' "$BASE/saas.env"; then
    echo "✗ DATABASE_URL 是老格式（jdbc:/Host=），Drizzle 无法解析。请设置 DATABASE_URL 环境变量后重跑，或手工改为 postgresql:// 格式" >&2
    exit 1
  fi

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
  -p "127.0.0.1:5101:5101" \
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
