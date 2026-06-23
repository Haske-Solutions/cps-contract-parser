# CPS Parser API (Backend Proxy)

Node/Express service that holds **AWS Bedrock credentials** and exposes authenticated parser endpoints for the [CPS Contract Parser](https://github.com/Haske-Solutions/cps-contract-parser) desktop app.

Packaged Electron clients call this API instead of Bedrock directly. Users only need a **Parser API URL** and **API key** in Settings.

## Architecture

```text
Electron app  ──HTTPS POST (base64 PDFs)──►  Parser API (this service)  ──►  Amazon Bedrock
              Authorization: Bearer <key>         Express + AWS SDK              Claude Sonnet 4.6
```

Shared prompt and validation logic lives in the repo root `src/` (imported by `server/src/routes/parser.ts`).

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | No | Liveness probe (no Bedrock check) |
| `GET` | `/v1/health` | Bearer API key | Auth check + Bedrock credential probe |
| `POST` | `/v1/discover` | Bearer API key | Supplier discovery from PDF pair |
| `POST` | `/v1/extract` | Bearer API key | Rate extraction from PDF pair |

All `/v1/*` routes are rate-limited (10 requests/minute per IP).

### Invocation parity (desktop app)

| Capability | Direct Bedrock (no proxy URL) | Parser proxy |
|------------|-------------------------------|--------------|
| Supplier discovery | `discoverSuppliers` → Bedrock | `POST /v1/discover` |
| Single-property extract | `extractRates` → Bedrock | `POST /v1/extract` |
| Multi-property batch | `extractRatesForMappings` — sequential Bedrock calls (concurrency 2) | Same endpoint per property; **concurrency 1** to avoid rate limits |
| Extraction progress UI | IPC events (client-side) | IPC events (client-side) |
| Extraction disk cache | Local `extraction-cache/` | Local `extraction-cache/` |

When a Parser API URL is configured in Settings, the desktop app routes **all** discover/extract calls through the proxy — local AWS credentials are not used.

### Request bodies

Both `POST` endpoints expect JSON with base64-encoded PDFs:

- **`/v1/discover`** — `ratePDF`, `contractForm`, `peCatalog`, `anchorTerm`
- **`/v1/extract`** — `ratePDF`, `contractForm`, optional `options` (PE catalog, target supplier ID, etc.)

The desktop client sends the same shapes defined in [`src/shared/parserInvoke.ts`](../src/shared/parserInvoke.ts).

### Response codes

| Status | Meaning |
|--------|---------|
| `200` | Success |
| `400` | Invalid request body |
| `401` | Missing or wrong API key |
| `413` | Body too large (Express limit or reverse proxy) |
| `429` | Rate limit exceeded |
| `500` | Bedrock or parsing failure |
| `503` | `/v1/health` — Bedrock credentials unavailable |

Extraction calls are **long-running** (often 1–3+ minutes per property). Configure reverse-proxy read/write timeouts accordingly (see below).

## Environment variables

Copy [`server/.env.example`](.env.example) to `server/.env`:

| Variable | Required | Description |
|----------|----------|-------------|
| `PARSER_API_KEY` | Yes | Shared secret; clients send `Authorization: Bearer <key>` |
| `AWS_REGION` | No | Bedrock region (default `us-east-1`) |
| `AWS_ACCESS_KEY_ID` | On VPS* | IAM user access key |
| `AWS_SECRET_ACCESS_KEY` | On VPS* | IAM user secret key |
| `PORT` | No | Listen port (default `8080`) |

\*On AWS EC2/ECS you can omit static keys and use an **instance/task IAM role** instead (`defaultProvider` picks up the role automatically).

Generate a strong API key:

```bash
openssl rand -hex 32
```

### Bedrock IAM

The IAM principal needs **`bedrock:InvokeModel`** on inference profile:

```text
us.anthropic.claude-sonnet-4-6
```

Enable **Claude Sonnet 4.6** in the Bedrock console (Model access) for the chosen region.

## Local development

From the repo root:

```bash
cd server
cp .env.example .env
# Edit .env — set PARSER_API_KEY and AWS credentials
npm install
npm run dev
```

Or from root: `npm run dev:server`

### Smoke tests

```bash
curl http://localhost:8080/health

curl -H "Authorization: Bearer YOUR_KEY" http://localhost:8080/v1/health
```

Run server unit tests:

```bash
npm test              # from server/
npm run test --prefix server   # from repo root
```

Typecheck (uses root `src/` imports):

```bash
npm run build --prefix server
```

## Docker deploy (VPS)

Build from the **repository root** (Dockerfile copies parent `src/`):

```bash
docker build -f server/Dockerfile -t cps-parser-api .
docker run --env-file server/.env -p 8080:8080 cps-parser-api
```

The container runs `tsx src/index.ts` on port **8080**.

## Reverse proxy (required for production)

Put **Caddy** or **nginx** in front with HTTPS before exposing publicly.

### Body size (413 errors)

Express accepts up to **50 MB** JSON (`express.json({ limit: '50mb' })` in [`src/index.ts`](src/index.ts)). Typical PDF pairs are ~3–10 MB base64-encoded.

If clients see **`413 Request body too large`** with small PDFs, the **reverse proxy** limit is too low — not Express. Raise it to at least **50 MB**:

**nginx**

```nginx
client_max_body_size 50m;
```

**Caddy**

```caddyfile
request_body {
  max_size 50MB
}
```

### Timeouts

Match or exceed the desktop client timeout (**10 minutes** — `PARSER_PROXY_TIMEOUT_MS` in the app). Example for nginx:

```nginx
proxy_read_timeout 600s;
proxy_send_timeout 600s;
```

Without this, long Bedrock extractions may fail with **502/504** even when Bedrock succeeds.

## Desktop app configuration

Users who download the Electron app do **not** need AWS credentials. In **Settings → Parser API**:

1. **Parser API URL** — `https://api-cp.safarico.online` (default in packaged builds)
2. **API key** — the shared `PARSER_API_KEY` (stored in the OS keychain)

Use **Test Parser Connection** to verify `/v1/health`.

For local development without the proxy, leave the URL empty — the app falls back to **direct Bedrock** via AWS SSO / local credentials.

## Security notes

- Never commit `.env` or embed the API key in the installer.
- Rotate `PARSER_API_KEY` if it leaks; update Settings on each client.
- Rate limit: **10 req/min per IP** on `/v1/*` (adjust in [`src/index.ts`](src/index.ts) if needed).
- Optional: restrict source IPs at the firewall or proxy if all users share a known network.
- Logs include `x-request-id` when the client sends it (useful for correlating failed extractions).

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| `413` with small PDFs | Reverse-proxy `client_max_body_size` / body limit too low |
| `502` / `504` mid-extraction | Proxy timeout shorter than Bedrock call |
| `401 Invalid or missing API key` | Wrong key in app Settings or `PARSER_API_KEY` on server |
| `503` on `/v1/health` | AWS credentials missing, expired, or no Bedrock access |
| `429` | Rate limit; wait 60s or raise limit for trusted IPs |
| Bedrock throttle errors | Retries are built in; backoff and retry from the client |

## Related docs

- Desktop packaging and platform builds: [`docs/PACKAGING.md`](../docs/PACKAGING.md)
- Root project README and CI: [`.github/workflows/`](../.github/workflows/)
