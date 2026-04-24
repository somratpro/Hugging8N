---
title: Hugging8n
emoji: 🔗
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7861
pinned: true
license: mit
secrets:
  - name: HF_TOKEN
    description: HuggingFace token with write access. Used for automatic backup.
---

# 🔗 Hugging8n

**Self-hosted n8n workflow automation — free, no server needed.** Hugging8n runs [n8n](https://n8n.io) on HuggingFace Spaces Docker, serving a premium dashboard at `/` and the n8n editor is accessible via the dashboard.

## ✨ Features

- ⚡ **Zero Config:** Duplicate this Space, set `HF_TOKEN`, and you're ready.
- 💾 **Persistent Backup:** Workflows and credentials back up automatically to a private HF Dataset.
- 🔐 **Secure by Default:** Uses n8n v2's built-in user management. No more insecure environment variables.
- 🌐 **Premium Dashboard:** Live status monitoring, uptime tracking, and integrated keep-alive tools.
- ⏰ **Built-in Keep-Alive:** Easily setup UptimeRobot directly from the dashboard UI.
- 🐳 **Optimized Infrastructure:** Clean startup logs, minimal resource usage, and production-ready proxy.

## 🚀 Quick Start

### Step 1: Duplicate this Space

[![Duplicate this Space](https://huggingface.co/datasets/huggingface/badges/resolve/main/duplicate-this-space-xl.svg)](https://huggingface.co/spaces/somratpro/Hugging8n?duplicate=true)

### Step 2: Configure Secrets

Go to **Settings > Secrets** and add:
- `HF_TOKEN`: Your HuggingFace token with **Write** access.

### Step 3: Initialize n8n

1. Wait for the Space to build.
2. Visit the Space URL and click **Open n8n Editor**.
3. Create your owner account (this is your primary login).

## ⚙️ Configuration

You can customize Hugging8n using Environment Variables (Settings > Variables):

| Variable | Default | Description |
| :--- | :--- | :--- |
| `SYNC_INTERVAL` | `180` | Backup frequency in seconds. |
| `GENERIC_TIMEZONE` | `UTC` | Timezone for n8n. |
| `N8N_LOG_LEVEL` | `error` | Set to `info` for more verbose logs. |
| `SPACE_HOST_OVERRIDE` | - | Override the detected host if using a custom domain. |

## 🔐 Authentication & Security

Hugging8n uses n8n's native user management.
- The first person to access the n8n editor on a fresh install becomes the **Owner**.
- **Important:** If you delete the Space and haven't set up `HF_TOKEN`, your users and workflows will be lost.
- **Permissions:** The startup script uses `umask 0077` to ensure all sensitive data is restricted to the node user.

## 💾 Persistent Backup

Hugging8n automatically creates and maintains a private dataset in your Hugging Face account named `hugging8n-backup`.
- **Sync Status:** You can check the current sync health directly on the Hugging8n Dashboard.
- **Restoration:** On every startup, Hugging8n pulls the latest state from your dataset before launching n8n.

## ⚠️ Known Limitations & Workarounds

**Discord Webhooks**
Hugging Face officially blocks outgoing connections to Discord on Free Tier Spaces. To use the Discord node, you must route your traffic through a simple, free proxy.

👉 **[Read the Guide: How to Create a Free Discord Proxy in 2 minutes](./DISCORD_PROXY_GUIDE.md)**
*(Upgrading to a paid Space removes this firewall restriction entirely).*

## 🏗️ Architecture

- `/` : **Premium Dashboard** (Management & Monitoring)
- All other paths (e.g., `/home/workflows`) : Proxied to **n8n Workflow Editor**
- `/health` : **Health Check** (Used by the internal proxy and external monitors)

---
*Made with ❤️ by [@somratpro](https://github.com/somratpro)*
