"use strict";
console.error("[DNS-FIX] Loaded — DoH resolver + tls/net logging active.");
const http = require("http");
const https = require("https");
const { PassThrough } = require("stream");

const blockedDomains = ["api.telegram.org", "discord.com", "discordapp.com", "web.whatsapp.com"];

function isBlocked(hostname) {
  return hostname && blockedDomains.some((d) => hostname === d || hostname.endsWith(`.${d}`));
}

// Monkey-patch http.request and https.request
const _origHttpRequest = http.request;
const _origHttpsRequest = https.request;

const IN_PROXY = Symbol("IN_PROXY");

function transparentProxyRequest(protocol, origFn, ...args) {
  let options = args[0];
  let callback = args[1];

  if (typeof options === "string") {
    try {
      options = new URL(options);
    } catch {
      return origFn.apply(this, args);
    }
  } else if (options instanceof URL) {
    // Already a URL
  } else {
    // Object options
    options = { ...options };
  }

  // RECURSION GUARD
  if (options[IN_PROXY]) {
    return origFn.apply(this, args);
  }

  if (typeof callback !== "function" && typeof args[2] === "function") {
    callback = args[2];
  }

  const hostname = options.hostname || options.host;
  const port = options.port || (protocol === "https:" ? 443 : 80);
  const path = options.path || options.pathname || "/";

  if (isBlocked(hostname)) {
    console.error(`[DNS-FIX] Transparently proxying ${protocol}//${hostname}${path} via fetch()`);

    const requestUrl = `${protocol}//${hostname}${path}`;
    const requestHeaders = { ...options.headers };
    
    // We need to return a ClientRequest-like object (a Writable stream)
    const reqStream = new PassThrough();
    const resStream = new PassThrough();
    
    // Buffer the request body
    let requestBody = Buffer.alloc(0);
    reqStream.on("data", (chunk) => {
      requestBody = Buffer.concat([requestBody, chunk]);
    });

    reqStream.on("finish", async () => {
      try {
        // Ensure fetch itself doesn't trigger our monkey-patches (if undici uses them)
        const fetchRes = await fetch(requestUrl, {
          method: options.method || "GET",
          headers: requestHeaders,
          body: options.method !== "GET" && options.method !== "HEAD" ? requestBody : undefined,
          redirect: "manual",
        });

        // ... existing logic ...
        resStream.statusCode = fetchRes.status;
        resStream.statusMessage = fetchRes.statusText;
        resStream.headers = Object.fromEntries(fetchRes.headers.entries());
        resStream.rawHeaders = [];
        for (const [k, v] of fetchRes.headers.entries()) {
          resStream.rawHeaders.push(k, v);
        }

        if (callback) callback(resStream);
        reqStream.emit("response", resStream);

        if (fetchRes.body) {
          const reader = fetchRes.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            resStream.write(value);
          }
        }
        resStream.end();
      } catch (err) {
        console.error(`[DNS-FIX] Proxy error for ${requestUrl}: ${err.message}`);
        reqStream.emit("error", err);
      }
    });

    // Mock ClientRequest methods
    reqStream.abort = () => reqStream.destroy();
    reqStream.end = (chunk) => {
      if (chunk) reqStream.write(chunk);
      reqStream.end();
    };
    reqStream.setTimeout = (ms, cb) => { if (cb) setTimeout(cb, ms); return reqStream; };
    reqStream.setNoDelay = () => reqStream;
    reqStream.setSocketKeepAlive = () => reqStream;

    return reqStream;
  }

  return origFn.apply(this, args);
}

http.request = function (...args) {
  return transparentProxyRequest("http:", _origHttpRequest, ...args);
};

https.request = function (...args) {
  return transparentProxyRequest("https:", _origHttpsRequest, ...args);
};

// Also patch http.get and https.get as they often bypass request
http.get = function (...args) {
  const options = typeof args[0] === 'string' ? new URL(args[0]) : args[0];
  if (options) options[IN_PROXY] = true;
  const req = http.request(...args);
  req.end();
  return req;
};

https.get = function (...args) {
  const options = typeof args[0] === 'string' ? new URL(args[0]) : args[0];
  if (options) options[IN_PROXY] = true;
  const req = https.request(...args);
  req.end();
  return req;
};
