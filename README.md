---
title: Hugging8n
emoji: ♾️
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7861
pinned: false
license: mit
---

# Hugging8n

Run a self-hosted n8n instance on Hugging Face Spaces without external database services.

This Space uses:

- `n8n` running locally on port `5678`
- a small proxy/health server on port `7861` for HF Spaces
- periodic backup of `/home/node/.n8n` to a private Hugging Face Dataset

## Required secret

- `HF_TOKEN`: Hugging Face token with write access to create/update a private dataset backup

## Recommended variables

- `BACKUP_DATASET_NAME`: backup dataset name. Default: `hugging8n-backup`
- `SYNC_INTERVAL`: backup interval in seconds. Default: `180`
- `GENERIC_TIMEZONE`: timezone for schedule triggers. Example: `Asia/Dhaka`
- `N8N_ENCRYPTION_KEY`: optional explicit encryption key. If omitted, n8n stores it inside `.n8n` and the backup preserves it
- `N8N_BASIC_AUTH_ACTIVE`: set to `true` if you want built-in basic auth
- `N8N_BASIC_AUTH_USER`: basic auth username
- `N8N_BASIC_AUTH_PASSWORD`: basic auth password

## Optional variables

- `HF_USERNAME`: owner of the backup dataset. By default this is inferred from `SPACE_AUTHOR_NAME`
- `SPACE_HOST_OVERRIDE`: set this only if you want to override the detected Space hostname
- `N8N_DIAGNOSTICS_ENABLED=false`
- `N8N_PERSONALIZATION_ENABLED=false`

## How persistence works

On startup, the Space restores `/home/node/.n8n` from a private dataset repo.

While running, it watches for changes and uploads the updated `.n8n` directory back to the dataset. This preserves:

- workflows
- credentials
- users
- SQLite database
- encryption key

## Keep-alive

If you already solved the sleep problem in your HF setup, use that. If not, `setup-uptimerobot.sh` can create an external monitor for `https://<your-space>.hf.space/health`.
