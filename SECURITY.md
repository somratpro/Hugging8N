# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT open a public issue**
2. Email the maintainer or open a private security advisory on GitHub
3. Include steps to reproduce if possible

We'll respond within 48 hours and work on a fix.

## Security Best Practices

When deploying Hugging8n:

- **Enable basic auth** — set `N8N_BASIC_AUTH_USER` and `N8N_BASIC_AUTH_PASSWORD` to protect your n8n instance from unauthorized access
- **Use a strong password** — generate with `openssl rand -base64 24`
- **Set your Space to Private** — prevents unauthorized access to your n8n instance from the web
- **Keep your HF token scoped** — use fine-grained tokens with minimum permissions (read/write to your backup dataset only)
- **Set a strong `N8N_ENCRYPTION_KEY`** — protects your stored credentials; if lost, credentials cannot be recovered
- **Don't commit `.env` files** — the `.gitignore` already excludes them
- **Review n8n credentials** — periodically audit credentials stored in n8n

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.0.x   | ✅        |
