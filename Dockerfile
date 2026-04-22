FROM node:22-slim

ARG N8N_VERSION=latest

ENV DEBIAN_FRONTEND=noninteractive \
    N8N_PORT=5678 \
    HF_HUB_DISABLE_PROGRESS_BARS=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    jq \
    python3 \
    python3-pip \
    sqlite3 \
    tini \
    && pip3 install --no-cache-dir --break-system-packages huggingface_hub \
    && npm install -g n8n@${N8N_VERSION} \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/node/app /home/node/.n8n && \
    chmod 700 /home/node/.n8n && \
    chown -R node:node /home/node

WORKDIR /home/node/app

COPY --chown=node:node health-server.js /home/node/app/health-server.js
COPY --chown=node:node n8n-sync.py /home/node/app/n8n-sync.py
COPY --chown=node:node setup-uptimerobot.sh /home/node/app/setup-uptimerobot.sh
COPY --chown=node:node start.sh /home/node/app/start.sh

RUN chmod +x /home/node/app/start.sh /home/node/app/setup-uptimerobot.sh

USER node

EXPOSE 7861

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["/home/node/app/start.sh"]
