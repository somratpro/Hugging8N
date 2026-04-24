# 🌐 Outbound Proxy Guide

Hugging Face Spaces officially blocks outgoing connections to specific services like **Telegram**, **WhatsApp**, and **Discord** on the free tier. 

Hugging8n includes a built-in **Transparent Outbound Proxy** that allows you to bypass these restrictions using a single Cloudflare Worker.

---

## 🚀 Setup in 2 Minutes

### Step 1: Deploy your Cloudflare Worker
1. Log in to [dash.cloudflare.com](https://dash.cloudflare.com/).
2. Go to **Workers & Pages** -> **Create Worker**.
3. Name it (e.g., `h8n-proxy`).
4. Paste the code from [outbound-proxy-worker.js](./outbound-proxy-worker.js) into the editor.
5. Click **Deploy**.
6. Copy your Worker URL (e.g., `h8n-proxy.yourname.workers.dev`).

### Step 2: Configure Hugging8n
Go to your Space **Settings** -> **Variables** and add:

1. **`OUTBOUND_PROXY_URL`**:
   - Value: `h8n-proxy.yourname.workers.dev` (You can omit the `https://`).

2. **`OUTBOUND_PROXY_DOMAINS`** (Optional):
   - **Default**: Proxies Telegram and Discord only.
   - **Wildcard Mode**: Set this to `*` to proxy **every single request** n8n makes to the outside world. This is the most reliable way to ensure no node ever gets blocked.

### Step 3: Restart Space
Hugging8n will now automatically intercept all requests to the blocked domains and route them through your worker. **You do not need to change any URLs inside your n8n workflows.**

---

## 🛠️ How it Works

1. **DNS Fix**: Hugging8n uses a built-in DNS-over-HTTPS (DoH) resolver to get the real IPs of blocked domains, bypassing HF's sinkholed DNS.
2. **SNI Bypass**: The transparent proxy changes the "label" (SNI) of your traffic to match your Cloudflare domain. Hugging Face sees you connecting to Cloudflare (allowed) instead of Telegram/Discord (blocked).
3. **Universal Routing**: Using the `x-target-host` header, one single worker can handle multiple different services dynamically.

---
*If you upgrade to a paid Space, these firewalls are removed and you no longer need this proxy.*
