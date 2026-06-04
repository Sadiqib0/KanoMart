# Kano Mart API Deployment

Payments remain manual/prototype for now. Do not configure Paystack, Monnify, or
Flutterwave until the gateway slice is intentionally added.

## Minimum Runtime

```txt
Node.js 20+
Postgres database
HTTPS in front of the API
Optional Vercel Blob token for product images
```

## Environment

Use `.env.example` as the production checklist.

Important values:

```txt
PORT=8787
NODE_ENV=production
CORS_ORIGIN=https://your-frontend-domain.example
DATABASE_URL=postgres://...
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_token
API_PUBLIC_BASE_PATH=/api
KANO_ADMIN_PHONE=08000000000
API_BODY_LIMIT_BYTES=1000000
API_UPLOAD_MAX_DATA_URL_LENGTH=750000
SENTRY_DSN=
```

`DATABASE_URL` is required in production. `API_DATA_FILE` is only a local
long-running Node fallback and must not be used on Vercel.

`BLOB_READ_WRITE_TOKEN` is strongly recommended for product images. If it is
not configured, uploads fall back to API-served database storage, which is
acceptable only for very small pilots.

The frontend compresses vendor product images below `700000` data-url
characters before upload. Keep `API_UPLOAD_MAX_DATA_URL_LENGTH` higher than
that value and `API_BODY_LIMIT_BYTES` high enough for the JSON request body.

## Run

```bash
npm run api:dev
```

For production, run the same entrypoint under a process manager or host command:

```bash
node api/server.mjs
```

## Current Persistence

The API uses Postgres for production data:

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

- Verify automated Postgres backups and restore procedure.
- Keep product images in Vercel Blob or another CDN-backed object store.
- Enable `SENTRY_DSN` or equivalent server monitoring.
- Add frontend error monitoring before broad public launch.
- Keep payments manual/prototype until gateway webhooks, reconciliation, and refunds are implemented.
