/**
 * Database migration runner.
 * Usage: DATABASE_URL=... node api/migrate.mjs
 *
 * Each statement is idempotent (IF NOT EXISTS / IF NOT EXISTS on indexes).
 * Add new migrations at the bottom — never edit existing ones.
 */

import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL is not set"); process.exit(1); }

const sql = postgres(url, { ssl: "require", max: 1 });

const migrations = [

  // ── 001: Core tables ────────────────────────────────────────────────────────

  `CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    phone TEXT NOT NULL UNIQUE,
    email TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL DEFAULT '',
    display_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('customer','vendor','admin')),
    delivery_address TEXT,
    preferred_language TEXT NOT NULL DEFAULT 'en' CHECK (preferred_language IN ('en','ha')),
    vendor_status TEXT CHECK (vendor_status IN ('pending','approved','rejected')),
    disabled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS vendor_applications (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    business_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    area TEXT NOT NULL,
    category TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
    admin_note TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY,
    vendor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vendor_name TEXT NOT NULL,
    name_en TEXT NOT NULL,
    name_ha TEXT NOT NULL,
    description_en TEXT NOT NULL DEFAULT '',
    description_ha TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL,
    price INTEGER NOT NULL CHECK (price > 0),
    currency TEXT NOT NULL DEFAULT 'NGN',
    quantity_available INTEGER NOT NULL DEFAULT 0 CHECK (quantity_available >= 0),
    area TEXT NOT NULL DEFAULT 'Kano',
    image_url TEXT,
    tags TEXT[] NOT NULL DEFAULT '{}',
    listing_status TEXT NOT NULL DEFAULT 'active'
      CHECK (listing_status IN ('active','out_of_stock','taken_down')),
    moderation_status TEXT NOT NULL DEFAULT 'pending'
      CHECK (moderation_status IN ('pending','approved','hidden','rejected')),
    review_note TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS uploads (
    id UUID PRIMARY KEY,
    vendor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    data_url TEXT,
    blob_url TEXT,
    url TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  // Safe schema evolution for existing deployments
  `ALTER TABLE uploads ADD COLUMN IF NOT EXISTS blob_url TEXT`,
  `ALTER TABLE uploads ALTER COLUMN data_url DROP NOT NULL`,

  `CREATE TABLE IF NOT EXISTS cart_items (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, product_id)
  )`,

  `CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    customer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    delivery_option TEXT NOT NULL CHECK (delivery_option IN ('delivery','pickup')),
    delivery_address TEXT,
    delivery_area TEXT NOT NULL,
    delivery_fee INTEGER NOT NULL DEFAULT 0,
    delivery_person TEXT,
    payment_method TEXT NOT NULL,
    payment_reference TEXT NOT NULL UNIQUE,
    payment_status TEXT NOT NULL DEFAULT 'pending'
      CHECK (payment_status IN ('pending','paid','failed','refunded')),
    payment_id UUID,
    items_subtotal INTEGER NOT NULL,
    subtotal INTEGER NOT NULL,
    commission_total INTEGER NOT NULL DEFAULT 0,
    vendor_payout_total INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'awaiting_confirmation' CHECK (
      status IN ('awaiting_confirmation','preparing_order','ready_for_pickup',
                 'assigned_to_rider','out_for_delivery','delivered','cancelled')
    ),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    vendor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    vendor_name TEXT NOT NULL DEFAULT '',
    name_en TEXT NOT NULL,
    name_ha TEXT NOT NULL,
    unit_price INTEGER NOT NULL,
    original_unit_price INTEGER NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    line_total INTEGER NOT NULL,
    discount_amount INTEGER NOT NULL DEFAULT 0,
    promotion_id UUID,
    commission_rate NUMERIC(5,4) NOT NULL DEFAULT 0.1,
    commission_amount INTEGER NOT NULL DEFAULT 0,
    vendor_payout INTEGER NOT NULL DEFAULT 0
  )`,

  `CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    reference TEXT NOT NULL UNIQUE,
    method TEXT NOT NULL,
    gateway TEXT NOT NULL DEFAULT 'manual',
    amount INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'NGN',
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending','paid','failed','refunded')),
    admin_note TEXT,
    verified_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    refunded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS wallet_ledger (
    id UUID PRIMARY KEY,
    order_id TEXT,
    product_id UUID,
    vendor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    payout_request_id UUID,
    type TEXT NOT NULL
      CHECK (type IN ('vendor_pending_credit','platform_commission','vendor_withdrawal_debit')),
    status TEXT NOT NULL CHECK (status IN ('pending','available')),
    amount INTEGER NOT NULL,
    available_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY,
    audience TEXT NOT NULL CHECK (audience IN ('customer','vendor','admin')),
    recipient_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL,
    order_id TEXT,
    product_id UUID,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS wishlists (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, product_id)
  )`,

  `CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    vendor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    customer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reviewer_name TEXT NOT NULL DEFAULT '',
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT NOT NULL,
    hidden BOOLEAN NOT NULL DEFAULT false,
    admin_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS promotions (
    id UUID PRIMARY KEY,
    title_en TEXT NOT NULL,
    title_ha TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN
      ('discount_code','flash_sale','featured_product','featured_vendor','seasonal_campaign')),
    discount_percent INTEGER NOT NULL CHECK (discount_percent BETWEEN 1 AND 90),
    code TEXT,
    product_id UUID,
    vendor_user_id UUID,
    category TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS payout_requests (
    id UUID PRIMARY KEY,
    vendor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL CHECK (amount > 0),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
    bank_name TEXT NOT NULL DEFAULT '',
    account_number TEXT NOT NULL DEFAULT '',
    account_name TEXT NOT NULL DEFAULT '',
    admin_note TEXT,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at TIMESTAMPTZ
  )`,

  `CREATE TABLE IF NOT EXISTS categories (
    key TEXT PRIMARY KEY,
    name_en TEXT NOT NULL,
    name_ha TEXT NOT NULL,
    search_terms TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS product_views (
    product_id UUID PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
    views INTEGER NOT NULL DEFAULT 0,
    last_viewed_at TIMESTAMPTZ
  )`,

  `CREATE TABLE IF NOT EXISTS search_events (
    id UUID PRIMARY KEY,
    query TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  // ── 002: Original baseline indexes ──────────────────────────────────────────

  `CREATE INDEX IF NOT EXISTS vendor_applications_status_idx   ON vendor_applications(status)`,
  `CREATE INDEX IF NOT EXISTS products_vendor_user_id_idx      ON products(vendor_user_id)`,
  `CREATE INDEX IF NOT EXISTS products_catalog_idx             ON products(category, moderation_status, listing_status)`,
  `CREATE INDEX IF NOT EXISTS orders_customer_idx              ON orders(customer_user_id)`,
  `CREATE INDEX IF NOT EXISTS order_items_vendor_idx           ON order_items(vendor_user_id)`,
  `CREATE INDEX IF NOT EXISTS wallet_ledger_vendor_idx         ON wallet_ledger(vendor_user_id)`,
  `CREATE INDEX IF NOT EXISTS notifications_recipient_idx      ON notifications(recipient_user_id, read_at)`,
  `CREATE INDEX IF NOT EXISTS search_events_query_idx          ON search_events(query)`,

  // ── 003: Performance indexes (added after scale audit) ───────────────────────

  // Fast ORDER BY on all list endpoints
  `CREATE INDEX IF NOT EXISTS products_created_at_idx          ON products(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS orders_created_at_idx            ON orders(created_at DESC)`,

  // JOIN support — stops Postgres from doing seq scans when joining order_items to orders
  `CREATE INDEX IF NOT EXISTS order_items_order_id_idx         ON order_items(order_id)`,
  `CREATE INDEX IF NOT EXISTS payments_order_id_idx            ON payments(order_id)`,
  `CREATE INDEX IF NOT EXISTS wallet_ledger_order_id_idx       ON wallet_ledger(order_id)`,

  // dbNotifyAdmins: SELECT id FROM users WHERE role = 'admin'
  `CREATE INDEX IF NOT EXISTS users_role_idx                   ON users(role)`,

  // dbCustomerHasDeliveredOrder: WHERE o.status = 'delivered'
  `CREATE INDEX IF NOT EXISTS orders_status_idx                ON orders(status)`,

  // ── 004: Full-text / trigram search ─────────────────────────────────────────
  // Enables ILIKE '%query%' to use a GIN index instead of a seq scan.
  // pg_trgm must be enabled first; the extension creation is safe to run repeatedly.

  `CREATE EXTENSION IF NOT EXISTS pg_trgm`,
  `CREATE INDEX IF NOT EXISTS products_name_en_trgm_idx        ON products USING GIN (name_en gin_trgm_ops)`,
  `CREATE INDEX IF NOT EXISTS products_name_ha_trgm_idx        ON products USING GIN (name_ha gin_trgm_ops)`,

  // ── 005: Safe column back-fills (idempotent for existing deployments) ────────
  // These guard against databases created before the current CREATE TABLE
  // definitions added these columns.  ADD COLUMN IF NOT EXISTS is a no-op when
  // the column already exists, so running migrate.mjs twice is safe.

  `ALTER TABLE products      ADD COLUMN IF NOT EXISTS vendor_name TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE orders        ADD COLUMN IF NOT EXISTS delivery_person TEXT`,
  `ALTER TABLE orders        ADD COLUMN IF NOT EXISTS payment_id UUID`,
  `ALTER TABLE reviews       ADD COLUMN IF NOT EXISTS reviewer_name TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE wallet_ledger ADD COLUMN IF NOT EXISTS payout_request_id UUID`,
  `ALTER TABLE order_items   ADD COLUMN IF NOT EXISTS vendor_name TEXT NOT NULL DEFAULT ''`,

  // ── 006: Seed default categories ────────────────────────────────────────────

  `INSERT INTO categories (key, name_en, name_ha, search_terms) VALUES
    ('food',       'Food',       'Abinci',             ARRAY['food','abinci','groceries','shinkafa']),
    ('fashion',    'Fashion',    'Kaya',               ARRAY['fashion','kaya','clothes','yaduka']),
    ('children',   'Children',  'Yara',               ARRAY['children','yara','school','makaranta']),
    ('essentials', 'Essentials','Kayan yau da kullum', ARRAY['essentials','daily','kayan masarufi'])
  ON CONFLICT (key) DO NOTHING`,
];

let passed = 0;
let failed = 0;

for (const stmt of migrations) {
  const preview = stmt.replace(/\s+/g, " ").trim().slice(0, 72);
  try {
    await sql.unsafe(stmt);
    console.log(`  ✓  ${preview}`);
    passed++;
  } catch (err) {
    console.error(`  ✗  ${preview}`);
    console.error(`     ${err.message}`);
    failed++;
  }
}

await sql.end();
console.log(`\nMigration complete — ${passed} ok, ${failed} failed.`);
if (failed > 0) process.exit(1);
