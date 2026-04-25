#!/bin/bash
set -euo pipefail

# Tighten default file permissions for any files created by this process
umask 0077

APP_DIR="/home/node/app"
N8N_HOME="/home/node/.n8n"
N8N_PORT="${N8N_PORT:-5678}"
PUBLIC_PORT="${PUBLIC_PORT:-7861}"
SYNC_INTERVAL="${SYNC_INTERVAL:-180}"
N8N_STARTUP_TIMEOUT="${N8N_STARTUP_TIMEOUT:-180}"

mkdir -p "$N8N_HOME"

SPACE_HOST_DETECTED="${SPACE_HOST_OVERRIDE:-${SPACE_HOST:-}}"
if [ -n "$SPACE_HOST_DETECTED" ]; then
  export N8N_HOST="${N8N_HOST:-$SPACE_HOST_DETECTED}"
  # Namespace-based Proxy Configuration (n8n at root internally)
  export N8N_PATH="/"
  export N8N_PROTOCOL="https"
  export N8N_HOST="${SPACE_HOST_DETECTED}"
  export WEBHOOK_URL="https://${SPACE_HOST_DETECTED}/"
  export N8N_EDITOR_BASE_URL="https://${SPACE_HOST_DETECTED}/"
fi

export N8N_PORT
export N8N_PROTOCOL="${N8N_PROTOCOL:-https}"
export N8N_PROXY_HOPS="${N8N_PROXY_HOPS:-1}"
export N8N_LISTEN_ADDRESS="${N8N_LISTEN_ADDRESS:-0.0.0.0}"
if [ -z "${N8N_SECURE_COOKIE:-}" ]; then
  if [ "${N8N_PROTOCOL}" = "https" ]; then
    export N8N_SECURE_COOKIE="true"
  else
    export N8N_SECURE_COOKIE="false"
  fi
else
  export N8N_SECURE_COOKIE
fi
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
echo "Startup wait: ${N8N_STARTUP_TIMEOUT}s"

if [ -n "${HF_TOKEN:-}" ]; then
  echo "Restoring persisted n8n state from HF Dataset..."
  python3 "$APP_DIR/n8n-sync.py" restore || true
else
  echo "HF_TOKEN is not set. Running without dataset persistence."
fi

CF_PROXY_ENV_FILE="/tmp/hugging8n-cloudflare-proxy.env"
CLOUDFLARE_WORKERS_TOKEN="${CLOUDFLARE_WORKERS_TOKEN:-${CLOUDFLARE_API_TOKEN:-}}"
export CLOUDFLARE_WORKERS_TOKEN
if [ -n "${CLOUDFLARE_WORKERS_TOKEN:-}" ] || [ -n "${CLOUDFLARE_PROXY_URL:-}" ]; then
  echo "Preparing Cloudflare outbound proxy..."
  python3 "$APP_DIR/cloudflare-proxy-setup.py" || true
  if [ -f "$CF_PROXY_ENV_FILE" ]; then
    . "$CF_PROXY_ENV_FILE"
  fi
fi

cleanup() {
  echo "Stopping Hugging8n..."
  [ -n "${PROXY_PID:-}" ] && kill "$PROXY_PID" 2>/dev/null || true

  # Stop the background sync loop gracefully
  if [ -n "${SYNC_PID:-}" ]; then
    kill "$SYNC_PID" 2>/dev/null || true
    wait "$SYNC_PID" 2>/dev/null || true
  fi

  # Wait for n8n to finish its graceful shutdown to ensure DB state is flushed
  if [ -n "${N8N_PID:-}" ]; then
    kill -TERM "$N8N_PID" 2>/dev/null || true
    wait "$N8N_PID" 2>/dev/null || true
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

# Readiness probe
echo "Waiting for n8n to be ready on port ${N8N_PORT}..."
start_ts="$(date +%s)"
until curl -sf "http://127.0.0.1:${N8N_PORT}/healthz" > /dev/null 2>&1; do
  now_ts="$(date +%s)"
  elapsed="$((now_ts - start_ts))"
  if [ "$elapsed" -ge "$N8N_STARTUP_TIMEOUT" ]; then
    echo "n8n did not become ready within ${N8N_STARTUP_TIMEOUT}s. Exiting."
    kill -TERM "$N8N_PID" 2>/dev/null || true
    wait "$N8N_PID" 2>/dev/null || true
    exit 1
  fi

  if ! kill -0 "$N8N_PID" 2>/dev/null; then
    echo "n8n process exited before readiness check passed. Exiting."
    exit 1
  fi

  sleep 1
done
echo "n8n is ready!"

wait "$N8N_PID"
