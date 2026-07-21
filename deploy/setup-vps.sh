#!/bin/bash
# =============================================================================
# deploy/setup-vps.sh — VPS 一次性 bootstrap
#
# 用法：sudo bash deploy/setup-vps.sh <your-domain>
# 做的事：
#   1. apt update + 装 nginx + docker.io
#   2. 创建 deploy 用户（key-only SSH）
#   3. deploy 进 docker 组
#   4. 创建 /home/deploy/saas-identity-platform-nextjs/ 工作目录
#   5. 渲染 deploy/nginx-vps.conf.example → /etc/nginx/sites-available/<your-domain>
#   6. 建 symlink + 删 Ubuntu 默认页（避免 default_server 重复）
#   7. nginx -t && reload
#
# 你还要手工做的：
#   - 把 fullchain.pem + privkey.pem 拷到 VPS /etc/nginx/ssl/your-cert.{crt,key}
#   - ssh-copy-id deploy@<VPS> 把 deploy 用户的 SSH pub key 加进来
#   - GitHub Secrets 配 VPS_HOST / VPS_USER / VPS_SSH_KEY / DOCKER_USERNAME / DOCKER_PASSWORD
#
# 参考：saas-identity-platform/DEPLOYMENT.md §5
# =============================================================================

set -e

DOMAIN="${1:?usage: sudo bash $0 <your-domain>}"
DEPLOY_USER="deploy"
APP_DIR="/home/${DEPLOY_USER}/saas-identity-platform-nextjs"
# 数据目录放 deploy 用户 home 下（与 deploy.sh 保持一致）。
# 老代码用 /srv/... 需 root 建，但 CI ssh 跑 deploy.sh 不用 sudo，会 permission denied。
DATA_DIR="/home/${DEPLOY_USER}/${CONTAINER_NAME:-saas-identity-platform-nextjs}-data"
NGINX_AVAIL="/etc/nginx/sites-available/${DOMAIN}"
NGINX_ENABLED="/etc/nginx/sites-enabled/${DOMAIN}"

# ---- 0. 必须是 root ----
if [ "$(id -u)" != "0" ]; then
    echo "must run as root (sudo bash $0 ...)"
    exit 1
fi

# ---- 1. apt update + 装 nginx + docker ----
echo "[setup] apt update + install nginx + docker.io..."
apt-get update -y
apt-get install -y nginx docker.io curl

# ---- 2. 创建 deploy 用户（key-only SSH）----
if ! id "${DEPLOY_USER}" >/dev/null 2>&1; then
    echo "[setup] creating deploy user..."
    adduser --disabled-password --gecos "" "${DEPLOY_USER}"
    mkdir -p "/home/${DEPLOY_USER}/.ssh"
    chmod 700 "/home/${DEPLOY_USER}/.ssh"
    touch "/home/${DEPLOY_USER}/.ssh/authorized_keys"
    chmod 600 "/home/${DEPLOY_USER}/.ssh/authorized_keys"
fi

# ---- 3. deploy 进 docker 组 ----
echo "[setup] adding deploy to docker group..."
usermod -aG docker "${DEPLOY_USER}"

# ---- 4. 工作目录 + data 目录 ----
echo "[setup] creating work + data dirs..."
mkdir -p "${APP_DIR}"
mkdir -p "${DATA_DIR}"
chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "${APP_DIR}"
# DATA_DIR 现在在 /home/deploy/ 下，mkdir 之后 chown；不必 sudo 改 /srv
chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "${DATA_DIR}"

# 把 saas-identity-platform-nextjs.sh 拷进去
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "${SCRIPT_DIR}/saas-identity-platform-nextjs.sh" ]; then
    cp "${SCRIPT_DIR}/saas-identity-platform-nextjs.sh" "${APP_DIR}/"
    chmod +x "${APP_DIR}/saas-identity-platform-nextjs.sh"
    chown "${DEPLOY_USER}:${DEPLOY_USER}" "${APP_DIR}/saas-identity-platform-nextjs.sh"
fi

# ---- 5. 渲染 nginx vhost ----
if [ ! -f "${SCRIPT_DIR}/nginx-vps.conf.example" ]; then
    echo "[setup] nginx-vps.conf.example not found in ${SCRIPT_DIR}"
    exit 1
fi
echo "[setup] rendering nginx vhost for ${DOMAIN}..."
sed "s|<your-domain>|${DOMAIN}|g" "${SCRIPT_DIR}/nginx-vps.conf.example" > "${NGINX_AVAIL}"

# ---- 6. 启用 vhost + 删默认页 ----
echo "[setup] enabling site, removing default..."
ln -sf "${NGINX_AVAIL}" "${NGINX_ENABLED}"
rm -f /etc/nginx/sites-enabled/default

# ---- 7. nginx -t && reload ----
echo "[setup] nginx -t..."
nginx -t
systemctl reload nginx || true

echo ""
echo "[setup] DONE."
echo ""
echo "You still need to manually:"
echo "  1. Copy cert:"
echo "     scp fullchain.pem  deploy@<VPS>:/tmp/"
echo "     scp privkey.pem    deploy@<VPS>:/tmp/"
echo "     ssh deploy@<VPS> 'sudo cp /tmp/fullchain.pem /etc/nginx/ssl/your-cert.crt && sudo cp /tmp/privkey.pem /etc/nginx/ssl/your-cert.key && sudo chmod 600 /etc/nginx/ssl/your-cert.key'"
echo "  2. Add SSH key:"
echo "     ssh-copy-id -i ~/.ssh/id_ed25519_gh-deploy.pub deploy@<VPS>"
echo "  3. Add GitHub Secrets (repository-level, NOT environment):"
echo "     VPS_HOST, VPS_USER=deploy, VPS_SSH_KEY (private key full text)"
echo "     DOCKER_USERNAME, DOCKER_PASSWORD (Read,Write,Delete PAT)"
echo ""
echo "Then trigger deploy:"
echo "  git tag v1.0-002 master"
echo "  git push origin v1.0-002"
echo ""
echo "Verify:"
echo "  ssh deploy@<VPS> 'docker ps -a --filter name=saas-identity-platform-nextjs'"
echo "  curl -kI https://${DOMAIN}/"