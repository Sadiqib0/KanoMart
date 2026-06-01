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
API_STORE_REST_URL=https://your-upstash-rest-url
API_STORE_REST_TOKEN=your-upstash-token
API_STORE_KEY=kano-mart:api-store:v1
KANO_ADMIN_PHONE=08000000000
```

`API_DATA_FILE` enables durable JSON persistence for the no-database phase. It is
good enough for demos and controlled pilots, but PostgreSQL should replace it
before public launch.

On serverless hosts such as Vercel, use `API_STORE_REST_URL` and
`API_STORE_REST_TOKEN` instead of `API_DATA_FILE`. The API stores a full JSON
snapshot in that remote key-value store after each request. Upstash Redis works
for this test phase and can be connected from the Vercel dashboard.

## Run

```bash
npm run api:dev
```

For production, run the same entrypoint under a process manager or host command:

```bash
node api/server.mjs
```

## Current Persistence

The API persists all in-memory stores to `API_DATA_FILE` on long-running Node
hosts, or to the remote REST snapshot store when `API_STORE_REST_URL` and
`API_STORE_REST_TOKEN` are configured:

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
