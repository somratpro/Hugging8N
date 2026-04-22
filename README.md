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
  - name: HF_TOKEN
    description: HuggingFace token with write access. Used for automatic backup.
---

# ♾️ Hugging8n

**Self-hosted n8n workflow automation — free, no server needed.** Hugging8n runs [n8n](https://n8n.io) on HuggingFace Spaces Docker, serving a premium dashboard at `/` and the n8n editor at `/app/`.

## ✨ Features

- ⚡ **Zero Config:** Duplicate this Space, set `HF_TOKEN`, and you're ready.
- 💾 **Persistent Backup:** Workflows and credentials back up automatically to a private HF Dataset.
- 🔐 **Secure by Default:** Uses n8n v2's built-in user management. No more insecure environment variables.
- 🐳 **Docker Native:** Optimized for the free HF Spaces tier.
- 🌐 **Dashboard UI:** Beautiful management interface at the root URL.
- ⏰ **Built-in Keep-Alive:** Easily setup UptimeRobot from the dashboard.

## 🚀 Quick Start

### Step 1: Duplicate this Space

[![Duplicate this Space](https://huggingface.co/datasets/huggingface/badges/resolve/main/duplicate-this-space-xl.svg)](https://huggingface.co/spaces/somratpro/Hugging8n?duplicate=true)

### Step 2: Add Your HF_TOKEN

Add your HuggingFace token with **write** access to the Space Secrets. This enables automatic backup so your workflows aren't lost on restart.

### Step 3: Set Up Auth

When the Space starts, visit the URL and click **Open n8n Editor**. On the first run, n8n will ask you to create an owner account. **This is your primary login.**

## 🔐 Authentication

Hugging8n uses n8n's native user management.
1. The first person to visit `/app/` on a fresh install becomes the owner.
2. If you are restoring from a backup, your existing user accounts will be active.

## 💾 Persistent Backup

Your data is synced to a private dataset named `hugging8n-backup` in your HF account.

## 🏗️ Architecture

- `/` : Premium Dashboard (Status, Uptime, Keep-Alive setup)
- `/app/` : n8n Workflow Editor
- `/health` : Health check endpoint

*Made with ❤️ by [@somratpro](https://github.com/somratpro)*
