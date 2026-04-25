/**
 * Cloudflare Worker: Universal Outbound Proxy
 *
 * Deployment:
 * 1. Go to dash.cloudflare.com -> Workers & Pages -> Create Worker.
 * 2. Paste this code and deploy.
 * 3. Use your worker URL (e.g., https://my-proxy.workers.dev) as CLOUDFLARE_PROXY_URL.
 *
 * This worker reads the 'x-target-host' header to determine where to forward the request.
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const targetHost = request.headers.get("x-target-host");
    const proxySecret = (
      env.CLOUDFLARE_PROXY_SECRET ||
      env.PROXY_SHARED_SECRET ||
      ""
    ).trim();

    // Secret check is optional: when unset, requests are allowed without x-proxy-key.
    if (proxySecret) {
      const providedSecret = request.headers.get("x-proxy-key") || "";
      if (providedSecret !== proxySecret) {
        return new Response("Unauthorized", { status: 401 });
      }
    }

    const allowedTargetsRaw = (
      env.ALLOWED_TARGETS ||
      "api.telegram.org,discord.com,discordapp.com,gateway.discord.gg,status.discord.com,web.whatsapp.com,graph.facebook.com,googleapis.com,google.com,googleusercontent.com,gstatic.com"
    ).trim();
    const allowProxyAll =
      String(env.ALLOW_PROXY_ALL || "true").toLowerCase() === "true";
    const allowedTargets = allowedTargetsRaw
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);

    const isAllowedHost = (hostname) => {
      if (!hostname) return false;
      const normalized = String(hostname).trim().toLowerCase();
      if (!normalized) return false;
      if (allowProxyAll) return true;
      return allowedTargets.some(
        (domain) => normalized === domain || normalized.endsWith(`.${domain}`),
      );
    };

    let targetBase = "";

    if (targetHost) {
      // Use the host provided in the header (preferred)
      if (!isAllowedHost(targetHost)) {
        return new Response("Target host is not allowed.", { status: 403 });
      }
      targetBase = `https://${targetHost}`;
    } else {
      // Fallback: Guess based on path (legacy support)
      if (url.pathname.startsWith("/bot")) {
        targetBase = "https://api.telegram.org";
      } else if (
        url.pathname.startsWith("/api/webhooks") ||
        url.pathname.startsWith("/api/v")
      ) {
        targetBase = "https://discord.com";
      } else {
        return new Response(
          "Invalid request. 'x-target-host' header missing and target not recognized via path.",
          { status: 400 },
        );
      }
    }

    const targetUrl = targetBase + url.pathname + url.search;

    // Copy headers and remove internal/Cloudflare-specific ones
    const headers = new Headers(request.headers);
    headers.delete("host");
    headers.delete("cf-connecting-ip");
    headers.delete("cf-ray");
    headers.delete("cf-visitor");
    headers.delete("x-real-ip");
    headers.delete("x-target-host"); // Don't leak this to the target

    const modifiedRequest = new Request(targetUrl, {
      method: request.method,
      headers: headers,
      body: request.body,
      redirect: "follow",
    });

    try {
      const response = await fetch(modifiedRequest);

      // Special handling for some providers which might return 403 on some CF IPs.
      // If needed, you can add retry logic here.

      return response;
    } catch (e) {
      return new Response(`Proxy Error: ${e.message}`, { status: 502 });
    }
  },
};
