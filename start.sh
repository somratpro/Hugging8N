#!/bin/bash
set -euo pipefail

APP_DIR="/home/node/app"
N8N_HOME="/home/node/.n8n"
N8N_PORT="${N8N_PORT:-5678}"
PUBLIC_PORT="${PUBLIC_PORT:-7861}"
SYNC_INTERVAL="${SYNC_INTERVAL:-180}"

mkdir -p "$N8N_HOME"

SPACE_HOST_DETECTED="${SPACE_HOST_OVERRIDE:-${SPACE_HOST:-}}"
if [ -n "$SPACE_HOST_DETECTED" ]; then
  export N8N_HOST="${N8N_HOST:-$SPACE_HOST_DETECTED}"
  export WEBHOOK_URL="${WEBHOOK_URL:-https://${SPACE_HOST_DETECTED}/}"
  export N8N_EDITOR_BASE_URL="${N8N_EDITOR_BASE_URL:-https://${SPACE_HOST_DETECTED}/}"
fi

export N8N_PORT
export N8N_PROTOCOL="${N8N_PROTOCOL:-https}"
export N8N_PROXY_HOPS="${N8N_PROXY_HOPS:-1}"
export N8N_LISTEN_ADDRESS="${N8N_LISTEN_ADDRESS:-0.0.0.0}"
# Must be false: HF Spaces terminates TLS at its edge; n8n sees plain HTTP internally.
# Secure cookies require HTTPS end-to-end and will break login on HF Spaces.
export N8N_SECURE_COOKIE="${N8N_SECURE_COOKIE:-false}"
export N8N_DIAGNOSTICS_ENABLED="${N8N_DIAGNOSTICS_ENABLED:-false}"
export N8N_PERSONALIZATION_ENABLED="${N8N_PERSONALIZATION_ENABLED:-false}"
export N8N_USER_FOLDER="$N8N_HOME"
export N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS="${N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS:-true}"
export GENERIC_TIMEZONE="${GENERIC_TIMEZONE:-${TZ:-UTC}}"
export TZ="${TZ:-$GENERIC_TIMEZONE}"

# Basic auth — enabled by default to protect your n8n instance
export N8N_BASIC_AUTH_ACTIVE="${N8N_BASIC_AUTH_ACTIVE:-true}"
if [ "${N8N_BASIC_AUTH_ACTIVE}" = "true" ]; then
  export N8N_BASIC_AUTH_USER="${N8N_BASIC_AUTH_USER:-admin}"
  export N8N_BASIC_AUTH_PASSWORD="${N8N_BASIC_AUTH_PASSWORD:-}"
  if [ -z "${N8N_BASIC_AUTH_PASSWORD:-}" ]; then
    echo "⚠️  WARNING: N8N_BASIC_AUTH_ACTIVE=true but N8N_BASIC_AUTH_PASSWORD is not set."
    echo "   Your n8n instance is NOT protected. Set N8N_BASIC_AUTH_PASSWORD in Secrets."
  fi
fi

echo ""
echo "  ╔════════════════════════════════════╗"
echo "  ║            Hugging8n              ║"
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
  if [ -n "${SYNC_PID:-}" ] && kill -0 "$SYNC_PID" 2>/dev/null; then
    kill "$SYNC_PID" 2>/dev/null || true
  fi
  if [ -n "${N8N_PID:-}" ] && kill -0 "$N8N_PID" 2>/dev/null; then
    kill "$N8N_PID" 2>/dev/null || true
  fi
  if [ -n "${PROXY_PID:-}" ] && kill -0 "$PROXY_PID" 2>/dev/null; then
    kill "$PROXY_PID" 2>/dev/null || true
  fi
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

wait "$N8N_PID"
