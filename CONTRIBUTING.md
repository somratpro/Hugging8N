# Contributing to Hugging8n

Thanks for your interest in contributing! ♾️

## How to Contribute

### Bug Reports
- Open an issue with a clear description
- Include your HF Space logs if possible
- Mention the n8n version you're using (check Space logs on startup)

### Feature Requests
- Open an issue with the `enhancement` label
- Describe the use case — why is this needed?

### Pull Requests
1. Fork the repo
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Test locally with Docker: `docker build -t hugging8n . && docker run -p 7861:7861 --env-file .env hugging8n`
5. Commit with a clear message
6. Push and open a PR

### Code Style
- Shell scripts: use `set -e`, quote variables, comment non-obvious logic
- Keep it simple — this project should stay easy to understand
- No unnecessary dependencies

### Testing
- Test with and without `HF_TOKEN` (backup enabled and disabled)
- Test with and without `N8N_BASIC_AUTH_ACTIVE`
- Verify the `/health` endpoint responds correctly
- Verify n8n loads in the browser via the proxy

## Development Setup

```bash
cp .env.example .env
# Fill in your values
docker build -t hugging8n .
docker run -p 7861:7861 --env-file .env hugging8n
```

Then open `http://localhost:7861` — you should see the n8n UI.

## Questions?

Open an issue or start a discussion. We're friendly! 🤝
