# Kano Mart API Deployment

Payments remain manual/prototype for now. Do not configure Paystack, Monnify, or
Flutterwave until the gateway slice is intentionally added.

## Minimum Runtime

```txt
Node.js 20+
Postgres database (Neon recommended)
HTTPS in front of the API
```

## Environment

Use `.env.example` as the production checklist. All variables are documented there.

Key variables:

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | **Yes** | Neon pooler URL (`?sslmode=require`) |
| `BLOB_READ_WRITE_TOKEN` | Recommended | Falls back to DB storage if unset |
| `UPSTASH_REDIS_REST_URL` | Recommended | Rate limiting; degrades to in-process if unset |
| `UPSTASH_REDIS_REST_TOKEN` | Recommended | Paired with above |
| `CRON_SECRET` | **Yes** | Protects `/api/cron/maintenance`; generate with `openssl rand -hex 32` |
| `KANO_ADMIN_PHONE` | **Yes** | First user with this phone auto-promoted to admin |
| `CORS_ORIGIN` | **Yes** | Exact frontend origin (no trailing slash) |
| `SENTRY_DSN` | Recommended | Free at sentry.io — enables production error visibility |

`API_DATA_FILE` is only for local long-running Node. Do not set it on Vercel.

## Run

```bash
# Local dev
npm run api:dev

# Production (process manager or Vercel serverless)
node api/server.mjs
```

## Database Backup — Neon

Neon handles backups automatically via continuous WAL archiving. No manual
configuration is required.

### What Neon provides

| Plan | Point-in-Time Recovery |
|---|---|
| Free (Hobby) | 24-hour window |
| Launch ($19/mo) | 7-day window |
| Scale ($69/mo) | 30-day window |

### Verify backups are working

```bash
npm run db:verify
```

This script connects to your `DATABASE_URL`, confirms core tables exist, checks
WAL level (`wal_level=replica` is required for PITR), and prints a manual
checklist for the Neon console.

### Manual restore check (do this before launch)

1. Open https://console.neon.tech → your project → **Branches**.
2. Click **Restore** on the `main` branch.
3. Pick a timestamp from the last hour — confirm a restore point is available.
4. Click **Fork to branch** (not Restore) to create a test copy.
5. Inspect the forked branch to verify data is intact.
6. Delete the forked branch.

### Recommended before public launch

- Upgrade to Neon **Launch** ($19/mo) for 7-day PITR at production scale.
- Set a `DATABASE_URL` pointing to a separate Neon **branch** for Preview
  deployments so preview data never touches production.

## Error Monitoring — Sentry

1. Create a free project at https://sentry.io.
2. Go to **Settings → Projects → [your project] → Client Keys → DSN**.
3. Add the DSN to Vercel:
   ```bash
   echo "https://xxx@yyy.ingest.sentry.io/zzz" | vercel env add SENTRY_DSN production preview development --yes
   ```
4. Redeploy — errors will now appear in your Sentry dashboard automatically.

No SDK package is needed. The API uses the Sentry HTTP Store API directly.

## Hardening Included

- HttpOnly + Secure cookies (Secure flag set when `NODE_ENV=production`)
- CORS allowlist via `CORS_ORIGIN`
- JSON body limit via `API_BODY_LIMIT_BYTES`
- IP rate limiting via Upstash (degrades gracefully to in-process limiter)
- Security headers on all responses (CSP, X-Frame-Options, Referrer-Policy)
- PBKDF2 password hashing with configurable iteration count
- Cron endpoint protected by `CRON_SECRET`

## Still Required Before Payment Gateway

- Payments remain manual/prototype — do not enable Paystack/Monnify/Flutterwave
  until webhook verification, reconciliation, and refund flows are implemented.
