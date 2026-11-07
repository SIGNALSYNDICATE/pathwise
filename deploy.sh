#!/usr/bin/env bash
# Deploy Pathwise on a Debian/Ubuntu server.
# Checks Node.js and npm, builds the app, runs it on port 3000,
# then installs nginx and proxies public HTTP traffic to it.
#
# Usage (on the server, from this directory):
#   sudo ./deploy.sh
#
# Optional:
#   SERVER_NAME=example.com sudo ./deploy.sh

set -euo pipefail

APP_PORT=3000
NODE_MAJOR_MIN=18
NODE_MINOR_MIN=17
REQUIRED_ENV_VARS=(
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
)
OPTIONAL_ENV_VARS=(
  GEMMA_API_KEY
  SMS_API_KEY
  SMS_DISPATCH_SECRET
)

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_NAME="pathwise"
NGINX_SITE="pathwise"

log() { printf '\n==> %s\n' "$*"; }
die() { printf 'Error: %s\n' "$*" >&2; exit 1; }

require_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    die "Run this script as root: sudo ./deploy.sh"
  fi
}

require_debian() {
  if [[ ! -f /etc/os-release ]]; then
    die "Cannot detect the operating system. This script supports Debian and Ubuntu."
  fi
  # shellcheck disable=SC1091
  . /etc/os-release
  case "${ID:-}" in
    debian|ubuntu) ;;
    *) die "Unsupported OS '${ID:-unknown}'. This script uses apt and systemd." ;;
  esac
}

version_at_least() {
  local major minor
  IFS=. read -r major minor _ <<<"${1#v}"
  major="${major:-0}"
  minor="${minor:-0}"
  if (( major > NODE_MAJOR_MIN )); then
    return 0
  fi
  if (( major == NODE_MAJOR_MIN && minor >= NODE_MINOR_MIN )); then
    return 0
  fi
  return 1
}

install_node() {
  log "Node.js ${NODE_MAJOR_MIN}.${NODE_MINOR_MIN}+ is missing. Installing Node.js 20."
  apt-get update
  apt-get install -y ca-certificates curl gnupg
  mkdir -p /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
    | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" \
    > /etc/apt/sources.list.d/nodesource.list
  apt-get update
  apt-get install -y nodejs
}

check_runtime() {
  log "Checking project requirements"
  if ! command -v node >/dev/null 2>&1 || ! version_at_least "$(node -v)"; then
    install_node
  fi
  command -v node >/dev/null 2>&1 || die "node is not on PATH after installation."
  command -v npm >/dev/null 2>&1 || die "npm is not on PATH. Reinstall Node.js."
  version_at_least "$(node -v)" || die "Node.js $(node -v) is too old. Need ${NODE_MAJOR_MIN}.${NODE_MINOR_MIN} or newer."

  printf '  node %s\n' "$(node -v)"
  printf '  npm  %s\n' "$(npm -v)"

  [[ -f "${APP_DIR}/package.json" ]] || die "package.json not found in ${APP_DIR}"
  [[ -f "${APP_DIR}/package-lock.json" ]] || die "package-lock.json not found in ${APP_DIR}"

  if [[ ! -f "${APP_DIR}/.env" ]]; then
    die "Missing ${APP_DIR}/.env. Copy your environment file onto the server before deploying."
  fi

  local name missing=0
  for name in "${REQUIRED_ENV_VARS[@]}"; do
    if ! grep -Eq "^${name}=.+" "${APP_DIR}/.env"; then
      printf '  missing required variable: %s\n' "${name}" >&2
      missing=1
    fi
  done
  [[ "${missing}" -eq 0 ]] || die "Fill in the required variables in .env, then run this script again."

  for name in "${OPTIONAL_ENV_VARS[@]}"; do
    if ! grep -Eq "^${name}=.+" "${APP_DIR}/.env"; then
      printf '  optional variable not set: %s\n' "${name}"
    fi
  done
}

build_app() {
  log "Installing dependencies and building"
  cd "${APP_DIR}"
  npm ci
  npm run build
}

service_user() {
  if [[ -n "${SUDO_USER:-}" && "${SUDO_USER}" != "root" ]]; then
    printf '%s' "${SUDO_USER}"
    return
  fi
  stat -c '%U' "${APP_DIR}"
}

install_systemd() {
  local user node_bin npm_bin node_dir
  user="$(service_user)"
  id "${user}" >/dev/null 2>&1 || die "Service user '${user}' does not exist."
  node_bin="$(command -v node)"
  npm_bin="$(command -v npm)"
  node_dir="$(dirname "${node_bin}")"

  log "Starting the app on 127.0.0.1:${APP_PORT}"
  cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=Pathwise Next.js application
After=network.target

[Service]
Type=simple
User=${user}
WorkingDirectory=${APP_DIR}
Environment=NODE_ENV=production
Environment=PORT=${APP_PORT}
Environment=PATH=${node_dir}:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
ExecStart=${npm_bin} run start -- -H 127.0.0.1 -p ${APP_PORT}
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable "${SERVICE_NAME}"
  systemctl restart "${SERVICE_NAME}"
}

install_nginx() {
  local server_name="${SERVER_NAME:-_}"

  log "Installing nginx and exposing the app on port 80"
  apt-get update
  apt-get install -y nginx

  cat > "/etc/nginx/sites-available/${NGINX_SITE}" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${server_name};

    client_max_body_size 20m;

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 60s;
    }
}
EOF

  ln -sfn "/etc/nginx/sites-available/${NGINX_SITE}" "/etc/nginx/sites-enabled/${NGINX_SITE}"
  rm -f /etc/nginx/sites-enabled/default
  nginx -t
  systemctl enable nginx
  systemctl reload nginx

  if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
    ufw allow 80/tcp
  fi
}

wait_for_app() {
  local i
  for i in $(seq 1 30); do
    if curl -fsS -o /dev/null "http://127.0.0.1:${APP_PORT}"; then
      return 0
    fi
    sleep 1
  done
  echo "The app did not answer on port ${APP_PORT}. Recent logs:" >&2
  journalctl -u "${SERVICE_NAME}" -n 40 --no-pager >&2 || true
  exit 1
}

main() {
  require_root
  require_debian
  check_runtime
  build_app
  install_systemd
  install_nginx
  wait_for_app

  log "Pathwise is up"
  printf '  App:   http://127.0.0.1:%s\n' "${APP_PORT}"
  printf '  Nginx: http://%s/\n' "$(hostname -I 2>/dev/null | awk '{print $1}')"
  printf '  Logs:  journalctl -u %s -f\n' "${SERVICE_NAME}"
}

main "$@"
