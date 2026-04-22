---
title: Hugging8n
emoji: ♾️
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7861
pinned: true
license: mit
secrets:
  - name: N8N_BASIC_AUTH_PASSWORD
    description: Password to log in to your n8n instance. Required to protect your workflows.
  - name: HF_TOKEN
    description: HuggingFace token with write access. Used for automatic backup of your workflows and credentials to a private dataset.
  - name: N8N_ENCRYPTION_KEY
    description: Encryption key for stored credentials. Set this explicitly so credentials survive Space rebuilds. Generate with — openssl rand -hex 32
---

<!-- Badges -->
[![GitHub Stars](https://img.shields.io/github/stars/somratpro/hugging8n?style=flat-square)](https://github.com/somratpro/Hugging8N)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![HF Space](https://img.shields.io/badge/🤗%20HuggingFace-Space-blue?style=flat-square)](https://huggingface.co/spaces/somratpro/Hugging8n)
[![n8n](https://img.shields.io/badge/n8n-workflow%20automation-orange?style=flat-square)](https://n8n.io)

**Self-hosted n8n workflow automation — free, no server needed.** Hugging8n runs [n8n](https://n8n.io) on HuggingFace Spaces Docker, giving you a full-featured workflow automation platform with 400+ integrations. Your workflows, credentials, and settings are automatically backed up to a private HuggingFace Dataset so nothing is lost on restart.

## Table of Contents

- [✨ Features](#-features)
- [🚀 Quick Start](#-quick-start)
- [🔐 Authentication](#-authentication)
- [💾 Persistent Backup](#-persistent-backup)
- [💓 Staying Alive](#-staying-alive)
- [🏗️ Architecture](#-architecture)
- [💻 Local Development](#-local-development)
- [🐛 Troubleshooting](#-troubleshooting)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)

## ✨ Features

- ⚡ **Zero Config:** Duplicate this Space, set your credentials, and n8n is running in minutes.
- 🔌 **400+ Integrations:** Connect any service — HTTP, webhooks, databases, Slack, Gmail, GitHub, and more.
- 💾 **Persistent Backup:** Workflows, credentials, and the SQLite database back up automatically to a private HF Dataset. Restored on every startup so nothing is lost.
- 🔐 **Basic Auth:** n8n is protected by basic auth out of the box — just set your username and password.
- 🐳 **Docker Native:** Runs on the free HF Spaces tier (2 vCPU, 16GB RAM) with SQLite — no external database needed.
- ⏰ **External Keep-Alive:** Optional UptimeRobot integration to prevent free Space sleep.
- 🌐 **Health Endpoint:** `/health` returns service and sync status for monitoring.
- 🏠 **100% HF-Native:** Runs entirely on HuggingFace's free infrastructure.

## 🚀 Quick Start

### Step 1: Duplicate this Space

[![Duplicate this Space](https://huggingface.co/datasets/huggingface/badges/resolve/main/duplicate-this-space-xl.svg)](https://huggingface.co/spaces/somratpro/Hugging8n?duplicate=true)

Click the button above to duplicate the template into your own account.

### Step 2: Add Your Secrets

Navigate to your new Space's **Settings**, scroll to the **Variables and secrets** section, and add the following under **Secrets**:

#### Required — Authentication

| Secret | Description |
| :--- | :--- |
| `N8N_BASIC_AUTH_PASSWORD` | Password to log in to your n8n instance. Set this to protect your workflows. |

#### Required — Persistent Backup *(Highly Recommended)*

| Secret | Description |
| :--- | :--- |
| `HF_TOKEN` | HuggingFace token with write access. Get one at [hf.co/settings/tokens](https://huggingface.co/settings/tokens). |

> [!TIP]
> Without `HF_TOKEN`, n8n will still run, but workflows and credentials will be **lost every time the Space restarts**. It is strongly recommended to set this.

#### Optional — Configuration

| Variable / Secret | Default | Description |
| :--- | :--- | :--- |
| `N8N_BASIC_AUTH_USER` | `admin` | Username for n8n login |
| `HF_USERNAME` | *(auto-detected)* | Your HF username, for naming the backup dataset |
| `BACKUP_DATASET_NAME` | `hugging8n-backup` | Name of the private dataset repo for backup |
| `SYNC_INTERVAL` | `180` | How often to back up, in seconds |
| `GENERIC_TIMEZONE` | `UTC` | Timezone for schedule triggers (e.g. `Asia/Dhaka`) |
| `N8N_ENCRYPTION_KEY` | *(auto-generated)* | Encryption key for stored credentials. Set explicitly so it survives Space rebuilds. |

#### Build-Time Variable (add as Variable, not Secret)

| Variable | Default | Description |
| :--- | :--- | :--- |
| `N8N_VERSION` | `latest` | Pin a specific n8n version (e.g. `1.90.0`) for reproducibility |

> [!IMPORTANT]
> On HuggingFace Spaces, `N8N_VERSION` must be added as a **Variable** (not a Secret) so it is passed as a Docker build arg during image build.

### Step 3: Deploy & Run

That's it! The Space will build and start automatically. Watch progress in the **Logs** tab. First build takes a few minutes as n8n installs.

### Step 4: Log In

Once the Space is running, open it and log in with:
- **Username:** the value of `N8N_BASIC_AUTH_USER` (default: `admin`)
- **Password:** the value of `N8N_BASIC_AUTH_PASSWORD`

> [!WARNING]
> If you did not set `N8N_BASIC_AUTH_PASSWORD`, your n8n instance is **unprotected**. Anyone with the Space URL can access your workflows and credentials. Set this secret immediately.

## 🔐 Authentication

Hugging8n uses n8n's built-in basic auth to protect your instance. It is enabled by default.

| Variable | Default | Description |
| :--- | :--- | :--- |
| `N8N_BASIC_AUTH_ACTIVE` | `true` | Set to `false` to disable basic auth (not recommended) |
| `N8N_BASIC_AUTH_USER` | `admin` | Login username |
| `N8N_BASIC_AUTH_PASSWORD` | *(none)* | Login password — **must be set** |

## 💾 Persistent Backup

Hugging8n automatically backs up your entire n8n data directory (`/home/node/.n8n`) to a **private** HuggingFace Dataset.

**What is backed up:**
- All workflows
- All credentials (encrypted)
- SQLite database (hot-copy via `sqlite3 .backup`)
- n8n encryption key
- User data

**How it works:**
1. On startup: restore from dataset (if it exists)
2. Every `SYNC_INTERVAL` seconds: detect changes and upload
3. On shutdown (`SIGTERM`): run a final backup before exiting

| Variable | Default | Description |
| :--- | :--- | :--- |
| `HF_TOKEN` | — | HF write token |
| `HF_USERNAME` | *(auto)* | Dataset owner username |
| `BACKUP_DATASET_NAME` | `hugging8n-backup` | Dataset repo name |
| `SYNC_INTERVAL` | `180` | Backup interval in seconds |

> [!TIP]
> Set `N8N_ENCRYPTION_KEY` explicitly. If n8n auto-generates it and the Space is rebuilt (not just restarted), the key will be different and your backed-up credentials will be unreadable.

## 💓 Staying Alive *(Recommended on Free HF Spaces)*

Free HF Spaces sleep after periods of inactivity. Set up an external UptimeRobot monitor to keep yours awake.

1. Create a free account at [uptimerobot.com](https://uptimerobot.com)
2. Get your **Main API Key** from My Settings → API Settings
3. Run the helper script:
   ```bash
   UPTIMEROBOT_API_KEY=your-key ./setup-uptimerobot.sh your-space.hf.space
   ```
4. UptimeRobot will ping `/health` every 5 minutes from outside HF, keeping the Space awake.

> [!NOTE]
> This works for **public** Spaces only. Private Spaces cannot be pinged by external monitors.

## 🏗️ Architecture

```
Hugging8n/
├── Dockerfile           # Builds on node:22-slim, installs n8n + Python sync
├── start.sh             # Startup orchestrator: restore → sync loop → proxy → n8n
├── n8n-sync.py          # Backup/restore via huggingface_hub
├── health-server.js     # HTTP + WebSocket reverse proxy (port 7861 → 5678)
├── setup-uptimerobot.sh # One-shot UptimeRobot monitor creation
├── .env.example         # All environment variable documentation
└── README.md            # This file
```

**Startup sequence:**
1. Read environment variables and set n8n config
2. Warn if `N8N_BASIC_AUTH_PASSWORD` is not set
3. Restore backup from HF Dataset (if `HF_TOKEN` is set)
4. Start backup sync loop in background
5. Start health/proxy server on port 7861
6. Start n8n on port 5678
7. On `SIGTERM` / `SIGINT`: final backup + clean exit

## 💻 Local Development

```bash
git clone https://github.com/somratpro/Hugging8N.git
cd Hugging8N
cp .env.example .env
# Fill in N8N_BASIC_AUTH_PASSWORD and optionally HF_TOKEN
```

**With Docker:**

```bash
docker build -t hugging8n .
docker run -p 7861:7861 --env-file .env hugging8n
```

Then open `http://localhost:7861`.

**Pin an n8n version:**

```bash
docker build --build-arg N8N_VERSION=1.90.0 -t hugging8n .
```

## 🐛 Troubleshooting

- **Can't log in:** Make sure `N8N_BASIC_AUTH_PASSWORD` is set in Secrets. Default username is `admin`.
- **Workflows lost after restart:** Set `HF_TOKEN` and `HF_USERNAME` so the backup dataset is created and restored.
- **n8n editor shows "disconnected":** The WebSocket proxy may not have connected yet — wait a few seconds and refresh. Check Space logs for errors.
- **Space keeps sleeping:** Use `setup-uptimerobot.sh` to set up an external keep-alive monitor.
- **Credentials unreadable after rebuild:** Make sure `N8N_ENCRYPTION_KEY` is set explicitly as a Secret. If it was auto-generated, it changes on rebuild.
- **Build fails:** If you pinned `N8N_VERSION`, verify the version exists at [npmjs.com/package/n8n](https://www.npmjs.com/package/n8n?activeTab=versions).
- **Backup failing:** Check Space logs for `Sync failed`. Verify `HF_TOKEN` has write access and `HF_USERNAME` is correct.

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

MIT — see [LICENSE](LICENSE) for details.

*Made with ❤️ by [@somratpro](https://github.com/somratpro)*
