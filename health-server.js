const http = require("http");
const https = require("https");
const fs = require("fs");
const net = require("net");

const PORT = Number(process.env.PUBLIC_PORT || 7861);
const TARGET_PORT = Number(process.env.N8N_PORT || 5678);
const TARGET_HOST = "127.0.0.1";
const SYNC_STATUS_FILE = "/tmp/hugging8n-sync-status.json";
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
  const { status } = data.sync;
  const getBadge = (status) => {
    let cls = "status-offline";
    if (
      status === "success" ||
      status === "configured" ||
      status === "restored" ||
      status === "synced"
    )
      cls = "status-online";
    if (status === "syncing" || status === "restoring") cls = "status-syncing";
    return `<div class="status-badge ${cls}">${cls === "status-online" ? '<div class="pulse"></div>' : ""}${String(status).toUpperCase()}</div>`;
  };

  const keepAwakeHtml = data.isPrivate
    ? `
            <div id="uptimerobot-private-note" class="helper-summary">
                <strong>This Space is private.</strong> External monitors cannot reliably access private HF health URLs, so keep-awake setup is only available on public Spaces.
            </div>
        `
    : `
            <div id="uptimerobot-public-flow">
                <div id="uptimerobot-summary" class="helper-summary">
                    One-time setup for public Spaces. Paste your UptimeRobot <strong>Main API key</strong> to create the monitor.
                </div>
                <button id="uptimerobot-toggle" class="helper-toggle" type="button">
                    Set Up Monitor
                </button>
                <div id="uptimerobot-shell" class="helper-shell hidden">
                    <div class="helper-copy">
                        Do <strong>not</strong> use the Read-only API key or a Monitor-specific API key.
                    </div>
                    <div class="helper-row">
                        <input
                            id="uptimerobot-key"
                            class="helper-input"
                            type="password"
                            placeholder="Paste your UptimeRobot Main API key"
                            autocomplete="off"
                        />
                        <button id="uptimerobot-btn" class="helper-button" type="button">
                            Create Monitor
                        </button>
                    </div>
                    <div class="helper-note">
                        One-time setup. Your key is only used to create the monitor for this Space.
                    </div>
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
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg: #0f172a;
            --card: #1e293b;
            --accent: #6366f1;
            --text: #f8fafc;
            --text-muted: #94a3b8;
            --success: #22c55e;
            --warning: #f59e0b;
            --error: #ef4444;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Outfit', sans-serif;
            background: var(--bg);
            color: var(--text);
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 20px;
        }
        .dashboard {
            background: var(--card);
            width: 100%;
            max-width: 500px;
            padding: 40px;
            border-radius: 24px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            text-align: center;
            border: 1px solid rgba(255,255,255,0.05);
        }
        h1 { font-size: 2.5rem; margin-bottom: 8px; letter-spacing: -1px; }
        .subtitle { color: var(--text-muted); margin-bottom: 32px; font-weight: 300; }
        
        .stats {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin-bottom: 24px;
        }
        .stat-card {
            background: rgba(255,255,255,0.03);
            padding: 20px;
            border-radius: 16px;
            text-align: left;
        }
        .stat-label { font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px; }
        .stat-value { font-size: 1.25rem; font-weight: 600; }

        .sync-box {
            background: rgba(255,255,255,0.03);
            padding: 24px;
            border-radius: 16px;
            margin-bottom: 32px;
            text-align: left;
            position: relative;
        }
        .sync-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .status-badge {
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 0.7rem;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .status-online { background: rgba(34, 197, 94, 0.2); color: var(--success); }
        .status-syncing { background: rgba(245, 158, 11, 0.2); color: var(--warning); }
        .status-offline { background: rgba(239, 68, 68, 0.2); color: var(--error); }
        
        .pulse {
            width: 8px;
            height: 8px;
            background: currentColor;
            border-radius: 50%;
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0% { transform: scale(0.95); opacity: 0.7; }
            70% { transform: scale(1.5); opacity: 0; }
            100% { transform: scale(0.95); opacity: 0; }
        }

        .btn-primary {
            display: block;
            width: 100%;
            padding: 18px;
            background: var(--accent);
            color: white;
            text-decoration: none;
            border-radius: 16px;
            font-weight: 600;
            font-size: 1.1rem;
            transition: all 0.2s;
            box-shadow: 0 10px 15px -3px rgba(99, 102, 241, 0.4);
            margin-bottom: 32px;
        }
        .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 20px 25px -5px rgba(99, 102, 241, 0.4); }

        .keep-alive {
            border-top: 1px solid rgba(255,255,255,0.05);
            padding-top: 24px;
            text-align: left;
        }
        .keep-alive h3 { font-size: 0.85rem; color: var(--text-muted); margin-bottom: 12px; }
        
        .helper-card {
            width: 100%;
        }
        .helper-copy {
            color: var(--text-muted);
            font-size: 0.85rem;
            line-height: 1.6;
            margin-top: 10px;
        }
        .helper-copy strong {
            color: var(--text);
        }
        .helper-row {
            display: flex;
            gap: 10px;
            margin-top: 16px;
            flex-wrap: wrap;
        }
        .helper-input {
            flex: 1;
            min-width: 240px;
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid rgba(255, 255, 255, 0.08);
            color: var(--text);
            border-radius: 12px;
            padding: 12px 16px;
            font: inherit;
        }
        .helper-input::placeholder {
            color: var(--text-muted);
        }
        .helper-button {
            background: var(--accent);
            color: #fff;
            border: 0;
            border-radius: 12px;
            padding: 12px 18px;
            font: inherit;
            font-weight: 600;
            cursor: pointer;
        }
        .helper-button:disabled {
            opacity: 0.6;
            cursor: wait;
        }
        .hidden {
            display: none !important;
        }
        .helper-note {
            margin-top: 10px;
            font-size: 0.82rem;
            color: var(--text-muted);
        }
        .helper-result {
            margin-top: 14px;
            padding: 12px 14px;
            border-radius: 12px;
            font-size: 0.9rem;
            display: none;
        }
        .helper-result.ok {
            display: block;
            background: rgba(34, 197, 94, 0.1);
            color: var(--success);
        }
        .helper-result.error {
            display: block;
            background: rgba(239, 68, 68, 0.1);
            color: var(--error);
        }
        .helper-shell {
            margin-top: 12px;
        }
        .helper-summary {
            margin-top: 14px;
            padding: 12px 14px;
            border-radius: 12px;
            background: rgba(255, 255, 255, 0.03);
            color: var(--text-muted);
            font-size: 0.85rem;
            line-height: 1.5;
        }
        .helper-summary strong {
            color: var(--text);
        }
        .helper-summary.success {
            background: rgba(34, 197, 94, 0.08);
        }
        .helper-toggle {
            margin-top: 14px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background: rgba(255, 255, 255, 0.04);
            color: var(--text);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 12px;
            padding: 10px 16px;
            font: inherit;
            font-weight: 600;
            cursor: pointer;
        }
    </style>
</head>
<body>
    <div class="dashboard">
        <h1>🔗 Hugging8n</h1>
        <p class="subtitle">Workflow Automation Space</p>
        
        <div class="stats">
            <div class="stat-card">
                <div class="stat-label">Uptime</div>
                <div class="stat-value">${data.uptimeHuman}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">n8n Port</div>
                <div class="stat-value">${TARGET_PORT}</div>
            </div>
        </div>

        <div class="sync-box">
            <div class="sync-header">
                <div class="stat-label">Sync Status</div>
                ${getBadge(data.sync.status)}
            </div>
            <div class="stat-value" style="font-size: 1rem; margin-bottom: 4px;">Last Activity: ${data.sync.timestamp.split(".")[0]}Z</div>
            <div class="stat-label" style="text-transform: none;">${data.sync.message}</div>
        </div>

        <a href="/home/workflows" target="_blank" class="btn-primary">Open n8n Editor</a>

        <div class="keep-alive helper-card">
            <span class="stat-label">Keep Space Awake</span>
            ${keepAwakeHtml}
            <div id="uptimerobot-result" class="helper-result"></div>
        </div>
    </div>

    <script>
        function getCurrentSearch() {
            return window.location.search || '';
        }

        const monitorStateKey = 'hugging8n_uptimerobot_setup_v1';
        const KEEP_AWAKE_PRIVATE = ${data.isPrivate ? "true" : "false"};

        function setMonitorUiState(isConfigured) {
            const summary = document.getElementById('uptimerobot-summary');
            const shell = document.getElementById('uptimerobot-shell');
            const toggle = document.getElementById('uptimerobot-toggle');

            if (!summary || !shell || !toggle) return;

            if (isConfigured) {
                summary.classList.add('success');
                summary.innerHTML = '<strong>Already set up.</strong> Your UptimeRobot monitor should keep this public Space awake.';
                shell.classList.add('hidden');
                toggle.textContent = 'Set Up Again';
            } else {
                summary.classList.remove('success');
                summary.innerHTML = 'One-time setup for public Spaces. Paste your UptimeRobot <strong>Main API key</strong> to create the monitor.';
                toggle.textContent = 'Set Up Monitor';
            }
        }

        function restoreMonitorUiState() {
            try {
                const value = window.localStorage.getItem(monitorStateKey);
                setMonitorUiState(value === 'done');
            } catch {
                setMonitorUiState(false);
            }
        }

        function toggleMonitorSetup() {
            const shell = document.getElementById('uptimerobot-shell');
            shell.classList.toggle('hidden');
        }

        async function setupUptimeRobot() {
            const input = document.getElementById('uptimerobot-key');
            const button = document.getElementById('uptimerobot-btn');
            const result = document.getElementById('uptimerobot-result');
            const apiKey = input.value.trim();

            if (!apiKey) {
                result.className = 'helper-result error';
                result.textContent = 'Paste your UptimeRobot Main API key first.';
                return;
            }

            button.disabled = true;
            button.textContent = 'Creating...';
            result.className = 'helper-result';
            result.textContent = '';

            try {
                const res = await fetch('/uptimerobot/setup' + getCurrentSearch(), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ apiKey })
                });
                const data = await res.json();

                if (!res.ok) {
                    throw new Error(data.message || 'Failed to create monitor.');
                }

                result.className = 'helper-result ok';
                result.textContent = data.message || 'UptimeRobot monitor is ready.';
                input.value = '';
                try {
                    window.localStorage.setItem(monitorStateKey, 'done');
                } catch {}
                setMonitorUiState(true);
                document.getElementById('uptimerobot-shell').classList.add('hidden');
            } catch (error) {
                result.className = 'helper-result error';
                result.textContent = error.message || 'Failed to create monitor.';
            } finally {
                button.disabled = false;
                button.textContent = 'Create Monitor';
            }
        }

        if (!KEEP_AWAKE_PRIVATE) {
            restoreMonitorUiState();
            document.getElementById('uptimerobot-btn').addEventListener('click', setupUptimeRobot);
            document.getElementById('uptimerobot-toggle').addEventListener('click', toggleMonitorSetup);
        }
    </script>
</body>
</html>`;
}

async function resolveSpaceIsPrivate(req) {
  const host = req.headers.host || "";
  const match = host.match(/^([^.]+)-([^.]+)\.hf\.space$/);
  if (!match) return false;
  const user = match[1];
  const space = match[2];

  const params = new URLSearchParams(req.url.split("?")[1] || "");
  const token = params.get("__sign");
  if (!token) return false;
  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64").toString(),
    );
    const sub = payload.sub || "";
    const match_sub = sub.match(/^\/spaces\/([^/]+)\/([^/]+)$/);
    if (!match_sub) return false;
    return new Promise((resolve) => {
      https
        .get(
          `https://huggingface.co/api/spaces/${match_sub[1]}/${match_sub[2]}`,
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

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 64) {
        reject(new Error("Request too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function postUptimeRobot(path, form) {
  const body = new URLSearchParams(form).toString();
  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        hostname: "api.uptimerobot.com",
        port: 443,
        method: "POST",
        path,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (response) => {
        let raw = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          raw += chunk;
        });
        response.on("end", () => {
          try {
            resolve(JSON.parse(raw));
          } catch {
            reject(new Error("Unexpected response from UptimeRobot"));
          }
        });
      },
    );
    request.on("error", reject);
    request.write(body);
    request.end();
  });
}

async function createUptimeRobotMonitor(apiKey, host) {
  const cleanHost = String(host || "")
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
  if (!cleanHost) throw new Error("Missing Space host.");
  const monitorUrl = `https://${cleanHost}/health`;
  const existing = await postUptimeRobot("/v2/getMonitors", {
    api_key: apiKey,
    format: "json",
    logs: "0",
    response_times: "0",
    response_times_limit: "1",
  });
  const existingMonitor = Array.isArray(existing.monitors)
    ? existing.monitors.find((m) => m.url === monitorUrl)
    : null;
  if (existingMonitor) {
    return {
      created: false,
      message: `Monitor already exists for ${monitorUrl}`,
    };
  }
  const created = await postUptimeRobot("/v2/newMonitor", {
    api_key: apiKey,
    format: "json",
    type: "1",
    friendly_name: `Hugging8n ${cleanHost}`,
    url: monitorUrl,
    interval: "300",
  });
  if (created.stat !== "ok") {
    throw new Error(created?.error?.message || "Failed to create monitor.");
  }
  return { created: true, message: `Monitor created for ${monitorUrl}` };
}

const server = http.createServer(async (req, res) => {
  const url = parseRequestUrl(req.url);
  const pathname = url.pathname;

  // 1. Dashboard Routes
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
    void (async () => {
      try {
        const body = await readRequestBody(req);
        const { apiKey } = JSON.parse(body || "{}");
        if (!apiKey) {
          res.writeHead(400, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ message: "API key is required." }));
        }
        const result = await createUptimeRobotMonitor(apiKey, req.headers.host);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ message: e.message || "Invalid request." }));
      }
    })();
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

  // 2. n8n Proxy Logic
  // Any path that isn't a dashboard route gets proxied to n8n.
  const proxyHeaders = {
    ...req.headers,
    host: `127.0.0.1:${TARGET_PORT}`,
    "x-forwarded-for": req.socket.remoteAddress,
    "x-forwarded-host": req.headers.host,
    "x-forwarded-proto": "https",
  };

  const proxyReq = http.request(
    {
      hostname: TARGET_HOST,
      port: TARGET_PORT,
      path: pathname + url.search,
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
        message: "n8n is initializing...",
      }),
    );
  });

  req.pipe(proxyReq);
});

server.on("upgrade", (req, socket, head) => {
  const url = parseRequestUrl(req.url);
  const proxyPath = url.pathname;
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

server.timeout = 0;
server.keepAliveTimeout = 0;
server.listen(PORT, "0.0.0.0", () =>
  console.log(`Namespace Proxy on ${PORT} -> n8n on ${TARGET_PORT}`),
);
