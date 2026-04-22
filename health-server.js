const http = require("http");
const net = require("net");
const fs = require("fs");

const PUBLIC_PORT = Number(process.env.PUBLIC_PORT || 7861);
const TARGET_PORT = Number(process.env.N8N_PORT || 5678);
const TARGET_HOST = "127.0.0.1";
const STATUS_FILE = "/tmp/hugging8n-sync-status.json";

function getStatus() {
  try {
    return JSON.parse(fs.readFileSync(STATUS_FILE, "utf8"));
  } catch {
    return {
      status: "unknown",
      message: "No sync status yet",
      timestamp: new Date().toISOString(),
    };
  }
}

function writeJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function buildHeaders(req) {
  return {
    ...req.headers,
    host: req.headers.host || "",
    "x-forwarded-for": req.socket.remoteAddress || "",
    "x-forwarded-host": req.headers.host || "",
    "x-forwarded-proto": req.headers["x-forwarded-proto"] || "https",
  };
}

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    return writeJson(res, 200, {
      ok: true,
      service: "hugging8n",
      n8nPort: TARGET_PORT,
      ...getStatus(),
    });
  }

  if (req.url === "/status") {
    return writeJson(res, 200, getStatus());
  }

  const upstream = http.request(
    {
      hostname: TARGET_HOST,
      port: TARGET_PORT,
      path: req.url,
      method: req.method,
      headers: buildHeaders(req),
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    },
  );

  upstream.on("error", (error) => {
    writeJson(res, 502, {
      ok: false,
      error: "upstream_unavailable",
      detail: error.message,
    });
  });

  req.pipe(upstream);
});

server.on("upgrade", (req, socket, head) => {
  const upstream = net.connect(TARGET_PORT, TARGET_HOST, () => {
    const headers = {
      ...req.headers,
      host: `${TARGET_HOST}:${TARGET_PORT}`,
      "x-forwarded-for": req.socket.remoteAddress || "",
      "x-forwarded-host": req.headers.host || "",
      "x-forwarded-proto": req.headers["x-forwarded-proto"] || "https",
      upgrade: req.headers.upgrade || "websocket",
      connection: "Upgrade",
    };

    const headerLines = Object.entries(headers)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\r\n");

    upstream.write(
      `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n` +
        headerLines +
        "\r\n\r\n",
    );

    if (head && head.length) upstream.write(head);
    upstream.pipe(socket);
    socket.pipe(upstream);
  });

  upstream.on("error", () => socket.destroy());
  socket.on("error", () => upstream.destroy());
});

server.listen(PUBLIC_PORT, "0.0.0.0", () => {
  console.log(`Hugging8n proxy listening on ${PUBLIC_PORT}, forwarding to ${TARGET_PORT}`);
});
