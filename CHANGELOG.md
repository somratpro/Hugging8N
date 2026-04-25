# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-04-24

### 🎉 Initial Release

#### Features

- **Self-hosted n8n** — Runs the latest n8n on HuggingFace Spaces Docker using SQLite (no external DB required).
- **Persistent Backup** — Automatically syncs the entire n8n workspace (workflows, credentials, database) to a private HF Dataset.
- **Cloudflare Transparent Proxy** — Built-in fix to bypass platform network blocks for Telegram, WhatsApp-related APIs, Google integrations, Discord, and other outbound services.
- **Automatic Cloudflare Worker provisioning** — Hugging8n can now create or update its outbound proxy automatically from `CLOUDFLARE_WORKERS_TOKEN`, matching HuggingClaw's auto-setup flow.
- **Google node coverage widened** — Worker defaults now cover Google API families more broadly so Sheets, Drive, Gmail, OAuth, and related nodes work without manual domain tuning.
- **Premium Dashboard** — Beautiful web interface at `/` for real-time uptime monitoring and sync health tracking.
- **Built-in Keep-Alive** — Integrated UptimeRobot setup tool directly from the dashboard to prevent free HF Spaces from sleeping.
- **Native Security** — Optimized for n8n v2 native user management with hardened file permissions (`umask 0077`).
- **Safe Persistence** — Uses atomic SQLite backups to ensure data integrity during periodic syncs.
- **Auto-Restore** — Seamlessly pulls the latest state from your HF Dataset on every startup.
- **Graceful Shutdown** — Ensures a final backup pass is completed on `SIGTERM` / `SIGINT` before the container exits.

#### Architecture

- `Dockerfile` — Optimized build on `node:22-slim` including all n8n and sync dependencies.
- `start.sh` — Orchestrates startup, validates environment, and manages service lifecycle.
- `health-server.js` — High-performance namespace proxy and dashboard server.
- `cloudflare-proxy.js` — Transparently intercepts and routes blocked traffic via Cloudflare Workers.
- `n8n-sync.py` — Robust background sync engine using the `huggingface_hub` API.
- `start.sh` — Configures environment, restores backup, and launches background sync loop.

---
*Made with ❤️ by [@somratpro](https://github.com/somratpro)*
