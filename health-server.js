const http = require("http");
const https = require("https");
const fs = require("fs");
const net = require("net");

const PORT = Number(process.env.PUBLIC_PORT || 7861);
const TARGET_PORT = Number(process.env.N8N_PORT || 5678);
const TARGET_HOST = "127.0.0.1";
const SYNC_STATUS_FILE = "/tmp/hugging8n-sync-status.json";
const APP_BASE = "/app";
const startTime = Date.now();

function parseRequestUrl(url) {
  try {
    return new URL(url, "http://localhost");
  } catch {
    return new URL("http://localhost/");
  }
}

function getStatus() {
  try {
    if (fs.existsSync(SYNC_STATUS_FILE)) {
      return JSON.parse(fs.readFileSync(SYNC_STATUS_FILE, "utf8"));
    }
  } catch {}
  return {
    status: "unknown",
    message: "Initial startup...",
    timestamp: new Date().toISOString(),
  };
}

function renderDashboard(data) {
  const syncBadge = (status) => {
    let cls = "status-offline";
    if (
      status === "success" ||
      status === "configured" ||
      status === "restored"
    )
      cls = "status-online";
    if (status === "syncing" || status === "restoring") cls = "status-syncing";
    return `<div class="status-badge ${cls}">${cls === "status-online" ? '<div class="pulse"></div>' : ""}${String(status).toUpperCase()}</div>`;
  };

  const keepAwakeHtml = data.isPrivate
    ? `<div class="helper-summary"><strong>Private Space detected.</strong> External monitors cannot access private health URLs.</div>`
    : `
        <div id="uptimerobot-flow">
            <div class="helper-summary" id="uptimerobot-summary">Setup a free monitor to prevent this Space from sleeping.</div>
            <button id="uptimerobot-toggle" class="helper-toggle">Set Up Monitor</button>
            <div id="uptimerobot-shell" class="hidden" style="margin-top:12px">
                <input id="uptimerobot-key" class="helper-input" type="password" placeholder="UptimeRobot Main API Key">
                <button id="uptimerobot-btn" class="helper-button">Create Monitor</button>
            </div>
        </div>
    `;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hugging8n Dashboard</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600&display=swap" rel="stylesheet">
    <style>
        :root { --bg: #0f172a; --card: rgba(30, 41, 59, 0.7); --accent: linear-gradient(135deg, #3b82f6, #8b5cf6); --text: #f8fafc; --text-dim: #94a3b8; --success: #10b981; --error: #ef4444; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Outfit', sans-serif; background: var(--bg); color: var(--text); display: flex; justify-content: center; min-height: 100vh; padding: 40px 20px; background-image: radial-gradient(at 0% 0%, rgba(59, 130, 246, 0.15) 0px, transparent 50%), radial-gradient(at 100% 0%, rgba(139, 92, 246, 0.15) 0px, transparent 50%); }
        .dashboard { width: 100%; max-width: 600px; background: var(--card); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 24px; padding: 40px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); }
        h1 { font-size: 2.2rem; margin-bottom: 8px; background: var(--accent); -webkit-background-clip: text; -webkit-text-fill-color: transparent; text-align: center; }
        .subtitle { color: var(--text-dim); text-align: center; font-size: 0.9rem; margin-bottom: 40px; text-transform: uppercase; letter-spacing: 1px; }
        .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
        .card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); padding: 20px; border-radius: 16px; }
        .label { color: var(--text-dim); font-size: 0.75rem; text-transform: uppercase; margin-bottom: 8px; display: block; }
        .value { font-size: 1.1rem; font-weight: 600; }
        .btn { display: block; background: var(--accent); color: #fff; padding: 16px; border-radius: 16px; text-align: center; text-decoration: none; font-weight: 600; margin-top: 8px; transition: transform 0.2s; box-shadow: 0 10px 20px -5px rgba(59, 130, 246, 0.4); }
        .btn:hover { transform: scale(1.02); }
        .status-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 600; }
        .status-online { background: rgba(16, 185, 129, 0.1); color: var(--success); }
        .status-syncing { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
        .status-offline { background: rgba(239, 68, 68, 0.1); color: var(--error); }
        .pulse { width: 8px; height: 8px; border-radius: 50%; background: currentColor; animation: pulse 2s infinite; }
        @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); } 70% { box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); } 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); } }
        .helper-input { width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 12px; border-radius: 12px; margin-bottom: 12px; }
        .helper-button { background: var(--accent); color: #fff; border: 0; padding: 12px; border-radius: 12px; cursor: pointer; width: 100%; font-weight: 600; }
        .helper-toggle { background: rgba(255,255,255,0.05); color: #fff; border: 1px solid rgba(255,255,255,0.1); padding: 8px 16px; border-radius: 12px; cursor: pointer; font-size: 0.85rem; }
        .hidden { display: none; }
        .helper-summary { background: rgba(255,255,255,0.03); padding: 12px; border-radius: 12px; font-size: 0.85rem; color: var(--text-dim); margin-bottom: 12px; }
        .helper-result { margin-top: 12px; font-size: 0.85rem; padding: 10px; border-radius: 8px; display: none; }
        .helper-result.ok { display: block; background: rgba(16, 185, 129, 0.1); color: var(--success); }
        .helper-result.error { display: block; background: rgba(239, 68, 68, 0.1); color: var(--error); }
    </style>
</head>
<body>
    <div class="dashboard">
        <h1>🔗 Hugging8n</h1>
        <p class="subtitle">Workflow Automation Space</p>
        
        <div class="stats">
            <div class="card"><span class="label">Uptime</span><span class="value" id="uptime">${data.uptimeHuman}</span></div>
            <div class="card"><span class="label">n8n Port</span><span class="value">${TARGET_PORT}</span></div>
        </div>

        <div class="card" style="margin-bottom:16px">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px">
                <span class="label" style="margin-bottom:0">Sync Status</span>
                <div id="sync-badge">${syncBadge(data.sync.status)}</div>
            </div>
            <div style="font-size:0.85rem; color:var(--text-dim)">
                Last Activity: <span id="sync-time" style="color:var(--text)">${data.sync.timestamp}</span>
                <div id="sync-msg" style="margin-top:4px">${data.sync.message}</div>
            </div>
        </div>

        <a href="/app/" class="btn" target="_blank" rel="noopener noreferrer">Open n8n Editor</a>

        <div class="card" style="margin-top:24px">
            <span class="label">Keep Alive</span>
            ${keepAwakeHtml}
            <div id="uptimerobot-result" class="helper-result"></div>
        </div>
    </div>

    <script>
        async function refresh() {
            try {
                const res = await fetch('/status' + window.location.search);
                const d = await res.json();
                document.getElementById('uptime').textContent = d.uptime;
                document.getElementById('sync-time').textContent = d.sync.timestamp;
                document.getElementById('sync-msg').textContent = d.sync.message;
                
                const s = d.sync.status;
                let cls = "status-offline";
                if (s === "success" || s === "configured" || s === "restored") cls = "status-online";
                if (s === "syncing" || s === "restoring") cls = "status-syncing";
                document.getElementById('sync-badge').innerHTML = '<div class="status-badge ' + cls + '">' + (cls === 'status-online' ? '<div class="pulse"></div>' : '') + s.toUpperCase() + '</div>';
            } catch (e) {}
        }
        setInterval(refresh, 5000);

        const toggle = document.getElementById('uptimerobot-toggle');
        if (toggle) {
            toggle.onclick = () => document.getElementById('uptimerobot-shell').classList.toggle('hidden');
            document.getElementById('uptimerobot-btn').onclick = async () => {
                const key = document.getElementById('uptimerobot-key').value;
                const res = document.getElementById('uptimerobot-result');
                if (!key) return;
                res.className = 'helper-result'; res.textContent = 'Creating...'; res.style.display = 'block';
                try {
                    const r = await fetch('/uptimerobot/setup' + window.location.search, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ apiKey: key })
                    });
                    const data = await r.json();
                    res.className = 'helper-result ' + (r.ok ? 'ok' : 'error');
                    res.textContent = data.message;
                } catch (e) { res.className = 'helper-result error'; res.textContent = 'Connection failed'; }
            };
        }
    </script>
</body>
</html>`;
}

async function resolveSpaceIsPrivate(req) {
  const params = new URLSearchParams(parseRequestUrl(req.url).search);
  const token = params.get("__sign");
  if (!token) return false;
  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64").toString(),
    );
    const sub = payload.sub || "";
    const match = sub.match(/^\/spaces\/([^/]+)\/([^/]+)$/);
    if (!match) return false;
    return new Promise((resolve) => {
      https
        .get(
          `https://huggingface.co/api/spaces/${match[1]}/${match[2]}`,
          { headers: { "User-Agent": "Hugging8n" } },
          (res) => {
            resolve(
              res.statusCode === 401 ||
                res.statusCode === 403 ||
                res.statusCode === 404,
            );
          },
        )
        .on("error", () => resolve(false));
    });
  } catch {
    return false;
  }
}

const server = http.createServer(async (req, res) => {
  const url = parseRequestUrl(req.url);
  const pathname = url.pathname;

  if (pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ status: "ok", ...getStatus() }));
  }

  if (pathname === "/status") {
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    return res.end(
      JSON.stringify({
        uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
        sync: getStatus(),
      }),
    );
  }

  if (pathname === "/uptimerobot/setup" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", async () => {
      try {
        const { apiKey } = JSON.parse(body);
        const host = req.headers.host;
        const monitorUrl = `https://${host}/health`;
        const post = (p, d) =>
          new Promise((res, rej) => {
            const r = https.request(
              {
                hostname: "api.uptimerobot.com",
                port: 443,
                path: p,
                method: "POST",
                headers: {
                  "Content-Type": "application/x-www-form-urlencoded",
                },
              },
              (r) => {
                let b = "";
                r.on("data", (c) => (b += c));
                r.on("end", () => res(JSON.parse(b)));
              },
            );
            r.on("error", rej);
            r.write(new URLSearchParams(d).toString());
            r.end();
          });

        const existing = await post("/v2/getMonitors", {
          api_key: apiKey,
          format: "json",
        });
        if (existing.monitors?.some((m) => m.url === monitorUrl)) {
          res.writeHead(200);
          return res.end(
            JSON.stringify({ message: "Monitor already exists." }),
          );
        }
        const created = await post("/v2/newMonitor", {
          api_key: apiKey,
          format: "json",
          type: "1",
          friendly_name: `Hugging8n ${host}`,
          url: monitorUrl,
          interval: "300",
        });
        if (created.stat === "ok") {
          res.writeHead(200);
          return res.end(
            JSON.stringify({ message: "Monitor created successfully!" }),
          );
        }
        res.writeHead(400);
        res.end(
          JSON.stringify({
            message: created.error?.message || "Failed to create monitor.",
          }),
        );
      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ message: "Invalid request." }));
      }
    });
    return;
  }

  if (pathname === "/" || pathname === "/dashboard") {
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    const isPrivate = await resolveSpaceIsPrivate(req);
    res.writeHead(200, { "Content-Type": "text/html" });
    return res.end(
      renderDashboard({
        uptimeHuman: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
        sync: getStatus(),
        isPrivate,
      }),
    );
  }

  // Proxy to n8n
  // We strip the /app prefix if present, as n8n will be configured with N8N_PATH=/
  let proxyPath = pathname;
  if (proxyPath.startsWith(APP_BASE)) {
    proxyPath = proxyPath.substring(APP_BASE.length);
  }
  if (!proxyPath.startsWith("/")) proxyPath = "/" + proxyPath;

  const proxyHeaders = {
    ...req.headers,
    host: `127.0.0.1:${TARGET_PORT}`,
    "x-forwarded-for": req.socket.remoteAddress,
    "x-forwarded-proto": "https",
  };

  const proxyReq = http.request(
    {
      hostname: TARGET_HOST,
      port: TARGET_PORT,
      path: proxyPath + url.search,
      method: req.method,
      headers: proxyHeaders,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );

  proxyReq.on("error", () => {
    res.writeHead(503, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "starting",
        message: "n8n is initializing, please wait...",
      }),
    );
  });

  req.pipe(proxyReq);
});

server.on("upgrade", (req, socket, head) => {
  const url = parseRequestUrl(req.url);
  let proxyPath = url.pathname;
  if (proxyPath.startsWith(APP_BASE)) {
    proxyPath = proxyPath.substring(APP_BASE.length);
  }
  if (!proxyPath.startsWith("/")) proxyPath = "/" + proxyPath;

  const proxySocket = net.connect(TARGET_PORT, TARGET_HOST, () => {
    proxySocket.write(
      `${req.method} ${proxyPath}${url.search} HTTP/${req.httpVersion}\r\n`,
    );
    for (let i = 0; i < req.rawHeaders.length; i += 2) {
      proxySocket.write(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}\r\n`);
    }
    proxySocket.write("\r\n");
    if (head && head.length) proxySocket.write(head);
    proxySocket.pipe(socket).pipe(proxySocket);
  });
  proxySocket.on("error", () => socket.destroy());
});

server.listen(PORT, "0.0.0.0", () =>
  console.log(`Dashboard/Proxy on ${PORT} -> n8n on ${TARGET_PORT}`),
);
