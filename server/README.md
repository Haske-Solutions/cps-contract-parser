# CPS Parser API (Backend Proxy)

Node/Express service that holds AWS Bedrock credentials and exposes authenticated parser endpoints for the CPS Contract Parser desktop app.

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | No | Liveness probe |
| `GET` | `/v1/health` | Bearer API key | Auth + Bedrock credential check |
| `POST` | `/v1/discover` | Bearer API key | Supplier discovery from PDFs |
| `POST` | `/v1/extract` | Bearer API key | Rate extraction from PDFs |

## Environment variables

Copy `.env.example` to `.env` on the VPS:

```bash
PARSER_API_KEY=your-long-random-secret
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
PORT=8080
```

The IAM user or instance role needs `bedrock:InvokeModel` on inference profile `us.anthropic.claude-sonnet-4-6`.

## Local development

From the repo root:

```bash
cd server
cp .env.example .env
# Edit .env with your API key and AWS credentials
npm install
npm run dev
```

Or from root: `npm run dev:server`

Test health:

```bash
curl http://localhost:8080/health
curl -H "Authorization: Bearer YOUR_KEY" http://localhost:8080/v1/health
```

## Docker deploy (VPS)

Build from the **repository root** (Dockerfile expects parent `src/`):

```bash
docker build -f server/Dockerfile -t cps-parser-api .
docker run --env-file server/.env -p 8080:8080 cps-parser-api
```

Put **Caddy** or **nginx** in front with HTTPS before exposing publicly.

## Desktop app configuration

Users who download the Electron app do **not** need AWS credentials. In **Settings → Parser API**:

1. **Parser API URL** — `https://api-cp.safarico.online` (pre-filled in packaged builds; override in Settings if needed)
2. **API key** — the shared `PARSER_API_KEY` (stored in OS keychain)

Use **Test Parser Connection** to verify.

For local dev without the proxy, leave the URL empty — the app falls back to direct Bedrock via AWS SSO / `.env`.

## Security notes

- Never commit `.env` or share the API key in the installer.
- Rotate `PARSER_API_KEY` if it leaks; update Settings on each client.
- Rate limit is 10 requests/minute per IP (adjust in `src/index.ts` if needed).
- Request body limit is 50MB for base64-encoded PDF pairs.
