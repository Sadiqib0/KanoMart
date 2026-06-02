// One-time script: run migrations, wipe all data, and seed a fresh admin account.
// Usage: DATABASE_URL=... node scripts/reset-and-seed-admin.mjs

import { neon } from "@neondatabase/serverless";
import { pbkdf2Sync, randomUUID } from "node:crypto";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("DATABASE_URL is not set"); process.exit(1); }

const sql = neon(DATABASE_URL);

const ADMIN_PHONE = "+2347015070004"; // normalised from 07015070004
const ADMIN_PASSWORD = "Sabiiboy10-";
const ITERATIONS = 210_000;

function hashPassword(password) {
  const salt = randomUUID().replace(/-/g, "");
  const hash = pbkdf2Sync(String(password), salt, ITERATIONS, 32, "sha256").toString("hex");
  return `pbkdf2_sha256$${ITERATIONS}$${salt}$${hash}`;
}

// ── Step 1: Create tables (if they don't exist) ───────────────────────────────
console.log("Running migrations...");

await sql.transaction([
  sql`CREATE TABLE IF NOT EXISTS users (
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
  sql`CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  sql`CREATE TABLE IF NOT EXISTS vendor_applications (
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
  sql`CREATE INDEX IF NOT EXISTS vendor_applications_status_idx ON vendor_applications(status)`,
  sql`CREATE TABLE IF NOT EXISTS products (
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
    listing_status TEXT NOT NULL DEFAULT 'active' CHECK (listing_status IN ('active','out_of_stock','taken_down')),
    moderation_status TEXT NOT NULL DEFAULT 'pending' CHECK (moderation_status IN ('pending','approved','hidden','rejected')),
    review_note TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  sql`CREATE INDEX IF NOT EXISTS products_vendor_user_id_idx ON products(vendor_user_id)`,
  sql`CREATE INDEX IF NOT EXISTS products_catalog_idx ON products(category, moderation_status, listing_status)`,
  sql`CREATE TABLE IF NOT EXISTS uploads (
    id UUID PRIMARY KEY,
    vendor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    data_url TEXT,
    blob_url TEXT,
    url TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  sql`CREATE TABLE IF NOT EXISTS cart_items (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, product_id)
  )`,
  sql`CREATE TABLE IF NOT EXISTS orders (
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
    payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','failed','refunded')),
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
  sql`CREATE INDEX IF NOT EXISTS orders_customer_idx ON orders(customer_user_id)`,
  sql`CREATE TABLE IF NOT EXISTS order_items (
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
  sql`CREATE INDEX IF NOT EXISTS order_items_vendor_idx ON order_items(vendor_user_id)`,
  sql`CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    reference TEXT NOT NULL UNIQUE,
    method TEXT NOT NULL,
    gateway TEXT NOT NULL DEFAULT 'manual',
    amount INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'NGN',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','refunded')),
    admin_note TEXT,
    verified_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    refunded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  sql`CREATE TABLE IF NOT EXISTS wallet_ledger (
    id UUID PRIMARY KEY,
    order_id TEXT,
    product_id UUID,
    vendor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    payout_request_id UUID,
    type TEXT NOT NULL CHECK (type IN ('vendor_pending_credit','platform_commission','vendor_withdrawal_debit')),
    status TEXT NOT NULL CHECK (status IN ('pending','available')),
    amount INTEGER NOT NULL,
    available_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  sql`CREATE INDEX IF NOT EXISTS wallet_ledger_vendor_idx ON wallet_ledger(vendor_user_id)`,
  sql`CREATE TABLE IF NOT EXISTS notifications (
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
  sql`CREATE INDEX IF NOT EXISTS notifications_recipient_idx ON notifications(recipient_user_id, read_at)`,
  sql`CREATE TABLE IF NOT EXISTS wishlists (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, product_id)
  )`,
  sql`CREATE TABLE IF NOT EXISTS reviews (
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
  sql`CREATE TABLE IF NOT EXISTS promotions (
    id UUID PRIMARY KEY,
    title_en TEXT NOT NULL,
    title_ha TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('discount_code','flash_sale','featured_product','featured_vendor','seasonal_campaign')),
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
  sql`CREATE TABLE IF NOT EXISTS payout_requests (
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
  sql`CREATE TABLE IF NOT EXISTS categories (
    key TEXT PRIMARY KEY,
    name_en TEXT NOT NULL,
    name_ha TEXT NOT NULL,
    search_terms TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  sql`CREATE TABLE IF NOT EXISTS product_views (
    product_id UUID PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
    views INTEGER NOT NULL DEFAULT 0,
    last_viewed_at TIMESTAMPTZ
  )`,
  sql`CREATE TABLE IF NOT EXISTS search_events (
    id UUID PRIMARY KEY,
    query TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  sql`CREATE INDEX IF NOT EXISTS search_events_query_idx ON search_events(query)`,
]);

console.log("Migrations done.");

// ── Step 2: Wipe all data ────────────────────────────────────────────────────
console.log("Wiping all data...");

await sql.transaction([
  sql`TRUNCATE search_events, product_views, payout_requests, promotions,
      reviews, wishlists, notifications, wallet_ledger, payments,
      order_items, orders, cart_items, uploads, products,
      vendor_applications, sessions, users, categories CASCADE`,
]);

console.log("All data cleared.");

// ── Step 3: Seed default categories ─────────────────────────────────────────
await sql.transaction([
  sql`INSERT INTO categories (key, name_en, name_ha, search_terms) VALUES
    ('food',       'Food',       'Abinci',             ARRAY['food','abinci','groceries']),
    ('fashion',    'Fashion',    'Kaya',               ARRAY['fashion','kaya','clothes']),
    ('children',   'Children',  'Yara',               ARRAY['children','yara','school']),
    ('essentials', 'Essentials','Kayan yau da kullum', ARRAY['essentials','daily'])
  ON CONFLICT (key) DO NOTHING`,
]);

console.log("Default categories seeded.");

// ── Step 4: Create admin user ────────────────────────────────────────────────
const adminId = randomUUID();
const passwordHash = hashPassword(ADMIN_PASSWORD);

await sql.transaction([
  sql`INSERT INTO users (id, phone, email, password_hash, first_name, last_name, display_name, role, preferred_language)
      VALUES (${adminId}, ${ADMIN_PHONE}, null, ${passwordHash}, 'Admin', '', 'Kano Mart Admin', 'admin', 'en')`,
]);

console.log(`\nAdmin created:`);
console.log(`  Phone:    07015070004`);
console.log(`  Password: ${ADMIN_PASSWORD}`);
console.log(`  Role:     admin`);
console.log(`\nDone. The database is fresh and ready.`);
