---
title: Hugging8n
emoji: 🔗
colorFrom: red
colorTo: yellow
sdk: docker
app_port: 7861
pinned: true
license: mit
secrets:
  - name: HF_TOKEN
    description: HuggingFace token with write access. Used for automatic workspace backup.
  - name: CLOUDFLARE_WORKERS_TOKEN
    description: Cloudflare API token for automatic Worker proxy setup.
---

<!-- Badges -->
[![GitHub Stars](https://img.shields.io/github/stars/somratpro/hugging8n?style=flat-square)](https://github.com/somratpro/hugging8n)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![HF Space](https://img.shields.io/badge/🤗%20HuggingFace-Space-blue?style=flat-square)](https://huggingface.co/spaces)
[![n8n](https://img.shields.io/badge/n8n-Workflow-orange?style=flat-square)](https://n8n.io)

**Self-hosted n8n workflow automation — free, no server needed.** Hugging8n runs [n8n](https://n8n.io) on HuggingFace Spaces, providing a 24/7 automation engine for your workflows. It includes a premium management dashboard, automatic persistent backup to HF Datasets, and built-in connectivity fixes to bypass platform restrictions. Deploy in minutes on the free HF Spaces tier with full data persistence.

## Table of Contents

- [✨ Features](#-features)
- [🚀 Quick Start](#-quick-start)
- [🌐 Cloudflare Proxy Setup](#-cloudflare-proxy-setup)
- [💾 Persistent Backup](#-persistent-backup)
- [💓 Staying Alive](#-staying-alive)
- [🔐 Security & Advanced *(Optional)*](#-security--advanced-optional)
- [💻 Local Development](#-local-development)
- [🏗️ Architecture](#-architecture)
- [🐛 Troubleshooting](#-troubleshooting)
- [📚 Links](#-links)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)

## ✨ Features

- ⚡ **Zero Config:** Duplicate this Space, set `HF_TOKEN`, and start automating – no other setup needed.
- 💾 **Persistent Backup:** Workflows, credentials, and settings automatically sync to a private HF Dataset, preserving your data across restarts.
- 🔐 **Secure by Default:** Uses n8n's native user management and restricted file permissions (`umask 0077`).
- 🌐 **Built-in Connectivity:** Includes transparent outbound proxying via Cloudflare Workers for Telegram, WhatsApp-related APIs, Google APIs, Discord, and other external services.
- 📊 **Premium Dashboard:** Beautiful Web UI at `/` for real-time monitoring of uptime, sync health, and n8n status.
- ⏰ **Easy Keep-Alive:** Set up a one-time UptimeRobot monitor directly from the dashboard to keep your free Space awake.
- 🐳 **Optimized Infrastructure:** Minimal resource usage with clean startup logs and production-ready proxying.

## 🚀 Quick Start

### Step 1: Duplicate this Space

[![Duplicate this Space](https://huggingface.co/datasets/huggingface/badges/resolve/main/duplicate-this-space-xl.svg)](https://huggingface.co/spaces/somratpro/Hugging8n?duplicate=true)

### Step 2: Add Your Secrets

Navigate to your new Space's **Settings**, scroll down to **Variables and secrets**, and add:

- `HF_TOKEN` – Your HuggingFace token with **Write** access (for automatic backup).
- `CLOUDFLARE_WORKERS_TOKEN` – **(Highly Recommended)** Cloudflare API token. Hugging8n will automatically create and configure a Worker proxy for you.

### Step 3: Deploy & Initialize

The Space will build and start automatically. Once ready:

1. Visit the Space URL.
2. Click **Open n8n Editor**.
3. Create your **Owner account** (this is your primary login).

### Step 4: Monitor & Manage

Use the built-in dashboard at the root URL (`/`) to track:

- **Uptime:** Real-time uptime monitoring.
- **Sync Status:** Visual indicators for your workflow backups.
- **Keep-Alive:** Setup tool for external monitors.

## 🌐 Cloudflare Proxy Setup

Hugging Face Free Tier often restricts outbound connections to services like Telegram, Discord, and WhatsApp. Hugging8n solves this with a **Transparent Outbound Proxy** via Cloudflare Workers.

### ⚡ Automatic Setup (Recommended)

This is the easiest way. Hugging8n will handle the deployment for you.

1. Create a **Cloudflare API Token**:
   - Go to [API Tokens](https://dash.cloudflare.com/profile/api-tokens).
   - Create Token -> **Edit Cloudflare Workers** template.
   - Ensure it has `Account: Workers Scripts: Edit` permissions.
2. Add the token as a secret named `CLOUDFLARE_WORKERS_TOKEN` in your Space Settings.

**What happens next?**

- Hugging8n automatically creates a Worker named after your Space.
- It generates a secure, private `CLOUDFLARE_PROXY_SECRET`.
- All restricted outbound traffic is automatically routed through this Worker.

### 🛠️ Manual Setup

If you prefer to manage the Worker yourself:

1. Create a new Cloudflare Worker.
2. Paste the code from [cloudflare-worker.js](./cloudflare-worker.js) and deploy.
3. Add the Worker URL to your Space as `CLOUDFLARE_PROXY_URL`.
4. (Optional) Set a `CLOUDFLARE_PROXY_SECRET` in both the Worker (as a variable) and the Space (as a secret).

## 💾 Persistent Backup

Hugging8n automatically creates a private dataset named `hugging8n-backup` in your Hugging Face account.

- **Restore:** On startup, it pulls the latest state from your dataset.
- **Sync:** Periodically (every 3 minutes by default), it pushes updates to the dataset.
- **Status:** View current sync health on the Hugging8n Dashboard.

| Variable | Default | Description |
| :--- | :--- | :--- |
| `SYNC_INTERVAL` | `180` | Backup frequency in seconds |

## 💓 Staying Alive *(Recommended on Free HF Spaces)*

To help keep your Space awake, set up an external [UptimeRobot](https://uptimerobot.com/) monitor directly from the dashboard UI.

1. Open your Space's dashboard (`/`).
2. Find the **Keep Space Awake** section.
3. Paste your UptimeRobot **Main API key**.
4. Click **Create Monitor**.

Hugging8n will automatically create a monitor for your Space's `/health` endpoint.

## 🔐 Security & Advanced *(Optional)*

Customize your instance with these environment variables:

| Variable | Default | Description |
| :--- | :--- | :--- |
| `GENERIC_TIMEZONE` | `UTC` | Timezone for your n8n instance |
| `N8N_LOG_LEVEL` | `error` | Set to `info` or `debug` for more details |
| `CLOUDFLARE_WORKERS_TOKEN` | — | Cloudflare API token for automatic Worker setup |
| `CLOUDFLARE_PROXY_DOMAINS` | `*` | Comma-separated domains to proxy (or `*` for all external traffic) |
| `CLOUDFLARE_PROXY_SECRET` | — | Optional shared secret for proxy authentication |
| `CLOUDFLARE_WORKER_NAME` | auto | Custom name for the automatically created Worker |
| `CLOUDFLARE_ACCOUNT_ID` | auto | Optional Cloudflare account ID override |
| `SPACE_HOST_OVERRIDE` | — | Override detected host for custom domains |
| `N8N_STARTUP_TIMEOUT` | `180` | Max seconds to wait for n8n readiness |
| `UPTIMEROBOT_SETUP_ENABLED` | `true` | Enable/disable dashboard helper endpoint |
| `UPTIMEROBOT_RATE_LIMIT_PER_MINUTE` | `5` | Rate limit for monitor creation |

## 💻 Local Development

```bash
git clone https://github.com/somratpro/hugging8n.git
cd hugging8n
cp .env.example .env
# Edit .env with your secrets
```

**With Docker:**

```bash
docker build -t hugging8n .
docker run -p 7861:7861 --env-file .env hugging8n
```

## 🏗️ Architecture

- **Dashboard (`/`)**: Management, monitoring, and keep-alive tools.
- **n8n Editor (`/home/workflows`)**: All other paths are proxied to the internal n8n instance.
- **Health Check (`/health`)**: Used for uptime monitoring and readiness probes.
- **Sync Engine**: Background process managing HF Dataset persistence.
- **Transparent Proxy**: Intercepts requests to blocked domains and routes them via Cloudflare.

## 🐛 Troubleshooting

- **Telegram/Google/WhatsApp not connecting:** Ensure `CLOUDFLARE_WORKERS_TOKEN` or `CLOUDFLARE_PROXY_URL` is set correctly, or keep `CLOUDFLARE_PROXY_DOMAINS=*`.
- **Workflows not saving:** Check if `HF_TOKEN` has **Write** access to your account.
- **Space keeps sleeping:** Use the dashboard to set up an UptimeRobot monitor.
- **Authentication errors:** n8n v2 uses its own internal users; ensure you created the owner account on first run.

## 📚 Links

- [n8n Documentation](https://docs.n8n.io)
- [Hugging Face Spaces](https://huggingface.co/docs/hub/spaces)
- [Cloudflare Workers](https://workers.cloudflare.com/)

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

MIT — see [LICENSE](LICENSE) for details.

---
*Made with ❤️ by [@somratpro](https://github.com/somratpro)*
