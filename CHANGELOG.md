# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-04-22

### 🎉 Initial Release

#### Features

- **Self-hosted n8n** — runs the latest n8n on HuggingFace Spaces Docker with zero external database requirements (uses SQLite)
- **Persistent backup** — automatically backs up `/home/node/.n8n` (workflows, credentials, SQLite DB, encryption key) to a private HF Dataset via `huggingface_hub`
- **Safe SQLite backup** — uses `sqlite3 .backup` for a consistent hot-copy of the live database
- **Auto-restore on startup** — restores the full n8n state from the dataset before starting n8n
- **Graceful shutdown** — runs a final backup pass on `SIGTERM` / `SIGINT` before exiting
- **Health endpoint** — `/health` on port 7861 returns sync status and service info
- **Proxy server** — lightweight Node.js reverse proxy forwards HTTP and WebSocket traffic from port 7861 to n8n on port 5678
- **UptimeRobot integration** — `setup-uptimerobot.sh` creates an external keep-alive monitor for the `/health` endpoint
- **Basic auth** — n8n basic auth enabled by default; set `N8N_BASIC_AUTH_USER` and `N8N_BASIC_AUTH_PASSWORD` to secure your instance
- **Timezone support** — set `GENERIC_TIMEZONE` for schedule trigger accuracy
- **Optional n8n version pinning** — pass `N8N_VERSION` as a HF Space Variable to pin a specific n8n release

#### Architecture

- `Dockerfile` — builds on `node:22-slim`, installs n8n and Python sync dependencies
- `start.sh` — validates config, restores backup, starts sync loop, proxy, and n8n
- `n8n-sync.py` — manages backup/restore using `huggingface_hub`
- `health-server.js` — lightweight HTTP + WebSocket reverse proxy with `/health` and `/status` endpoints
- `setup-uptimerobot.sh` — optional one-shot script to create an UptimeRobot monitor
