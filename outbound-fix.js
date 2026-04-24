/**
 * Outbound Fix: Transparent Proxy for Blocked Domains
 * 
 * Patches https.request to redirect traffic for Telegram/Discord
 * through a Cloudflare Worker proxy.
 */
"use strict";

const https = require("https");
const http = require("http");

let PROXY_URL = process.env.OUTBOUND_PROXY_URL;
if (PROXY_URL && !PROXY_URL.startsWith("http://") && !PROXY_URL.startsWith("https://")) {
  PROXY_URL = `https://${PROXY_URL}`;
}

// Allow user to define what to proxy. Use "*" to proxy everything except internal HF traffic.
const PROXY_DOMAINS = process.env.OUTBOUND_PROXY_DOMAINS || "api.telegram.org,discord.com,discordapp.com,gateway.discord.gg,status.discord.com";
const BLOCKED_DOMAINS = PROXY_DOMAINS.split(",").map(d => d.trim());
const PROXY_ALL = PROXY_DOMAINS === "*";

if (PROXY_URL) {
  try {
    const proxy = new URL(PROXY_URL);
    const originalHttpsRequest = https.request;
    const originalHttpRequest = http.request;

    const patch = (original, isHttps) => {
      return function (options, callback) {
        let hostname = "";
        let path = "";
        let headers = {};

        // 1. Extract hostname and path from various possible input types
        if (typeof options === "string") {
          const u = new URL(options);
          hostname = u.hostname;
          path = u.pathname + u.search;
        } else if (options instanceof URL) {
          hostname = options.hostname;
          path = options.pathname + options.search;
          headers = options.headers || {};
        } else {
          hostname = options.hostname || (options.host ? options.host.split(":")[0] : "");
          path = options.path || "/";
          headers = options.headers || {};
        }

        // 2. Check if we should intercept (and prevent recursion)
        const isInternal = hostname === "localhost" || 
                         hostname === "127.0.0.1" || 
                         hostname.endsWith(".hf.space") || 
                         hostname.endsWith(".huggingface.co") || 
                         hostname === "huggingface.co";

        let shouldProxy = false;
        if (PROXY_ALL) {
          shouldProxy = !isInternal;
        } else {
          shouldProxy = BLOCKED_DOMAINS.some(domain => hostname === domain || hostname.endsWith("." + domain));
        }

        const alreadyProxied = options._proxied || (headers && headers["x-target-host"]);

        if (shouldProxy && !alreadyProxied) {
          console.log(`[outbound-fix] Redirecting ${hostname}${path} -> ${proxy.hostname}`);

          // 3. Create fresh options for the proxied request
          const newOptions = (typeof options === "string" || options instanceof URL)
            ? { protocol: "https:", path: path }
            : { ...options };

          // Ensure it's an object we can modify
          if (typeof newOptions !== "object") return original.apply(this, arguments);

          newOptions._proxied = true;
          newOptions.protocol = "https:";
          newOptions.hostname = proxy.hostname;
          newOptions.port = proxy.port || 443;
          
          // CRITICAL: Force fresh TLS handshake for the new domain
          newOptions.servername = proxy.hostname;
          delete newOptions.host;  // Prefer hostname
          delete newOptions.agent; // Force a new agent to prevent connection reuse issues

          // Merge and update headers
          newOptions.headers = {
            ...(newOptions.headers || {}),
            "host": proxy.host,
            "x-target-host": hostname
          };

          // Always use HTTPS for the proxy connection
          return originalHttpsRequest.call(https, newOptions, callback);
        }

        return original.apply(this, arguments);
      };
    };

    https.request = patch(originalHttpsRequest, true);
    http.request = patch(originalHttpRequest, false);

    if (PROXY_ALL) {
      console.log(`[outbound-fix] Transparent proxy active in WILDCARD mode (Proxying ALL except HF internal)`);
    } else {
      console.log(`[outbound-fix] Transparent proxy active for: ${BLOCKED_DOMAINS.join(", ")}`);
    }
    console.log(`[outbound-fix] Target proxy: ${proxy.hostname}`);
  } catch (e) {
    console.error(`[outbound-fix] Failed to initialize: ${e.message}`);
  }
} else {
  console.log("[outbound-fix] OUTBOUND_PROXY_URL not set. Transparent proxy disabled.");
}
