# Kano Mart API Deployment

Payments remain manual/prototype for now. Do not configure Paystack, Monnify, or
Flutterwave until the gateway slice is intentionally added.

## Minimum Runtime

```txt
Node.js 20+
Persistent disk or hosted database
HTTPS in front of the API
```

## Environment

Use `.env.example` as the production checklist.

Important values:

```txt
PORT=8787
NODE_ENV=production
CORS_ORIGIN=https://your-frontend-domain.example
API_DATA_FILE=./data/kano-mart-api.json
KANO_ADMIN_PHONE=08000000000
```

`API_DATA_FILE` enables durable JSON persistence for the no-database phase. It is
good enough for demos and controlled pilots, but PostgreSQL should replace it
before public launch.

## Run

```bash
npm run api:dev
```

For production, run the same entrypoint under a process manager or host command:

```bash
node api/server.mjs
```

## Current Persistence

The API now persists all in-memory stores to `API_DATA_FILE`:

- users and sessions
- vendors and approvals
- products and uploads
- carts, orders, payments, wallet ledger
- notifications, reviews, wishlist
- promotions, payouts, categories, analytics counters

## Hardening Included

- HttpOnly cookies
- Secure cookies when `NODE_ENV=production`
- CORS allowlist through `CORS_ORIGIN`
- JSON body limit through `API_BODY_LIMIT_BYTES`
- Basic IP rate limit through `API_RATE_LIMIT_*`
- Security headers on JSON responses
- Password hashing iterations configurable with `PASSWORD_HASH_ITERATIONS`

## Still Recommended Before Public Launch

- Replace JSON persistence with PostgreSQL.
- Replace data-URL upload storage with Cloudflare R2 or S3-compatible storage.
- Put the API behind HTTPS.
- Add structured logs and backups.
- Wire the frontend to these API routes.
