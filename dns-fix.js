/**
 * DNS fix preload script for HF Spaces.
 *
 * Patches Node.js dns.lookup to:
 * 1. Try system DNS first
 * 2. Fall back to DNS-over-HTTPS (Cloudflare) if system DNS fails
 *    (This is needed because HF Spaces intercepts/blocks some domains like
 *    WhatsApp web or Telegram API via standard UDP DNS).
 *
 * Loaded via: NODE_OPTIONS="--require /opt/dns-fix.js"
 */
"use strict";

const dns = require("dns");
const https = require("https");

// In-memory cache for runtime DoH resolutions
const runtimeCache = new Map(); // hostname -> { ip, expiry }

// DNS-over-HTTPS resolver
function dohResolve(hostname, callback) {
  // Check runtime cache
  const cached = runtimeCache.get(hostname);
  if (cached && cached.expiry > Date.now()) {
    return callback(null, cached.ip);
  }

  const url = `https://1.1.1.1/dns-query?name=${encodeURIComponent(hostname)}&type=A`;
  const req = https.get(
    url,
    { headers: { Accept: "application/dns-json" }, timeout: 15000 },
    (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => {
        try {
          const data = JSON.parse(body);
          const aRecords = (data.Answer || []).filter((a) => a.type === 1);
          if (aRecords.length === 0) {
            return callback(new Error(`DoH: no A record for ${hostname}`));
          }
          const ip = aRecords[0].data;
          const ttl = Math.max((aRecords[0].TTL || 300) * 1000, 60000);
          runtimeCache.set(hostname, { ip, expiry: Date.now() + ttl });
          callback(null, ip);
        } catch (e) {
          callback(new Error(`DoH parse error: ${e.message}`));
        }
      });
    }
  );
  req.on("error", (e) => callback(new Error(`DoH request failed: ${e.message}`)));
  req.on("timeout", () => {
    req.destroy();
    callback(new Error("DoH request timed out"));
  });
}

// Monkey-patch dns.lookup
const origLookup = dns.lookup;
let isResolving = false;

dns.lookup = function patchedLookup(hostname, options, callback) {
  // Normalize arguments
  if (typeof options === "function") {
    callback = options;
    options = {};
  }
  if (typeof options === "number") {
    options = { family: options };
  }
  options = options || {};

  // Skip patching for localhost, IPs, and internal domains
  if (
    !hostname ||
    hostname === "localhost" ||
    hostname === "0.0.0.0" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    /^\d+\.\d+\.\d+\.\d+$/.test(hostname) ||
    /^::/.test(hostname) ||
    isResolving // RECURSION GUARD
  ) {
    return origLookup.call(dns, hostname, options, callback);
  }

  // 1) Try system DNS first
  origLookup.call(dns, hostname, options, (err, address, family) => {
    if (!err && address) {
      return callback(null, address, family);
    }

    // 2) System DNS failed — fall back to DoH
    if (err && (err.code === "ENOTFOUND" || err.code === "EAI_AGAIN")) {
      isResolving = true; // Enter guard
      dohResolve(hostname, (dohErr, ip) => {
        isResolving = false; // Exit guard
        if (dohErr || !ip) {
          return callback(err); // Return original error
        }
        if (options.all) {
          return callback(null, [{ address: ip, family: 4 }]);
        }
        callback(null, ip, 4);
      });
    } else {
      callback(err, address, family);
    }
  });
};
