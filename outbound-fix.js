/**
 * Outbound Fix: Transparent Proxy for Blocked Domains
 * 
 * Patches https.request to redirect traffic for Telegram/Discord
 * through a Cloudflare Worker proxy.
 * 
 * Set OUTBOUND_PROXY_URL to your Cloudflare Worker URL.
 */
"use strict";

const https = require("https");
const http = require("http");

let PROXY_URL = process.env.OUTBOUND_PROXY_URL;
if (PROXY_URL && !PROXY_URL.startsWith("http://") && !PROXY_URL.startsWith("https://")) {
  PROXY_URL = `https://${PROXY_URL}`;
}
const BLOCKED_DOMAINS = ["api.telegram.org", "discord.com", "gateway.discord.gg"];

if (PROXY_URL) {
  try {
    const proxy = new URL(PROXY_URL);
    const originalHttpsRequest = https.request;
    const originalHttpRequest = http.request;

    const patch = (original) => {
      return function (options, callback) {
        let hostname = "";
        let path = "";

        if (typeof options === "string") {
          const u = new URL(options);
          hostname = u.hostname;
          path = u.pathname + u.search;
        } else if (options instanceof URL) {
          hostname = options.hostname;
          path = options.pathname + options.search;
        } else {
          hostname = options.hostname || (options.host ? options.host.split(":")[0] : "");
          path = options.path || "/";
        }

        if (BLOCKED_DOMAINS.includes(hostname) && !options._proxied) {
          console.log(`[outbound-fix] Redirecting ${hostname}${path} -> ${proxy.hostname}`);

          // Create new options
          const newOptions = typeof options === "string" || options instanceof URL 
            ? new URL(options.toString()) 
            : { ...options };

          // Mark to prevent recursion
          if (typeof newOptions === "object") {
            newOptions._proxied = true;
            
            // Set headers
            newOptions.headers = { 
              ...(newOptions.headers || {}), 
              host: proxy.host,
              "x-target-host": hostname // Tell the worker where to go
            };

            newOptions.hostname = proxy.hostname;
            newOptions.host = proxy.host;
            newOptions.port = proxy.port || 443;
          }

          // Force HTTPS if it was HTTP (unlikely for these domains but good for safety)
          return originalHttpsRequest.call(https, newOptions, callback);
        }

        return original.apply(this, arguments);
      };
    };

    https.request = patch(originalHttpsRequest);
    // Also patch http.request in case someone tries to use plain HTTP for these
    http.request = patch(originalHttpRequest);

    console.log(`[outbound-fix] Transparent proxy active for: ${BLOCKED_DOMAINS.join(", ")}`);
    console.log(`[outbound-fix] Target proxy: ${proxy.hostname}`);
  } catch (e) {
    console.error(`[outbound-fix] Failed to initialize: ${e.message}`);
  }
} else {
  console.log("[outbound-fix] OUTBOUND_PROXY_URL not set. Transparent proxy disabled.");
}
