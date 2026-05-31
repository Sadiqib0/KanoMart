# Kano Mart API

This is the first real backend boundary for Kano Mart. The existing `src/backend`
modules are still browser-side prototype logic; this API is where production
business rules should move one module at a time.

## Run locally

```bash
npm run api:dev
```

Default URL:

```txt
http://localhost:8787
```

## Current endpoints

```txt
GET  /health
POST /auth/register
POST /auth/login
POST /auth/logout
GET  /me
GET  /notifications
PATCH /notifications/:id
GET  /vendor/application
GET  /vendor/products
POST /vendor/products
PATCH /vendor/products/:id
POST /vendor/uploads
GET  /vendor/orders
GET  /vendor/reviews
GET  /vendor/wallet
POST /vendor/payouts
GET  /products
GET  /products/:id
GET  /products/:id/reviews
GET  /categories
GET  /wishlist
POST /wishlist
DELETE /wishlist/:id
POST /reviews
GET  /cart
POST /cart/items
PATCH /cart/items/:id
DELETE /cart/items/:id
POST /checkout
GET  /orders
GET  /admin/users
GET  /admin/analytics
GET  /admin/orders
PATCH /admin/orders/:id
GET  /admin/payments
PATCH /admin/payments/:id
GET  /admin/payouts
PATCH /admin/payouts/:id
POST /admin/categories
GET  /admin/promotions
POST /admin/promotions
PATCH /admin/promotions/:id
GET  /admin/reviews
PATCH /admin/reviews/:id
GET  /admin/vendor-applications
PATCH /admin/vendor-applications/:id
GET  /admin/products
PATCH /admin/products/:id
```

`/auth/register` accepts:

```json
{
  "phone": "08012345678",
  "email": "aisha@example.com",
  "password": "password123",
  "firstName": "Aisha",
  "lastName": "Bello",
  "role": "customer",
  "deliveryAddress": "Kano",
  "preferredLanguage": "en"
}
```

For vendors, send `"role": "vendor"` plus optional `businessName`, `area`, and
`category`. The API creates a pending vendor application.

`PATCH /admin/vendor-applications/:id` accepts:

```json
{
  "status": "approved",
  "adminNote": "Business details verified."
}
```

Use `"rejected"` to reject an application. The decision updates both the vendor
application and the vendor user's `vendorStatus`.

`POST /vendor/products` requires an approved vendor session and accepts:

```json
{
  "name": {
    "en": "Black Jallabiya",
    "ha": "Jallabiya Baki"
  },
  "description": {
    "en": "Plain black jallabiya",
    "ha": "Jallabiya baki mai kyau"
  },
  "category": "fashion",
  "price": 15000,
  "quantityAvailable": 8,
  "area": "Fagge",
  "tags": ["jallabiya", "clothes"]
}
```

New vendor products start with `moderationStatus: "pending"`. Customers only
see products from `GET /products` when they are approved and active.

`POST /vendor/uploads` accepts a base64 data URL for PNG, JPEG, or WebP images.
This is a no-database/no-object-storage bridge for now; replace it with
Cloudflare R2 or S3-compatible storage before public launch.

`PATCH /admin/products/:id` accepts:

```json
{
  "status": "approved",
  "reviewNote": "Image and price verified."
}
```

Use `"hidden"` or `"rejected"` to remove a product from the public catalog.

`PATCH /vendor/products/:id` currently accepts:

```json
{
  "listingStatus": "out_of_stock"
}
```

Supported listing statuses are `active`, `out_of_stock`, and `taken_down`.

`POST /cart/items` accepts:

```json
{
  "productId": "product-id",
  "quantity": 2
}
```

`POST /checkout` accepts:

```json
{
  "deliveryOption": "delivery",
  "deliveryAddress": "Tarauni, Kano",
  "deliveryArea": "Tarauni",
  "paymentMethod": "manual_transfer"
}
```

The API calculates item totals, delivery fee, commission, vendor payout, payment
status, and inventory changes server-side. Client-supplied totals are ignored.
Send `promotionCode` to apply an active discount code.
Current payment statuses are:

- `card`, `ussd`, and `wallet`: `paid` through the prototype gateway.
- `manual_transfer`, `bank_transfer`, and `pay_on_delivery`: `pending`.

`PATCH /admin/payments/:id` accepts:

```json
{
  "status": "paid",
  "adminNote": "Transfer confirmed."
}
```

Supported statuses are `paid`, `failed`, and `refunded`. Marking a payment as
`paid` syncs the order payment status and creates wallet ledger records once.

`PATCH /admin/orders/:id` accepts:

```json
{
  "status": "assigned_to_rider",
  "deliveryPerson": "Kano Mart Rider"
}
```

Delivery orders must move through:

```txt
awaiting_confirmation -> preparing_order -> ready_for_pickup -> assigned_to_rider -> out_for_delivery -> delivered
```

Pickup orders skip rider statuses. Paid delivered orders release vendor payout
from pending to available.

Wishlist:

```txt
GET    /wishlist
POST   /wishlist
DELETE /wishlist/:id
```

Reviews require a delivered order for the product:

```json
{
  "productId": "product-id",
  "rating": 5,
  "comment": "Excellent quality."
}
```

Promotions are admin-managed and applied during checkout:

```json
{
  "title": {
    "en": "Eid fashion sale",
    "ha": "Rangwamen Eid"
  },
  "type": "discount_code",
  "discountPercent": 20,
  "code": "EID20",
  "category": "fashion"
}
```

Vendor payouts are manual for now:

```json
{
  "amount": 5000,
  "bankName": "Kano Bank",
  "accountNumber": "0123456789",
  "accountName": "Musa Garba"
}
```

Admins approve/reject payout requests manually through
`PATCH /admin/payouts/:id`.

## Security decisions already in place

- Passwords are hashed server-side with PBKDF2-SHA256.
- Sessions are created on the server and returned as an HttpOnly cookie.
- Cookies are marked `Secure` when `NODE_ENV=production`.
- `Authorization: Bearer <token>` is also accepted for API clients and tests.
- Admin routes check the authenticated user's role.
- Public user responses never include password hashes.
- CORS, request body limits, rate limits, and basic security headers are
  configurable through environment variables.

## Persistence

Set `API_DATA_FILE` to persist the current no-database store to disk:

```bash
API_DATA_FILE=./data/kano-mart-api.json npm run api:dev
```

This keeps data across restarts for demos and controlled pilots. PostgreSQL is
still the recommended public-launch database.

## Next slice

Online gateways are intentionally excluded for now. The next engineering step is
replacing the in-memory store with PostgreSQL using the contract in
`api/schema.sql`, then connecting the frontend to these API endpoints.
