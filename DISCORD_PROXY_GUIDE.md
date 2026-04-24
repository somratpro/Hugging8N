# 🛠️ How to Create a Free Discord Proxy

Hugging Face officially blocks outgoing connections to Discord's IP addresses on Free Tier Spaces to prevent spam. While our built-in DNS script cleanly bypasses blocks for Telegram and WhatsApp, Discord is blocked at the physical IP firewall level.

This means the native n8n "Discord" node will always hang and fail with a "Connection closed unexpectedly" error.

To work around this, you can easily create your own private Discord proxy using Cloudflare Workers. It takes about 2 minutes and is 100% free (allowing up to 100,000 requests per day).

## Step-by-Step Guide

### Step 1: Create a Cloudflare Worker
1. Log into [Cloudflare](https://dash.cloudflare.com/) (create an account if you don't have one).
2. On the left sidebar, go to **Workers & Pages**.
3. Click **Create Worker** -> **Start with Hello World!**.
4. Name it something memorable, like `discord-proxy`, and click **Deploy**.

### Step 2: Add the Proxy Code
1. Once deployed, click the **Edit Code** button.
2. In the online code editor, delete the existing code and replace it entirely with this 6-line snippet:

```javascript
export default {
  async fetch(request) {
    const url = new URL(request.url);
    url.hostname = 'discord.com';
    return fetch(new Request(url, request));
  }
}
```

3. Click **Save and Deploy** in the top right corner. Cloudflare will generate a unique URL for you (e.g., `https://discord-proxy.yourname.workers.dev`).

### Step 3: Use the Proxy in n8n
Because the native Discord Node hardcodes connections to `discord.com` when using Bot tokens, you must use the **Webhook** method.

1. Add the standard **Discord** node to your n8n workflow.
2. Under "Authentication", select **Webhook**.
3. Take your normal Discord Webhook URL and replace `discord.com` with your new worker domain.
   * *Original:* `https://discord.com/api/webhooks/123456/abcdef`
   * *New:* `https://discord-proxy.yourname.workers.dev/api/webhooks/123456/abcdef`
4. Create a new Discord Webhook Credential in n8n and paste that **New URL** into the "Webhook URL" field.
5. Setup your message (e.g., set the text to "Hello World") and click **Execute Node**. Your message will instantly appear in Discord!

---
*Note: If you ever upgrade your Hugging Face Space to a paid hardware tier, the outgoing firewall restriction is removed, and you can go back to using the native n8n Discord node directly!*
