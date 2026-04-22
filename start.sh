#!/bin/bash
set -euo pipefail

# Tighten default file permissions for any files created by this process
umask 0077

APP_DIR="/home/node/app"
N8N_HOME="/home/node/.n8n"
N8N_PORT="${N8N_PORT:-5678}"
PUBLIC_PORT="${PUBLIC_PORT:-7861}"
SYNC_INTERVAL="${SYNC_INTERVAL:-180}"

mkdir -p "$N8N_HOME"

SPACE_HOST_DETECTED="${SPACE_HOST_OVERRIDE:-${SPACE_HOST:-}}"
if [ -n "$SPACE_HOST_DETECTED" ]; then
  export N8N_HOST="${N8N_HOST:-$SPACE_HOST_DETECTED}"
  # Strict Native Subpath Configuration
  export N8N_PATH="/app/"
  export N8N_PROTOCOL="https"
  export N8N_HOST="${SPACE_HOST_DETECTED}"
  export WEBHOOK_URL="https://${SPACE_HOST_DETECTED}/app/"
  export N8N_EDITOR_BASE_URL="https://${SPACE_HOST_DETECTED}/app/"
fi

export N8N_PORT
export N8N_PROTOCOL="${N8N_PROTOCOL:-https}"
export N8N_PROXY_HOPS="${N8N_PROXY_HOPS:-1}"
export N8N_LISTEN_ADDRESS="${N8N_LISTEN_ADDRESS:-0.0.0.0}"
export N8N_SECURE_COOKIE="${N8N_SECURE_COOKIE:-false}"
export N8N_DIAGNOSTICS_ENABLED="${N8N_DIAGNOSTICS_ENABLED:-false}"
export N8N_PERSONALIZATION_ENABLED="${N8N_PERSONALIZATION_ENABLED:-false}"
export N8N_USER_FOLDER="$N8N_HOME"
export N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS="${N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS:-true}"
export GENERIC_TIMEZONE="${GENERIC_TIMEZONE:-${TZ:-UTC}}"
export TZ="${TZ:-$GENERIC_TIMEZONE}"

# Disable noisy or unnecessary services
export N8N_PYTHON_NODES_ENABLED="${N8N_PYTHON_NODES_ENABLED:-false}"
export N8N_TASK_RUNNERS_ENABLED="${N8N_TASK_RUNNERS_ENABLED:-false}"
export N8N_LICENSE_AUTO_RENEW_ENABLED="${N8N_LICENSE_AUTO_RENEW_ENABLED:-false}"
export N8N_LOG_LEVEL="${N8N_LOG_LEVEL:-error}"

# n8n v2 uses built-in user management.

echo ""
echo "  ╔════════════════════════════════════╗"
echo "  ║            Hugging8n               ║"
echo "  ╚════════════════════════════════════╝"
echo ""
echo "Public host : ${SPACE_HOST_DETECTED:-not detected}"
echo "n8n port    : ${N8N_PORT}"
echo "Public port : ${PUBLIC_PORT}"
echo "Timezone    : ${GENERIC_TIMEZONE}"
echo "Sync every  : ${SYNC_INTERVAL}s"

if [ -n "${HF_TOKEN:-}" ]; then
  echo "Restoring persisted n8n state from HF Dataset..."
  python3 "$APP_DIR/n8n-sync.py" restore || true
else
  echo "HF_TOKEN is not set. Running without dataset persistence."
fi

cleanup() {
  echo "Stopping Hugging8n..."
  [ -n "${SYNC_PID:-}" ] && kill "$SYNC_PID" 2>/dev/null || true
  [ -n "${N8N_PID:-}" ] && kill "$N8N_PID" 2>/dev/null || true
  [ -n "${PROXY_PID:-}" ] && kill "$PROXY_PID" 2>/dev/null || true
  if [ -n "${HF_TOKEN:-}" ]; then
    echo "Running final backup pass..."
    python3 "$APP_DIR/n8n-sync.py" sync-once || true
  fi
}

trap cleanup EXIT INT TERM

if [ -n "${HF_TOKEN:-}" ]; then
  python3 "$APP_DIR/n8n-sync.py" loop &
  SYNC_PID=$!
fi

node "$APP_DIR/health-server.js" &
PROXY_PID=$!

n8n start &
N8N_PID=$!

# Readiness probe
echo "Waiting for n8n to be ready on port ${N8N_PORT}..."
until curl -sf "http://127.0.0.1:${N8N_PORT}/healthz" > /dev/null 2>&1; do
  sleep 1
done
echo "n8n is ready!"

wait "$N8N_PID"
