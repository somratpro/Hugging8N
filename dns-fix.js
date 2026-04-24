"use strict";
console.error("[DNS-FIX] Loaded — DoH resolver + tls/net logging active.");
const dns = require("dns");
const https = require("https");
const tls = require("tls");
const net = require("net");

const _origTlsConnect = tls.connect;
tls.connect = function (...args) {
  let options = {};
  if (typeof args[0] === 'object') {
    options = args[0];
  } else if (typeof args[1] === 'object') {
    options = args[1];
  }
  const host = options.host || options.servername;
  console.error(`[DNS-FIX] tls.connect -> host: ${host}, ip: ${options.host || 'unknown'}, port: ${options.port}`);
  const socket = _origTlsConnect.apply(this, args);
  socket.on('secureConnect', () => console.error(`[DNS-FIX] TLS connected ✓ ${host}`));
  socket.on('error', err => console.error(`[DNS-FIX] TLS error ✗ ${host} - ${err.code}: ${err.message}`));
  return socket;
};

const _origNetConnect = net.connect;
net.connect = function (...args) {
  let options = {};
  if (typeof args[0] === 'object') options = args[0];
  console.error(`[DNS-FIX] net.connect -> host: ${options.host}, port: ${options.port}`);
  return _origNetConnect.apply(this, args);
};

const runtimeCache = new Map();
function dohResolve(hostname, callback) {
  const cached = runtimeCache.get(hostname);
  if (cached && cached.expiry > Date.now()) return callback(null, cached.ip);
  const url = `https://1.1.1.1/dns-query?name=${encodeURIComponent(hostname)}&type=A`;
  const req = https.get(url, { headers: { Accept: "application/dns-json" }, timeout: 15000 }, (res) => {
    let body = "";
    res.on("data", (c) => (body += c));
    res.on("end", () => {
      try {
        const data = JSON.parse(body);
        const aRecords = (data.Answer || []).filter((a) => a.type === 1);
        if (aRecords.length === 0) return callback(new Error(`DoH: no A record for ${hostname}`));
        const ip = aRecords[0].data;
        const ttl = Math.max((aRecords[0].TTL || 300) * 1000, 60000);
        runtimeCache.set(hostname, { ip, expiry: Date.now() + ttl });
        callback(null, ip);
      } catch (e) {
        callback(new Error(`DoH parse error: ${e.message}`));
      }
    });
  });
  req.on("error", (e) => callback(new Error(`DoH request failed: ${e.message}`)));
  req.on("timeout", () => { req.destroy(); callback(new Error("DoH request timed out")); });
}

const origLookup = dns.lookup;
dns.lookup = function patchedLookup(hostname, options, callback) {
  if (typeof options === "function") { callback = options; options = {}; }
  if (typeof options === "number") options = { family: options };
  options = options || {};
  if (!hostname || hostname === "localhost" || hostname === "0.0.0.0" || hostname === "127.0.0.1" || hostname === "::1" || /^\d+\.\d+\.\d+\.\d+$/.test(hostname) || /^::/.test(hostname)) {
    return origLookup.call(dns, hostname, options, callback);
  }
  origLookup.call(dns, hostname, options, (err, address, family) => {
    if (!err && address) return callback(null, address, family);
    if (err && (err.code === "ENOTFOUND" || err.code === "EAI_AGAIN")) {
      console.error(`[DNS-FIX] Fallback DoH triggered for ${hostname}`);
      dohResolve(hostname, (dohErr, ip) => {
        if (dohErr || !ip) return callback(err);
        if (options.all) return callback(null, [{ address: ip, family: 4 }]);
        callback(null, ip, 4);
      });
    } else {
      callback(err, address, family);
    }
  });
};
