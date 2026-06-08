import { createHash, pbkdf2, pbkdf2Sync, randomUUID, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
const pbkdf2Async = promisify(pbkdf2);
import { readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import postgres from "postgres";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";
import { put as blobPut } from "@vercel/blob";
import {
  sendEmail,
  orderConfirmationEmail,
  orderStatusEmail,
  paymentStatusEmail,
  vendorApprovalEmail,
  vendorNewOrderEmail,
  payoutDecisionEmail,
} from "./email.mjs";

// ── Error monitoring (Sentry HTTP API — no package needed) ────────────────────
async function captureException(error, context = {}) {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn || (error?.status && error.status < 500)) return;
  try {
    const u = new URL(dsn);
    const projectId = u.pathname.replace(/^\//, "");
    const endpoint = `${u.protocol}//${u.host}/api/${projectId}/store/`;
    const key = u.username;
    const frames = (error?.stack ?? "")
      .split("\n")
      .slice(1, 8)
      .map((line) => {
        const m = line.trim().match(/^at (.+) \((.+):(\d+):(\d+)\)$/) ??
                  line.trim().match(/^at (.+):(\d+):(\d+)$/);
        return m ? { function: m[1], filename: m[2] ?? m[1], lineno: Number(m[3] ?? m[2]), colno: Number(m[4] ?? m[3]) } : { filename: line.trim() };
      });
    await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${key}, sentry_timestamp=${Math.floor(Date.now() / 1000)}`,
      },
      body: JSON.stringify({
        event_id: randomUUID().replace(/-/g, ""),
        timestamp: new Date().toISOString(),
        platform: "node",
        level: "error",
        environment: process.env.NODE_ENV ?? "production",
        exception: {
          values: [{
            type: error?.name ?? "Error",
            value: error?.message ?? String(error),
            stacktrace: frames.length ? { frames: frames.reverse() } : undefined,
          }],
        },
        extra: context,
        tags: { service: "kano-mart-api" },
      }),
    });
  } catch {
    // Never fail because monitoring failed
  }
}

const DEFAULT_ADMIN_PHONE = "07015070004";
const SESSION_COOKIE = "kano_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;
const DEFAULT_BODY_LIMIT_BYTES = 1_000_000;

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "x-frame-options": "DENY",
};

// ── DB ──────────────────────────────────────────────────────────────────────
let _sql;
function db() {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      // Fail hard — never silently fall back to in-memory storage in production.
      throw new Error(
        "DATABASE_URL is not set. " +
        "Set it in your Vercel project environment variables or local .env file. " +
        "The server cannot start without a database connection."
      );
    }
    _sql = postgres(url, {
      ssl: "require",
      // Vercel Fluid Compute can serve multiple concurrent requests on one instance,
      // so a small pool (not 1) is correct. Neon's pooler endpoint handles the rest.
      max: Number(process.env.DB_POOL_MAX ?? 5),
      idle_timeout: 20,       // close idle connections after 20 s
      connect_timeout: 10,    // fail fast rather than hanging on cold-start
      connection: {
        // Kill any query that runs longer than 30 s — prevents request pile-ups
        // when a query plan degrades or a table lock is held.
        statement_timeout: Number(process.env.DB_STATEMENT_TIMEOUT_MS ?? 30_000),
      },
    });
  }
  return _sql;
}

// Row → camelCase JS object helpers
function fromRow(r) {
  if (!r) return null;
  const out = {};
  for (const [k, v] of Object.entries(r)) {
    out[k.replace(/_([a-z])/g, (_, c) => c.toUpperCase())] = v;
  }
  return out;
}
const fromRows = (rs) => rs.map(fromRow);

function userFromRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    phone: r.phone,
    email: r.email ?? undefined,
    passwordHash: r.password_hash,
    firstName: r.first_name,
    lastName: r.last_name,
    name: r.display_name,
    role: r.role,
    deliveryAddress: r.delivery_address ?? undefined,
    preferredLanguage: r.preferred_language,
    vendorStatus: r.vendor_status ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function productFromRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    vendorUserId: r.vendor_user_id,
    vendorName: r.vendor_name,
    vendorPhone: r.vendor_phone ?? undefined,
    name: { en: r.name_en, ha: r.name_ha },
    description: { en: r.description_en ?? "", ha: r.description_ha ?? "" },
    category: r.category,
    price: r.price,
    currency: r.currency,
    quantityAvailable: r.quantity_available,
    area: r.area,
    imageUrl: r.image_url ?? undefined,
    tags: r.tags ?? [],
    listingStatus: r.listing_status,
    moderationStatus: r.moderation_status,
    reviewNote: r.review_note ?? undefined,
    reviewedAt: r.reviewed_at ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function orderItemFromRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    productId: r.product_id,
    vendorUserId: r.vendor_user_id,
    vendorName: r.vendor_name,
    name: { en: r.name_en, ha: r.name_ha },
    unitPrice: r.unit_price,
    originalUnitPrice: r.original_unit_price,
    quantity: r.quantity,
    lineTotal: r.line_total,
    discountAmount: r.discount_amount,
    promotionId: r.promotion_id ?? undefined,
    commissionRate: parseFloat(r.commission_rate),
    commissionAmount: r.commission_amount,
    vendorPayout: r.vendor_payout,
  };
}

function orderFromRow(r, items, payment) {
  if (!r) return null;
  return {
    id: r.id,
    customerUserId: r.customer_user_id,
    customerName: r.customer_name,
    customerPhone: r.customer_phone,
    items: items ?? [],
    deliveryOption: r.delivery_option,
    deliveryAddress: r.delivery_address ?? undefined,
    deliveryArea: r.delivery_area,
    deliveryFee: r.delivery_fee,
    deliveryPerson: r.delivery_person ?? undefined,
    paymentMethod: r.payment_method,
    paymentReference: r.payment_reference,
    paymentStatus: r.payment_status,
    paymentId: r.payment_id ?? undefined,
    subtotal: r.subtotal,
    itemsSubtotal: r.items_subtotal,
    commissionTotal: r.commission_total,
    vendorPayoutTotal: r.vendor_payout_total,
    status: r.status,
    payment: payment ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function paymentFromRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    orderId: r.order_id,
    reference: r.reference,
    method: r.method,
    gateway: r.gateway,
    amount: r.amount,
    currency: r.currency,
    status: r.status,
    adminNote: r.admin_note ?? undefined,
    verifiedAt: r.verified_at ?? undefined,
    failedAt: r.failed_at ?? undefined,
    refundedAt: r.refunded_at ?? undefined,
    createdAt: r.created_at,
  };
}

// ── DB query helpers ──────────────────────────────────────────────────────────

async function dbGetUserByIdentifier(identifier) {
  const sql = db();
  const phone = normalizePhone(identifier);
  const email = normalizeEmail(identifier);
  const [r] = await sql`
    SELECT * FROM users WHERE phone = ${phone} OR (email IS NOT NULL AND email = ${email || null})
    LIMIT 1
  `;
  return userFromRow(r);
}

async function dbGetUserById(id) {
  const sql = db();
  const [r] = await sql`SELECT * FROM users WHERE id = ${id} LIMIT 1`;
  return userFromRow(r);
}

async function dbCreateUser(user) {
  const sql = db();
  const [r] = await sql`
    INSERT INTO users (id, phone, email, password_hash, first_name, last_name, display_name,
      role, delivery_address, preferred_language, vendor_status)
    VALUES (${user.id}, ${user.phone}, ${user.email ?? null}, ${user.passwordHash},
      ${user.firstName}, ${user.lastName}, ${user.name}, ${user.role},
      ${user.deliveryAddress ?? null}, ${user.preferredLanguage}, ${user.vendorStatus ?? null})
    RETURNING *
  `;
  return userFromRow(r);
}

async function dbUpdateUser(id, fields) {
  const sql = db();
  const [r] = await sql`
    UPDATE users SET
      display_name = COALESCE(${fields.name ?? null}, display_name),
      first_name = COALESCE(${fields.firstName ?? null}, first_name),
      last_name = COALESCE(${fields.lastName ?? null}, last_name),
      email = COALESCE(${fields.email ?? null}, email),
      delivery_address = COALESCE(${fields.deliveryAddress ?? null}, delivery_address),
      preferred_language = COALESCE(${fields.preferredLanguage ?? null}, preferred_language),
      vendor_status = COALESCE(${fields.vendorStatus ?? null}, vendor_status),
      updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `;
  return userFromRow(r);
}

async function dbGetAllUsers({ limit = 100, offset = 0 } = {}) {
  const sql = db();
  const rs = await sql`SELECT * FROM users ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
  return rs.map(userFromRow);
}

async function dbCreateSession(userId) {
  const sql = db();
  const token = randomUUID();
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000).toISOString();
  await sql`
    INSERT INTO sessions (id, user_id, token_hash, expires_at)
    VALUES (${randomUUID()}, ${userId}, ${tokenHash}, ${expiresAt})
  `;
  return { token, expiresAt };
}

async function dbGetSessionUser(token) {
  if (!token) return null;
  const sql = db();
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const [r] = await sql`
    SELECT u.* FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${tokenHash} AND s.expires_at > now() AND u.disabled_at IS NULL
    LIMIT 1
  `;
  return userFromRow(r);
}

async function dbDeleteSession(token) {
  if (!token) return;
  const sql = db();
  const tokenHash = createHash("sha256").update(token).digest("hex");
  await sql`DELETE FROM sessions WHERE token_hash = ${tokenHash}`;
}


async function dbCreateVendorApplication(app) {
  const sql = db();
  const [r] = await sql`
    INSERT INTO vendor_applications (id, user_id, business_name, phone, area, category, status)
    VALUES (${app.id}, ${app.userId}, ${app.businessName}, ${app.phone},
            ${app.area}, ${app.category}, 'pending')
    ON CONFLICT (user_id) DO UPDATE SET
      business_name = EXCLUDED.business_name, phone = EXCLUDED.phone,
      area = EXCLUDED.area, category = EXCLUDED.category, updated_at = now()
    RETURNING *
  `;
  return fromRow(r);
}

async function dbGetVendorApplicationById(appId) {
  const sql = db();
  const [r] = await sql`
    SELECT va.*, u.display_name as user_name, u.phone as user_phone, u.email as user_email,
           u.role as user_role, u.vendor_status as user_vendor_status
    FROM vendor_applications va
    JOIN users u ON u.id = va.user_id
    WHERE va.id = ${appId} LIMIT 1
  `;
  return r ? r : null;
}

async function dbGetVendorApplicationByUserId(userId) {
  const sql = db();
  const [r] = await sql`
    SELECT va.*, u.display_name as user_name, u.phone as user_phone, u.email as user_email,
           u.role as user_role, u.vendor_status as user_vendor_status
    FROM vendor_applications va
    JOIN users u ON u.id = va.user_id
    WHERE va.user_id = ${userId} LIMIT 1
  `;
  return r ? r : null;
}

async function dbGetAllVendorApplications(status, { limit = 100, offset = 0 } = {}) {
  const sql = db();
  const rs = status
    ? await sql`SELECT va.*, u.display_name as user_name, u.phone as user_phone, u.email as user_email,
                       u.role as user_role, u.vendor_status as user_vendor_status
                FROM vendor_applications va JOIN users u ON u.id = va.user_id
                WHERE va.status = ${status}
                ORDER BY va.created_at DESC LIMIT ${limit} OFFSET ${offset}`
    : await sql`SELECT va.*, u.display_name as user_name, u.phone as user_phone, u.email as user_email,
                       u.role as user_role, u.vendor_status as user_vendor_status
                FROM vendor_applications va JOIN users u ON u.id = va.user_id
                ORDER BY va.created_at DESC LIMIT ${limit} OFFSET ${offset}`;
  return rs;
}

async function dbUpdateVendorApplication(appId, userId, status, adminNote) {
  const sql = db();
  await sql`
    UPDATE vendor_applications SET status = ${status},
      admin_note = ${adminNote ?? null}, reviewed_at = now(), updated_at = now()
    WHERE id = ${appId}
  `;
  await sql`UPDATE users SET vendor_status = ${status}, updated_at = now() WHERE id = ${userId}`;
}

async function dbGetProductById(productId, includeVendorPhone) {
  const sql = db();
  if (includeVendorPhone) {
    const [r] = await sql`
      SELECT p.*, u.phone as vendor_phone FROM products p
      JOIN users u ON u.id = p.vendor_user_id
      WHERE p.id = ${productId} LIMIT 1
    `;
    return productFromRow(r);
  }
  const [r] = await sql`SELECT * FROM products WHERE id = ${productId} LIMIT 1`;
  return productFromRow(r);
}

async function dbGetProductsForVendor(vendorUserId, { limit = 100, offset = 0 } = {}) {
  const sql = db();
  const rs = await sql`
    SELECT p.*, u.phone as vendor_phone FROM products p
    JOIN users u ON u.id = p.vendor_user_id
    WHERE p.vendor_user_id = ${vendorUserId}
    ORDER BY p.created_at DESC LIMIT ${limit} OFFSET ${offset}
  `;
  return rs.map(productFromRow);
}

async function dbGetPublicCatalog(category, query, { limit = 60, offset = 0 } = {}) {
  const sql = db();
  // Use ILIKE so pg_trgm GIN indexes apply (LOWER(col) LIKE was preventing index use).
  const q = query ? `%${query}%` : null;
  let rs;
  if (category && q) {
    rs = await sql`
      SELECT p.*, u.phone as vendor_phone FROM products p
      JOIN users u ON u.id = p.vendor_user_id
      WHERE p.moderation_status = 'approved' AND p.listing_status = 'active'
        AND p.category = ${category}
        AND (p.name_en ILIKE ${q} OR p.name_ha ILIKE ${q}
             OR EXISTS (SELECT 1 FROM unnest(p.tags) t WHERE t ILIKE ${q}))
      ORDER BY p.created_at DESC LIMIT ${limit} OFFSET ${offset}
    `;
  } else if (category) {
    rs = await sql`
      SELECT p.*, u.phone as vendor_phone FROM products p
      JOIN users u ON u.id = p.vendor_user_id
      WHERE p.moderation_status = 'approved' AND p.listing_status = 'active'
        AND p.category = ${category}
      ORDER BY p.created_at DESC LIMIT ${limit} OFFSET ${offset}
    `;
  } else if (q) {
    rs = await sql`
      SELECT p.*, u.phone as vendor_phone FROM products p
      JOIN users u ON u.id = p.vendor_user_id
      WHERE p.moderation_status = 'approved' AND p.listing_status = 'active'
        AND (p.name_en ILIKE ${q} OR p.name_ha ILIKE ${q}
             OR EXISTS (SELECT 1 FROM unnest(p.tags) t WHERE t ILIKE ${q}))
      ORDER BY p.created_at DESC LIMIT ${limit} OFFSET ${offset}
    `;
  } else {
    rs = await sql`
      SELECT p.*, u.phone as vendor_phone FROM products p
      JOIN users u ON u.id = p.vendor_user_id
      WHERE p.moderation_status = 'approved' AND p.listing_status = 'active'
      ORDER BY p.created_at DESC LIMIT ${limit} OFFSET ${offset}
    `;
  }
  return rs.map(productFromRow);
}

async function dbGetAllProducts(status, { limit = 100, offset = 0 } = {}) {
  const sql = db();
  const rs = status
    ? await sql`SELECT p.*, u.phone as vendor_phone FROM products p
                JOIN users u ON u.id = p.vendor_user_id
                WHERE p.moderation_status = ${status}
                ORDER BY p.created_at DESC LIMIT ${limit} OFFSET ${offset}`
    : await sql`SELECT p.*, u.phone as vendor_phone FROM products p
                JOIN users u ON u.id = p.vendor_user_id
                ORDER BY p.created_at DESC LIMIT ${limit} OFFSET ${offset}`;
  return rs.map(productFromRow);
}

async function dbCreateProduct(vendorId, vendorName, input) {
  const sql = db();
  const id = randomUUID();
  const [r] = await sql`
    INSERT INTO products (id, vendor_user_id, vendor_name, name_en, name_ha,
      description_en, description_ha, category, price, currency, quantity_available,
      area, image_url, tags, listing_status, moderation_status)
    VALUES (${id}, ${vendorId}, ${vendorName},
      ${input.name.en}, ${input.name.ha},
      ${input.description.en}, ${input.description.ha},
      ${input.category}, ${input.price}, ${input.currency},
      ${input.quantityAvailable}, ${input.area},
      ${input.imageUrl ?? null}, ${input.tags},
      ${input.quantityAvailable > 0 ? 'active' : 'out_of_stock'}, 'pending')
    RETURNING *
  `;
  return productFromRow(r);
}

async function dbUpdateProductListing(productId, listingStatus) {
  const sql = db();
  const [r] = await sql`
    UPDATE products SET listing_status = ${listingStatus}, updated_at = now()
    WHERE id = ${productId} RETURNING *
  `;
  return productFromRow(r);
}

async function dbUpdateProductModeration(productId, status, reviewNote) {
  const sql = db();
  const [r] = await sql`
    UPDATE products SET moderation_status = ${status},
      review_note = ${reviewNote ?? null}, reviewed_at = now(), updated_at = now()
    WHERE id = ${productId} RETURNING *
  `;
  return productFromRow(r);
}

// Returns false if stock was insufficient (concurrent checkout took the last unit).
async function dbDecrementProductQuantity(productId, qty) {
  const sql = db();
  const [r] = await sql`
    UPDATE products SET
      quantity_available = quantity_available - ${qty},
      listing_status = CASE WHEN quantity_available - ${qty} <= 0 THEN 'out_of_stock' ELSE listing_status END,
      updated_at = now()
    WHERE id = ${productId} AND quantity_available >= ${qty}
    RETURNING id
  `;
  return !!r; // false → stock was insufficient at the moment of update
}

async function dbGetCart(userId) {
  const sql = db();
  const rs = await sql`
    SELECT ci.*, p.name_en, p.name_ha, p.price, p.currency, p.image_url,
           p.listing_status, p.moderation_status, p.quantity_available,
           p.vendor_user_id, p.vendor_name, p.category, p.area, p.tags,
           p.description_en, p.description_ha, p.review_note, p.reviewed_at,
           u.phone as vendor_phone
    FROM cart_items ci
    JOIN products p ON p.id = ci.product_id
    JOIN users u ON u.id = p.vendor_user_id
    WHERE ci.user_id = ${userId}
    ORDER BY ci.added_at DESC
  `;
  return rs;
}

async function dbUpsertCartItem(userId, productId, quantity) {
  const sql = db();
  await sql`
    INSERT INTO cart_items (user_id, product_id, quantity)
    VALUES (${userId}, ${productId}, ${quantity})
    ON CONFLICT (user_id, product_id) DO UPDATE SET quantity = ${quantity}, updated_at = now()
  `;
}

async function dbDeleteCartItem(userId, productId) {
  const sql = db();
  await sql`DELETE FROM cart_items WHERE user_id = ${userId} AND product_id = ${productId}`;
}

async function dbClearCart(userId) {
  const sql = db();
  await sql`DELETE FROM cart_items WHERE user_id = ${userId}`;
}

async function dbCreateOrderWithItems(order, items, payment) {
  // All writes wrapped in a single transaction — a mid-flight failure rolls everything back.
  const sql = db();
  await sql.begin(async (tx) => {
    await tx`
      INSERT INTO orders (id, customer_user_id, customer_name, customer_phone,
        delivery_option, delivery_address, delivery_area, delivery_fee,
        payment_method, payment_reference, payment_status, payment_id,
        items_subtotal, subtotal, commission_total, vendor_payout_total, status)
      VALUES (${order.id}, ${order.customerUserId}, ${order.customerName}, ${order.customerPhone},
        ${order.deliveryOption}, ${order.deliveryAddress ?? null}, ${order.deliveryArea},
        ${order.deliveryFee}, ${order.paymentMethod}, ${order.paymentReference},
        ${order.paymentStatus}, ${payment.id},
        ${order.itemsSubtotal}, ${order.subtotal}, ${order.commissionTotal}, ${order.vendorPayoutTotal},
        'awaiting_confirmation')
    `;
    // Bulk-insert all order items in one round-trip
    if (items.length) {
      const itemValues = items.map((item) => ({
        id: randomUUID(), order_id: order.id, product_id: item.productId,
        vendor_user_id: item.vendorUserId, vendor_name: item.vendorName ?? "",
        name_en: item.name.en, name_ha: item.name.ha,
        unit_price: item.unitPrice, original_unit_price: item.originalUnitPrice,
        quantity: item.quantity, line_total: item.lineTotal,
        discount_amount: item.discountAmount, promotion_id: item.promotionId ?? null,
        commission_rate: item.commissionRate, commission_amount: item.commissionAmount,
        vendor_payout: item.vendorPayout,
      }));
      await tx`INSERT INTO order_items ${tx(itemValues)}`;
    }
    await tx`
      INSERT INTO payments (id, order_id, reference, method, gateway, amount, currency, status, verified_at)
      VALUES (${payment.id}, ${payment.orderId}, ${payment.reference}, ${payment.method},
        ${payment.gateway}, ${payment.amount}, ${payment.currency}, ${payment.status},
        ${payment.verifiedAt ?? null})
    `;
    if (order.paymentStatus === "paid") {
      await dbCreateLedgerForOrder(order.id, items, tx);
    }
  });
}

async function dbCreateLedgerForOrder(orderId, items, tx) {
  const sql = tx ?? db();
  if (!items.length) return;
  const ledgerRows = items.flatMap((item) => [
    { id: randomUUID(), order_id: orderId, product_id: item.productId,
      vendor_user_id: item.vendorUserId, type: "vendor_pending_credit",
      status: "pending", amount: item.vendorPayout },
    { id: randomUUID(), order_id: orderId, product_id: item.productId,
      vendor_user_id: item.vendorUserId, type: "platform_commission",
      status: "available", amount: item.commissionAmount },
  ]);
  await sql`INSERT INTO wallet_ledger ${sql(ledgerRows)}`;
}

// ── Shared helper: hydrate orders from flat JOIN rows ────────────────────────
// Each row has o.* columns plus oi.* prefixed with "oi_" and p.* prefixed "pay_".
// A single SQL query replaces the N+1 loop (1 query vs 3N queries at scale).
function buildOrdersFromJoinRows(rows) {
  const orderMap = new Map();
  for (const r of rows) {
    if (!orderMap.has(r.id)) {
      orderMap.set(r.id, {
        row: r,
        items: [],
        paymentRow: r.pay_id ? {
          id: r.pay_id, order_id: r.id, reference: r.pay_reference,
          method: r.pay_method, gateway: r.pay_gateway, amount: r.pay_amount,
          currency: r.pay_currency, status: r.pay_status,
          admin_note: r.pay_admin_note, verified_at: r.pay_verified_at,
          failed_at: r.pay_failed_at, refunded_at: r.pay_refunded_at,
          created_at: r.pay_created_at,
        } : null,
      });
    }
    if (r.oi_id) {
      orderMap.get(r.id).items.push({
        id: r.oi_id, order_id: r.id, product_id: r.oi_product_id,
        vendor_user_id: r.oi_vendor_user_id, vendor_name: r.oi_vendor_name,
        name_en: r.oi_name_en, name_ha: r.oi_name_ha,
        unit_price: r.oi_unit_price, original_unit_price: r.oi_original_unit_price,
        quantity: r.oi_quantity, line_total: r.oi_line_total,
        discount_amount: r.oi_discount_amount, promotion_id: r.oi_promotion_id,
        commission_rate: r.oi_commission_rate, commission_amount: r.oi_commission_amount,
        vendor_payout: r.oi_vendor_payout,
      });
    }
  }
  return [...orderMap.values()].map(({ row, items, paymentRow }) =>
    orderFromRow(row, items.map(orderItemFromRow), paymentFromRow(paymentRow))
  );
}

async function dbGetOrderWithItems(orderId) {
  const sql = db();
  const rows = await sql`
    SELECT o.*,
      oi.id            AS oi_id,
      oi.product_id    AS oi_product_id,
      oi.vendor_user_id AS oi_vendor_user_id,
      oi.vendor_name   AS oi_vendor_name,
      oi.name_en       AS oi_name_en,
      oi.name_ha       AS oi_name_ha,
      oi.unit_price    AS oi_unit_price,
      oi.original_unit_price AS oi_original_unit_price,
      oi.quantity      AS oi_quantity,
      oi.line_total    AS oi_line_total,
      oi.discount_amount AS oi_discount_amount,
      oi.promotion_id  AS oi_promotion_id,
      oi.commission_rate AS oi_commission_rate,
      oi.commission_amount AS oi_commission_amount,
      oi.vendor_payout AS oi_vendor_payout,
      p.id             AS pay_id,
      p.reference      AS pay_reference,
      p.method         AS pay_method,
      p.gateway        AS pay_gateway,
      p.amount         AS pay_amount,
      p.currency       AS pay_currency,
      p.status         AS pay_status,
      p.admin_note     AS pay_admin_note,
      p.verified_at    AS pay_verified_at,
      p.failed_at      AS pay_failed_at,
      p.refunded_at    AS pay_refunded_at,
      p.created_at     AS pay_created_at
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id = o.id
    LEFT JOIN payments p ON p.id = o.payment_id
    WHERE o.id = ${orderId}
  `;
  if (!rows.length) return null;
  return buildOrdersFromJoinRows(rows)[0] ?? null;
}

async function dbGetOrdersForCustomer(userId, { limit = 50, offset = 0 } = {}) {
  const sql = db();
  const rows = await sql`
    SELECT o.*,
      oi.id            AS oi_id,
      oi.product_id    AS oi_product_id,
      oi.vendor_user_id AS oi_vendor_user_id,
      oi.vendor_name   AS oi_vendor_name,
      oi.name_en       AS oi_name_en,
      oi.name_ha       AS oi_name_ha,
      oi.unit_price    AS oi_unit_price,
      oi.original_unit_price AS oi_original_unit_price,
      oi.quantity      AS oi_quantity,
      oi.line_total    AS oi_line_total,
      oi.discount_amount AS oi_discount_amount,
      oi.promotion_id  AS oi_promotion_id,
      oi.commission_rate AS oi_commission_rate,
      oi.commission_amount AS oi_commission_amount,
      oi.vendor_payout AS oi_vendor_payout,
      p.id             AS pay_id,
      p.reference      AS pay_reference,
      p.method         AS pay_method,
      p.gateway        AS pay_gateway,
      p.amount         AS pay_amount,
      p.currency       AS pay_currency,
      p.status         AS pay_status,
      p.admin_note     AS pay_admin_note,
      p.verified_at    AS pay_verified_at,
      p.failed_at      AS pay_failed_at,
      p.refunded_at    AS pay_refunded_at,
      p.created_at     AS pay_created_at
    FROM (
      SELECT * FROM orders WHERE customer_user_id = ${userId}
      ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
    ) o
    LEFT JOIN order_items oi ON oi.order_id = o.id
    LEFT JOIN payments p ON p.id = o.payment_id
    ORDER BY o.created_at DESC
  `;
  return buildOrdersFromJoinRows(rows);
}

async function dbGetOrdersForVendor(vendorUserId, { limit = 50, offset = 0 } = {}) {
  const sql = db();
  const rows = await sql`
    SELECT o.*,
      oi.id            AS oi_id,
      oi.product_id    AS oi_product_id,
      oi.vendor_user_id AS oi_vendor_user_id,
      oi.vendor_name   AS oi_vendor_name,
      oi.name_en       AS oi_name_en,
      oi.name_ha       AS oi_name_ha,
      oi.unit_price    AS oi_unit_price,
      oi.original_unit_price AS oi_original_unit_price,
      oi.quantity      AS oi_quantity,
      oi.line_total    AS oi_line_total,
      oi.discount_amount AS oi_discount_amount,
      oi.promotion_id  AS oi_promotion_id,
      oi.commission_rate AS oi_commission_rate,
      oi.commission_amount AS oi_commission_amount,
      oi.vendor_payout AS oi_vendor_payout,
      p.id             AS pay_id,
      p.reference      AS pay_reference,
      p.method         AS pay_method,
      p.gateway        AS pay_gateway,
      p.amount         AS pay_amount,
      p.currency       AS pay_currency,
      p.status         AS pay_status,
      p.admin_note     AS pay_admin_note,
      p.verified_at    AS pay_verified_at,
      p.failed_at      AS pay_failed_at,
      p.refunded_at    AS pay_refunded_at,
      p.created_at     AS pay_created_at
    FROM (
      SELECT DISTINCT o.* FROM orders o
      JOIN order_items oi ON oi.order_id = o.id AND oi.vendor_user_id = ${vendorUserId}
      ORDER BY o.created_at DESC LIMIT ${limit} OFFSET ${offset}
    ) o
    LEFT JOIN order_items oi ON oi.order_id = o.id AND oi.vendor_user_id = ${vendorUserId}
    LEFT JOIN payments p ON p.id = o.payment_id
    ORDER BY o.created_at DESC
  `;
  return buildOrdersFromJoinRows(rows);
}

async function dbGetAllOrders({ limit = 100, offset = 0 } = {}) {
  const sql = db();
  const rows = await sql`
    SELECT o.*,
      oi.id            AS oi_id,
      oi.product_id    AS oi_product_id,
      oi.vendor_user_id AS oi_vendor_user_id,
      oi.vendor_name   AS oi_vendor_name,
      oi.name_en       AS oi_name_en,
      oi.name_ha       AS oi_name_ha,
      oi.unit_price    AS oi_unit_price,
      oi.original_unit_price AS oi_original_unit_price,
      oi.quantity      AS oi_quantity,
      oi.line_total    AS oi_line_total,
      oi.discount_amount AS oi_discount_amount,
      oi.promotion_id  AS oi_promotion_id,
      oi.commission_rate AS oi_commission_rate,
      oi.commission_amount AS oi_commission_amount,
      oi.vendor_payout AS oi_vendor_payout,
      p.id             AS pay_id,
      p.reference      AS pay_reference,
      p.method         AS pay_method,
      p.gateway        AS pay_gateway,
      p.amount         AS pay_amount,
      p.currency       AS pay_currency,
      p.status         AS pay_status,
      p.admin_note     AS pay_admin_note,
      p.verified_at    AS pay_verified_at,
      p.failed_at      AS pay_failed_at,
      p.refunded_at    AS pay_refunded_at,
      p.created_at     AS pay_created_at
    FROM (
      SELECT * FROM orders ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
    ) o
    LEFT JOIN order_items oi ON oi.order_id = o.id
    LEFT JOIN payments p ON p.id = o.payment_id
    ORDER BY o.created_at DESC
  `;
  return buildOrdersFromJoinRows(rows);
}

async function dbUpdateOrderStatus(orderId, status, deliveryPerson) {
  const sql = db();
  const [r] = await sql`
    UPDATE orders SET status = ${status},
      delivery_person = COALESCE(${deliveryPerson ?? null}, delivery_person),
      updated_at = now()
    WHERE id = ${orderId} RETURNING *
  `;
  if (status === "delivered") {
    await sql`
      UPDATE wallet_ledger SET status = 'available', available_at = now()
      WHERE order_id = ${orderId} AND type = 'vendor_pending_credit' AND status = 'pending'
    `;
  }
  return r;
}

async function dbGetPaymentById(paymentId) {
  const sql = db();
  const [r] = await sql`SELECT * FROM payments WHERE id = ${paymentId} LIMIT 1`;
  return paymentFromRow(r);
}

async function dbGetAllPayments({ limit = 100, offset = 0 } = {}) {
  const sql = db();
  const rs = await sql`SELECT * FROM payments ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
  return rs.map(paymentFromRow);
}

async function dbUpdatePaymentStatus(paymentId, orderId, status, adminNote) {
  const sql = db();
  const now = new Date().toISOString();
  await sql.begin(async (tx) => {
    await tx`
      UPDATE payments SET status = ${status},
        admin_note = ${adminNote ?? null},
        verified_at = CASE WHEN ${status} = 'paid' THEN ${now}::timestamptz ELSE verified_at END,
        failed_at   = CASE WHEN ${status} = 'failed' THEN ${now}::timestamptz ELSE failed_at END,
        refunded_at = CASE WHEN ${status} = 'refunded' THEN ${now}::timestamptz ELSE refunded_at END
      WHERE id = ${paymentId}
    `;
    await tx`UPDATE orders SET payment_status = ${status}, updated_at = now() WHERE id = ${orderId}`;
    if (status === "paid") {
      const [existingLedger] = await tx`SELECT 1 FROM wallet_ledger WHERE order_id = ${orderId} LIMIT 1`;
      if (!existingLedger) {
        const itemRows = await tx`SELECT * FROM order_items WHERE order_id = ${orderId}`;
        await dbCreateLedgerForOrder(orderId, itemRows.map(orderItemFromRow), tx);
      }
      const [orderRow] = await tx`SELECT status FROM orders WHERE id = ${orderId}`;
      if (orderRow?.status === "delivered") {
        await tx`
          UPDATE wallet_ledger SET status = 'available', available_at = now()
          WHERE order_id = ${orderId} AND type = 'vendor_pending_credit' AND status = 'pending'
        `;
      }
    }
  });
}

async function dbGetVendorWallet(vendorUserId) {
  // Single aggregation query — never materialises the ledger into JS at scale.
  const sql = db();
  const [r] = await sql`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'vendor_pending_credit' AND status = 'available' THEN amount
                       WHEN type = 'vendor_withdrawal_debit'                          THEN -amount
                       ELSE 0 END), 0)::int  AS available_balance,
      COALESCE(SUM(CASE WHEN type = 'vendor_pending_credit' AND status = 'pending'   THEN amount
                       ELSE 0 END), 0)::int  AS pending_balance,
      COALESCE(SUM(CASE WHEN type = 'platform_commission'                            THEN amount
                       ELSE 0 END), 0)::int  AS total_commission
    FROM wallet_ledger WHERE vendor_user_id = ${vendorUserId}
  `;
  return {
    vendorUserId,
    availableBalance: r?.available_balance ?? 0,
    pendingBalance:   r?.pending_balance   ?? 0,
    totalCommission:  r?.total_commission  ?? 0,
  };
}

async function dbGetPayoutRequests(vendorUserId, { limit = 100, offset = 0 } = {}) {
  const sql = db();
  const rs = vendorUserId
    ? await sql`SELECT * FROM payout_requests WHERE vendor_user_id = ${vendorUserId}
                ORDER BY requested_at DESC LIMIT ${limit} OFFSET ${offset}`
    : await sql`SELECT * FROM payout_requests ORDER BY requested_at DESC LIMIT ${limit} OFFSET ${offset}`;
  return rs.map(fromRow);
}

async function dbCreatePayoutRequest(payout) {
  const sql = db();
  const [r] = await sql`
    INSERT INTO payout_requests (id, vendor_user_id, amount, status, bank_name, account_number, account_name)
    VALUES (${payout.id}, ${payout.vendorUserId}, ${payout.amount}, 'pending',
            ${payout.bankName}, ${payout.accountNumber}, ${payout.accountName})
    RETURNING *
  `;
  return fromRow(r);
}

async function dbUpdatePayoutStatus(payoutId, vendorUserId, status, adminNote, amount) {
  const sql = db();
  const [r] = await sql`
    UPDATE payout_requests SET status = ${status},
      admin_note = ${adminNote ?? null}, reviewed_at = now()
    WHERE id = ${payoutId} RETURNING *
  `;
  if (status === "approved") {
    await sql`
      INSERT INTO wallet_ledger (id, vendor_user_id, payout_request_id, type, status, amount, available_at)
      VALUES (${randomUUID()}, ${vendorUserId}, ${payoutId},
              'vendor_withdrawal_debit', 'available', ${amount}, now())
    `;
  }
  return fromRow(r);
}

async function dbCreateNotification(n) {
  const sql = db();
  await sql`
    INSERT INTO notifications (id, audience, recipient_user_id, title, message, type, order_id, product_id)
    VALUES (${randomUUID()}, ${n.audience}, ${n.recipientUserId},
            ${n.title}, ${n.message}, ${n.type},
            ${n.orderId ?? null}, ${n.productId ?? null})
  `;
}

async function dbNotifyAdmins(n) {
  const sql = db();
  const admins = await sql`SELECT id FROM users WHERE role = 'admin'`;
  if (!admins.length) return;
  // Bulk-insert all admin notifications in one round-trip instead of N sequential inserts.
  const rows = admins.map((admin) => ({
    id: randomUUID(), audience: "admin", recipient_user_id: admin.id,
    title: n.title, message: n.message, type: n.type,
    order_id: n.orderId ?? null, product_id: n.productId ?? null,
  }));
  await sql`INSERT INTO notifications ${sql(rows)}`;
}

async function dbGetNotifications(userId) {
  const sql = db();
  const rs = await sql`
    SELECT * FROM notifications WHERE recipient_user_id = ${userId} ORDER BY created_at DESC LIMIT 50
  `;
  return rs.map(fromRow);
}

async function dbMarkNotificationRead(notifId, userId) {
  const sql = db();
  const [r] = await sql`
    UPDATE notifications SET read_at = now()
    WHERE id = ${notifId} AND recipient_user_id = ${userId}
    RETURNING *
  `;
  return fromRow(r);
}

async function dbGetWishlist(userId, { limit = 100, offset = 0 } = {}) {
  const sql = db();
  const rs = await sql`
    SELECT p.*, u.phone as vendor_phone FROM wishlists w
    JOIN products p ON p.id = w.product_id
    JOIN users u ON u.id = p.vendor_user_id
    WHERE w.user_id = ${userId}
      AND p.moderation_status = 'approved' AND p.listing_status = 'active'
    ORDER BY w.created_at DESC LIMIT ${limit} OFFSET ${offset}
  `;
  return rs.map(productFromRow);
}

async function dbAddWishlist(userId, productId) {
  const sql = db();
  await sql`
    INSERT INTO wishlists (user_id, product_id) VALUES (${userId}, ${productId})
    ON CONFLICT DO NOTHING
  `;
}

async function dbRemoveWishlist(userId, productId) {
  const sql = db();
  await sql`DELETE FROM wishlists WHERE user_id = ${userId} AND product_id = ${productId}`;
}

async function dbGetReviews(productId, includeHidden, { limit = 50, offset = 0 } = {}) {
  const sql = db();
  const rs = includeHidden
    ? await sql`SELECT * FROM reviews WHERE product_id = ${productId}
                ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`
    : await sql`SELECT * FROM reviews WHERE product_id = ${productId} AND hidden = false
                ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
  return rs.map(fromRow);
}

async function dbGetVendorReviews(vendorUserId, { limit = 50, offset = 0 } = {}) {
  const sql = db();
  const rs = await sql`
    SELECT * FROM reviews WHERE vendor_user_id = ${vendorUserId}
    ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
  `;
  return rs.map(fromRow);
}

async function dbGetAllReviews({ limit = 100, offset = 0 } = {}) {
  const sql = db();
  const rs = await sql`SELECT * FROM reviews ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
  return rs.map(fromRow);
}

async function dbCreateReview(review) {
  const sql = db();
  const [r] = await sql`
    INSERT INTO reviews (id, product_id, vendor_user_id, customer_user_id, reviewer_name, rating, comment)
    VALUES (${randomUUID()}, ${review.productId}, ${review.vendorUserId}, ${review.customerUserId},
            ${review.reviewerName}, ${review.rating}, ${review.comment})
    RETURNING *
  `;
  return fromRow(r);
}

async function dbUpdateReview(reviewId, hidden, adminNote) {
  const sql = db();
  const [r] = await sql`
    UPDATE reviews SET hidden = ${hidden}, admin_note = ${adminNote ?? null}, updated_at = now()
    WHERE id = ${reviewId} RETURNING *
  `;
  return fromRow(r);
}

async function dbCustomerHasDeliveredOrder(customerId, productId) {
  const sql = db();
  const [r] = await sql`
    SELECT 1 FROM orders o JOIN order_items oi ON oi.order_id = o.id
    WHERE o.customer_user_id = ${customerId} AND o.status = 'delivered'
      AND oi.product_id = ${productId}
    LIMIT 1
  `;
  return !!r;
}

async function dbGetPromotions(activeOnly, { limit = 100, offset = 0 } = {}) {
  const sql = db();
  const rs = activeOnly
    ? await sql`SELECT * FROM promotions WHERE active = true AND starts_at <= now()
                ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`
    : await sql`SELECT * FROM promotions ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
  return rs.map(fromRow);
}

async function dbGetActivePromotionForProduct(product, code) {
  const sql = db();
  const normalizedCode = code ? code.toUpperCase() : null;
  const rs = await sql`
    SELECT * FROM promotions
    WHERE active = true AND starts_at <= now() AND (ends_at IS NULL OR ends_at > now())
      AND (code IS NULL OR code = ${normalizedCode})
      AND (product_id = ${product.id} OR vendor_user_id = ${product.vendorUserId}
           OR category = ${product.category}
           OR (product_id IS NULL AND vendor_user_id IS NULL AND category IS NULL))
    ORDER BY created_at DESC LIMIT 1
  `;
  return rs[0] ? fromRow(rs[0]) : null;
}

async function dbCreatePromotion(p) {
  const sql = db();
  const [r] = await sql`
    INSERT INTO promotions (id, title_en, title_ha, type, discount_percent, code, product_id,
      vendor_user_id, category, active, starts_at, ends_at)
    VALUES (${randomUUID()}, ${p.title.en}, ${p.title.ha}, ${p.type}, ${p.discountPercent},
            ${p.code ?? null}, ${p.productId ?? null}, ${p.vendorUserId ?? null},
            ${p.category ?? null}, ${p.active !== false}, ${p.startsAt ?? new Date().toISOString()},
            ${p.endsAt ?? null})
    RETURNING *
  `;
  return fromRow(r);
}

async function dbUpdatePromotion(promoId, active) {
  const sql = db();
  const [r] = await sql`
    UPDATE promotions SET active = ${active}, updated_at = now()
    WHERE id = ${promoId} RETURNING *
  `;
  return fromRow(r);
}

async function dbGetCategories() {
  const sql = db();
  const rs = await sql`SELECT * FROM categories ORDER BY key`;
  return rs.map(fromRow);
}

async function dbUpsertCategory(cat) {
  const sql = db();
  const [r] = await sql`
    INSERT INTO categories (key, name_en, name_ha, search_terms)
    VALUES (${cat.key}, ${cat.name.en}, ${cat.name.ha}, ${cat.searchTerms})
    ON CONFLICT (key) DO UPDATE SET
      name_en = EXCLUDED.name_en, name_ha = EXCLUDED.name_ha,
      search_terms = EXCLUDED.search_terms, updated_at = now()
    RETURNING *
  `;
  return fromRow(r);
}

async function dbSaveUpload(upload) {
  const sql = db();
  const [r] = await sql`
    INSERT INTO uploads (id, vendor_user_id, file_name, mime_type, data_url, blob_url, url)
    VALUES (${upload.id}, ${upload.vendorUserId}, ${upload.fileName},
            ${upload.mimeType}, ${upload.dataUrl ?? null}, ${upload.blobUrl ?? null}, ${upload.url})
    RETURNING *
  `;
  return fromRow(r);
}

async function dbGetUpload(uploadId) {
  const sql = db();
  const [r] = await sql`SELECT * FROM uploads WHERE id = ${uploadId} LIMIT 1`;
  return r ? fromRow(r) : null;
}

async function dbRecordSearchEvent(query) {
  const sql = db();
  // Fire-and-forget: don't block the search response on the analytics write.
  sql`INSERT INTO search_events (id, query) VALUES (${randomUUID()}, ${query})`.catch(() => undefined);
}

// Cleanup logic lives here so it can be called by the cron endpoint (api/cron.mjs).
// setInterval is NOT used — Vercel function instances are ephemeral; intervals die
// silently when the instance is recycled. Vercel Cron calls the endpoint instead.
export async function runMaintenanceTasks() {
  const sql = db();
  const [sessions] = await sql`
    DELETE FROM sessions WHERE expires_at < now() RETURNING count(*)::int AS deleted
  `.catch(() => [{ deleted: 0 }]);
  const [events] = await sql`
    DELETE FROM search_events WHERE created_at < now() - INTERVAL '90 days'
    RETURNING count(*)::int AS deleted
  `.catch(() => [{ deleted: 0 }]);
  return {
    sessionsDeleted: sessions?.deleted ?? 0,
    searchEventsDeleted: events?.deleted ?? 0,
  };
}

async function dbIncrementProductView(productId) {
  const sql = db();
  // Fire-and-forget: don't block the product page response on the analytics write.
  sql`
    INSERT INTO product_views (product_id, views, last_viewed_at) VALUES (${productId}, 1, now())
    ON CONFLICT (product_id) DO UPDATE SET views = product_views.views + 1, last_viewed_at = now()
  `.catch(() => undefined);
}

async function dbGetAnalytics() {
  const sql = db();
  const [totals] = await sql`
    SELECT
      (SELECT COUNT(*) FROM orders)::int as total_orders,
      (SELECT COALESCE(SUM(subtotal),0) FROM orders)::int as total_sales,
      (SELECT COUNT(*) FROM orders WHERE status = 'cancelled')::int as cancelled_orders,
      (SELECT COUNT(*) FROM users WHERE role = 'customer')::int as customer_count,
      (SELECT COUNT(*) FROM users WHERE role = 'vendor')::int as vendor_count
  `;
  const productViews = await sql`SELECT product_id, views, last_viewed_at FROM product_views ORDER BY views DESC LIMIT 20`;
  const popularSearches = await sql`
    SELECT query, COUNT(*)::int as count FROM search_events GROUP BY query ORDER BY count DESC LIMIT 20
  `;
  const bestSelling = await sql`
    SELECT product_id, SUM(quantity)::int as quantity, SUM(line_total)::int as sales
    FROM order_items GROUP BY product_id ORDER BY quantity DESC LIMIT 10
  `;
  return {
    totalSales: totals.total_sales,
    totalOrders: totals.total_orders,
    cancelledOrders: totals.cancelled_orders,
    customerGrowth: totals.customer_count,
    vendorGrowth: totals.vendor_count,
    productViews: productViews.map(r => ({ productId: r.product_id, views: r.views, lastViewedAt: r.last_viewed_at })),
    popularSearches: popularSearches.map(r => ({ query: r.query, count: r.count })),
    bestSellingProducts: bestSelling.map(r => ({ productId: r.product_id, quantity: r.quantity, sales: r.sales })),
  };
}

// ── Utils ────────────────────────────────────────────────────────────────────

function normalizePhone(value = "") {
  const digits = String(value).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("234")) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 11) return `+234${digits.slice(1)}`;
  if (digits.length === 10) return `+234${digits}`;
  return `+${digits}`;
}

function normalizeEmail(value = "") {
  return String(value).trim().toLowerCase();
}

async function hashPassword(password) {
  const salt = randomUUID().replace(/-/g, "");
  const minIter = process.env.NODE_ENV === "test" ? 1_000 : 100_000;
  const iterations = Math.max(minIter, Number(process.env.PASSWORD_HASH_ITERATIONS ?? (process.env.NODE_ENV === "test" ? 1_000 : 210_000)));
  const hash = (await pbkdf2Async(String(password), salt, iterations, 32, "sha256")).toString("hex");
  return `pbkdf2_sha256$${iterations}$${salt}$${hash}`;
}

async function verifyPassword(password, storedHash = "") {
  const [algorithm, iterations, salt, expected] = storedHash.split("$");
  if (algorithm !== "pbkdf2_sha256" || !iterations || !salt || !expected) return false;
  const actual = await pbkdf2Async(String(password), salt, Number(iterations), 32, "sha256");
  const expectedBuf = Buffer.from(expected, "hex");
  if (actual.length !== expectedBuf.length) return false;
  return timingSafeEqual(actual, expectedBuf);
}

function sanitizeText(value, maxLength = 120) {
  return String(value ?? "").replace(/[ -]/g, " ").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

// ── Public formatters ─────────────────────────────────────────────────────────

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id, phone: user.phone, email: user.email,
    firstName: user.firstName, lastName: user.lastName, name: user.name,
    role: user.role, deliveryAddress: user.deliveryAddress,
    preferredLanguage: user.preferredLanguage, vendorStatus: user.vendorStatus,
    createdAt: user.createdAt, updatedAt: user.updatedAt,
  };
}

function publicVendorApplication(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    user: {
      id: row.user_id, name: row.user_name, phone: row.user_phone,
      email: row.user_email, role: row.user_role, vendorStatus: row.user_vendor_status,
    },
    businessName: row.business_name, phone: row.phone, area: row.area,
    category: row.category, status: row.status, adminNote: row.admin_note,
    reviewedAt: row.reviewed_at, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function publicProduct(product, opts = {}) {
  if (!product) return null;
  return {
    id: product.id, vendorUserId: product.vendorUserId, vendorName: product.vendorName,
    vendorPhone: product.vendorPhone, name: product.name, description: product.description,
    category: product.category, price: product.price, currency: product.currency,
    quantityAvailable: product.quantityAvailable, area: product.area, imageUrl: product.imageUrl,
    tags: product.tags, listingStatus: product.listingStatus, moderationStatus: product.moderationStatus,
    reviewNote: opts.includeAdminFields ? product.reviewNote : undefined,
    reviewedAt: opts.includeAdminFields ? product.reviewedAt : undefined,
    createdAt: product.createdAt, updatedAt: product.updatedAt,
  };
}

function publicOrder(order) {
  if (!order) return null;
  return {
    id: order.id, customerUserId: order.customerUserId,
    customerName: order.customerName, customerPhone: order.customerPhone,
    items: order.items ?? [], deliveryOption: order.deliveryOption,
    deliveryAddress: order.deliveryAddress, deliveryArea: order.deliveryArea,
    deliveryFee: order.deliveryFee, deliveryPerson: order.deliveryPerson,
    paymentMethod: order.paymentMethod, paymentReference: order.paymentReference,
    paymentStatus: order.paymentStatus, subtotal: order.subtotal,
    itemsSubtotal: order.itemsSubtotal, commissionTotal: order.commissionTotal,
    vendorPayoutTotal: order.vendorPayoutTotal, status: order.status,
    payment: order.payment, createdAt: order.createdAt, updatedAt: order.updatedAt,
  };
}

function publicPayment(payment) {
  if (!payment) return null;
  return {
    id: payment.id, orderId: payment.orderId, reference: payment.reference,
    method: payment.method, gateway: payment.gateway, amount: payment.amount,
    currency: payment.currency, status: payment.status, adminNote: payment.adminNote,
    createdAt: payment.createdAt, verifiedAt: payment.verifiedAt,
    failedAt: payment.failedAt, refundedAt: payment.refundedAt,
  };
}

function publicNotification(n) {
  if (!n) return null;
  return {
    id: n.id, audience: n.audience, recipientUserId: n.recipientUserId ?? n.recipient_user_id,
    title: n.title, message: n.message, type: n.type,
    orderId: n.orderId ?? n.order_id, productId: n.productId ?? n.product_id,
    readAt: n.readAt ?? n.read_at, createdAt: n.createdAt ?? n.created_at,
  };
}

function publicReview(review) {
  if (!review) return null;
  return {
    id: review.id, productId: review.productId ?? review.product_id,
    vendorUserId: review.vendorUserId ?? review.vendor_user_id,
    customerUserId: review.customerUserId ?? review.customer_user_id,
    reviewerName: review.reviewerName ?? review.reviewer_name,
    rating: review.rating, comment: review.comment, hidden: review.hidden,
    adminNote: review.adminNote ?? review.admin_note,
    createdAt: review.createdAt ?? review.created_at, updatedAt: review.updatedAt ?? review.updated_at,
  };
}

function publicPayoutRequest(payout) {
  if (!payout) return null;
  return {
    id: payout.id, vendorUserId: payout.vendorUserId ?? payout.vendor_user_id,
    amount: payout.amount, status: payout.status,
    bankName: payout.bankName ?? payout.bank_name,
    accountNumber: payout.accountNumber ?? payout.account_number,
    accountName: payout.accountName ?? payout.account_name,
    adminNote: payout.adminNote ?? payout.admin_note,
    requestedAt: payout.requestedAt ?? payout.requested_at,
    reviewedAt: payout.reviewedAt ?? payout.reviewed_at,
  };
}

function publicCategory(cat) {
  if (!cat) return null;
  return {
    key: cat.key,
    name: cat.name ?? { en: cat.name_en, ha: cat.name_ha },
    searchTerms: cat.searchTerms ?? cat.search_terms ?? [],
    createdAt: cat.createdAt ?? cat.created_at,
    updatedAt: cat.updatedAt ?? cat.updated_at,
  };
}

// ── Validators ────────────────────────────────────────────────────────────────

function validateSignup(input) {
  const errors = {};
  const phone = normalizePhone(input.phone);
  const password = String(input.password ?? "");
  const firstName = String(input.firstName ?? "").trim();
  const lastName = String(input.lastName ?? "").trim();
  const role = input.role === "vendor" ? "vendor" : input.role === "customer" ? "customer" : "";
  if (!phone || phone.length < 8) errors.phone = "A valid phone number is required.";
  if (password.length < 8) errors.password = "Password must be at least 8 characters.";
  if (!firstName) errors.firstName = "First name is required.";
  if (!lastName) errors.lastName = "Last name is required.";
  if (!role) errors.role = "Role must be customer or vendor.";
  return {
    valid: Object.keys(errors).length === 0, errors,
    value: { phone, password, firstName, lastName, role,
      email: normalizeEmail(input.email),
      deliveryAddress: String(input.deliveryAddress ?? "").trim(),
      preferredLanguage: input.preferredLanguage === "ha" ? "ha" : "en",
      businessName: String(input.businessName ?? "").trim(),
      area: String(input.area ?? "").trim(),
      category: String(input.category ?? "").trim() },
  };
}

function validateProductInput(input) {
  const errors = {};
  const nameEn = sanitizeText(input.name?.en ?? input.nameEn ?? input.name, 90);
  const nameHa = sanitizeText(input.name?.ha ?? input.nameHa ?? nameEn, 90);
  const descriptionEn = sanitizeText(input.description?.en ?? input.descriptionEn ?? "", 240);
  const descriptionHa = sanitizeText(input.description?.ha ?? input.descriptionHa ?? descriptionEn, 240);
  const category = sanitizeText(input.category, 40).toLowerCase();
  const price = Number(input.price ?? input.priceValue);
  const quantityAvailable = Number(input.quantityAvailable ?? 1);
  const area = sanitizeText(input.area ?? "Kano", 80);
  const imageUrl = sanitizeText(input.imageUrl ?? "", 500);
  const tags = Array.isArray(input.tags) ? input.tags.map((t) => sanitizeText(t, 40)).filter(Boolean) : [];
  if (!nameEn) errors.name = "Product name is required.";
  if (!category) errors.category = "Category is required.";
  if (!Number.isFinite(price) || price <= 0) errors.price = "Price must be greater than zero.";
  if (!Number.isInteger(quantityAvailable) || quantityAvailable < 0) errors.quantityAvailable = "Quantity must be a whole number greater than or equal to zero.";
  return {
    valid: Object.keys(errors).length === 0, errors,
    value: {
      name: { en: nameEn, ha: nameHa }, description: { en: descriptionEn, ha: descriptionHa },
      category, price, currency: "NGN", quantityAvailable, area,
      imageUrl: imageUrl || undefined,
      tags: [...new Set([nameEn, nameHa, category, area, ...tags].map((t) => t.toLowerCase()).filter(Boolean))],
    },
  };
}

function validateListingStatus(input) {
  const listingStatus = ["active", "out_of_stock", "taken_down"].includes(input.listingStatus) ? input.listingStatus : "";
  const errors = {};
  if (!listingStatus) errors.listingStatus = "Listing status must be active, out_of_stock, or taken_down.";
  return { valid: !errors.listingStatus, errors, value: { listingStatus } };
}

function validateCartItem(input) {
  const productId = String(input.productId ?? "").trim();
  const quantity = Number(input.quantity ?? 1);
  const errors = {};
  if (!productId) errors.productId = "Product is required.";
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) errors.quantity = "Quantity must be 1-99.";
  return { valid: Object.keys(errors).length === 0, errors, value: { productId, quantity } };
}

function validateCheckout(input) {
  const deliveryOption = input.deliveryOption === "pickup" ? "pickup" : "delivery";
  const deliveryAddress = sanitizeText(input.deliveryAddress ?? "", 180);
  const deliveryArea = sanitizeText(input.deliveryArea ?? "Kano", 80);
  const paymentMethod = sanitizeText(input.paymentMethod ?? "", 40);
  const promotionCode = sanitizeText(input.promotionCode ?? "", 40).toUpperCase();
  const errors = {};
  const allowed = new Set(["manual_transfer", "pay_on_delivery", "card", "bank_transfer", "ussd", "wallet"]);
  if (deliveryOption === "delivery" && !deliveryAddress) errors.deliveryAddress = "Delivery address is required.";
  if (!deliveryArea) errors.deliveryArea = "Delivery area is required.";
  if (!allowed.has(paymentMethod)) errors.paymentMethod = "Payment method is not supported.";
  return { valid: Object.keys(errors).length === 0, errors, value: { deliveryOption, deliveryAddress, deliveryArea, paymentMethod, promotionCode } };
}

function validateVendorDecision(input) {
  const status = ["approved", "rejected"].includes(input.status) ? input.status : "";
  const adminNote = sanitizeText(input.adminNote ?? "", 500);
  const errors = {};
  if (!status) errors.status = "Status must be approved or rejected.";
  return { valid: !errors.status, errors, value: { status, adminNote } };
}

function validateProductModeration(input) {
  const status = ["approved", "hidden", "rejected"].includes(input.status) ? input.status : "";
  const reviewNote = sanitizeText(input.reviewNote ?? "", 500);
  const errors = {};
  if (!status) errors.status = "Status must be approved, hidden, or rejected.";
  return { valid: !errors.status, errors, value: { status, reviewNote } };
}

function validatePaymentDecision(input) {
  const status = ["paid", "failed", "refunded"].includes(input.status) ? input.status : "";
  const adminNote = sanitizeText(input.adminNote ?? "", 500);
  const errors = {};
  if (!status) errors.status = "Status must be paid, failed, or refunded.";
  return { valid: !errors.status, errors, value: { status, adminNote } };
}

function validateOrderStatusInput(input) {
  const allowed = new Set(["awaiting_confirmation","preparing_order","ready_for_pickup","assigned_to_rider","out_for_delivery","delivered","cancelled"]);
  const status = sanitizeText(input.status ?? "", 40);
  const deliveryPerson = sanitizeText(input.deliveryPerson ?? "", 100);
  const errors = {};
  if (!allowed.has(status)) errors.status = "Order status is not supported.";
  return { valid: !errors.status, errors, value: { status, deliveryPerson } };
}

function validateReviewInput(input) {
  const productId = String(input.productId ?? "").trim();
  const rating = Number(input.rating);
  const comment = sanitizeText(input.comment ?? "", 500);
  const errors = {};
  if (!productId) errors.productId = "Product is required.";
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) errors.rating = "Rating must be 1-5.";
  if (!comment) errors.comment = "Review comment is required.";
  return { valid: Object.keys(errors).length === 0, errors, value: { productId, rating, comment } };
}

function validatePromotionInput(input) {
  const titleEn = sanitizeText(input.title?.en ?? input.titleEn ?? input.title, 120);
  const titleHa = sanitizeText(input.title?.ha ?? input.titleHa ?? titleEn, 120);
  const type = sanitizeText(input.type ?? "discount_code", 40);
  const discountPercent = Number(input.discountPercent);
  const code = sanitizeText(input.code ?? "", 40).toUpperCase();
  const errors = {};
  const allowedTypes = new Set(["discount_code","flash_sale","featured_product","featured_vendor","seasonal_campaign"]);
  if (!titleEn) errors.title = "Promotion title is required.";
  if (!allowedTypes.has(type)) errors.type = "Promotion type is not supported.";
  if (!Number.isFinite(discountPercent) || discountPercent < 1 || discountPercent > 90) errors.discountPercent = "Discount must be 1-90%.";
  return {
    valid: Object.keys(errors).length === 0, errors,
    value: {
      title: { en: titleEn, ha: titleHa }, type, discountPercent,
      code: code || undefined, productId: sanitizeText(input.productId ?? "", 80) || undefined,
      vendorUserId: sanitizeText(input.vendorUserId ?? "", 80) || undefined,
      category: sanitizeText(input.category ?? "", 40).toLowerCase() || undefined,
      active: input.active !== false,
      startsAt: input.startsAt ? new Date(input.startsAt).toISOString() : new Date().toISOString(),
      endsAt: input.endsAt ? new Date(input.endsAt).toISOString() : undefined,
    },
  };
}

function validatePayoutInput(input) {
  const amount = Number(input.amount);
  const bankName = sanitizeText(input.bankName ?? "", 80);
  const accountNumber = sanitizeText(input.accountNumber ?? "", 30);
  const accountName = sanitizeText(input.accountName ?? "", 120);
  const errors = {};
  if (!Number.isInteger(amount) || amount < 1000) errors.amount = "Amount must be at least 1000.";
  if (!bankName) errors.bankName = "Bank name is required.";
  if (!accountNumber) errors.accountNumber = "Account number is required.";
  if (!accountName) errors.accountName = "Account name is required.";
  return { valid: Object.keys(errors).length === 0, errors, value: { amount, bankName, accountNumber, accountName } };
}

function validatePayoutDecision(input) {
  const status = ["approved", "rejected"].includes(input.status) ? input.status : "";
  const adminNote = sanitizeText(input.adminNote ?? "", 500);
  const errors = {};
  if (!status) errors.status = "Status must be approved or rejected.";
  return { valid: !errors.status, errors, value: { status, adminNote } };
}

function validateCategoryInput(input) {
  const key = sanitizeText(input.key ?? "", 40).toLowerCase();
  const nameEn = sanitizeText(input.name?.en ?? input.nameEn ?? "", 80);
  const nameHa = sanitizeText(input.name?.ha ?? input.nameHa ?? nameEn, 80);
  const searchTerms = Array.isArray(input.searchTerms) ? input.searchTerms.map((t) => sanitizeText(t, 40).toLowerCase()).filter(Boolean) : [];
  const errors = {};
  if (!key) errors.key = "Category key is required.";
  if (!nameEn) errors.name = "Category name is required.";
  return { valid: Object.keys(errors).length === 0, errors, value: { key, name: { en: nameEn, ha: nameHa }, searchTerms } };
}

// ── Pagination helper ─────────────────────────────────────────────────────────
// Reads ?page= and ?limit= from any request URL.
// page is 1-based. limit is capped at 200 to prevent abuse.
function parsePagination(url, defaultLimit = 50) {
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? defaultLimit)));
  const page  = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  return { limit, offset: (page - 1) * limit, page };
}

function validateUploadInput(input) {
  const fileName = sanitizeText(input.fileName ?? "product-image", 120);
  const mimeType = sanitizeText(input.mimeType ?? "", 80);
  const dataUrl = String(input.dataUrl ?? "");
  const errors = {};
  const allowed = new Set(["image/png", "image/jpeg", "image/webp"]);
  const maxLength = Number(process.env.API_UPLOAD_MAX_DATA_URL_LENGTH ?? 750_000);
  if (!allowed.has(mimeType)) errors.mimeType = "Only PNG, JPEG, and WebP are supported.";
  if (!dataUrl.startsWith(`data:${mimeType};base64,`)) errors.dataUrl = "A matching base64 data URL is required.";
  if (dataUrl.length > maxLength) errors.dataUrl = "Image upload is too large.";
  return { valid: Object.keys(errors).length === 0, errors, value: { fileName, mimeType, dataUrl } };
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

function send(response, status, body, extraHeaders = {}) {
  response.writeHead(status, { ...jsonHeaders, ...extraHeaders });
  response.end(JSON.stringify(body));
}

function sendError(response, status, code, message, details) {
  send(response, status, { error: { code, message, ...(details ? { details } : {}) } });
}

async function readJson(request) {
  const chunks = [];
  const limit = Number(process.env.API_BODY_LIMIT_BYTES ?? DEFAULT_BODY_LIMIT_BYTES);
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > limit) { const e = new Error("Request body is too large"); e.status = 413; e.code = "body_too_large"; throw e; }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) return {};
  try { return JSON.parse(raw); } catch { const e = new Error("Invalid JSON"); e.status = 400; e.code = "invalid_json"; throw e; }
}

function getSessionToken(request) {
  const auth = request.headers.authorization;
  if (auth?.startsWith("Bearer ")) return auth.slice("Bearer ".length).trim();
  const cookieHeader = request.headers.cookie ?? "";
  const cookies = new Map(
    cookieHeader.split(";").map((c) => c.trim()).filter(Boolean).map((c) => {
      const i = c.indexOf("=");
      return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))];
    }),
  );
  return cookies.get(SESSION_COOKIE) ?? "";
}

function createCookie(token) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}${secure}`;
}

function clearCookie() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`;
}

function assertAdmin(response, user) {
  if (!user) { sendError(response, 401, "unauthenticated", "Sign in is required."); return false; }
  if (user.role !== "admin") { sendError(response, 403, "forbidden", "Admin access is required."); return false; }
  return true;
}

async function assertAuthenticated(response, user, request, rl) {
  if (!user) { sendError(response, 401, "unauthenticated", "Sign in is required."); return false; }
  if (rl && request && !await rl.check(request, user.id)) {
    sendError(response, 429, "rate_limited", "Too many requests. Please slow down."); return false;
  }
  return true;
}

function corsHeaders(request, allowedOrigin) {
  const origin = request.headers.origin;
  const allowOrigin = allowedOrigin === "*" ? "*" : origin && allowedOrigin.split(",").includes(origin) ? origin : "";
  if (!allowOrigin) return {};
  return {
    "access-control-allow-origin": allowOrigin,
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "content-type, authorization",
    "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
    vary: "Origin",
  };
}

// ── Rate limiting ─────────────────────────────────────────────────────────────
//
// Two tiers:
//   IP  — 600 req / min  (all traffic, including unauthenticated)
//   User — 120 writes/min (authenticated mutating requests only)
//
// When UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set, limits are
// enforced via Upstash Redis and are shared across ALL Vercel function instances.
// Without those env vars the server falls back to an in-memory Map that is
// per-instance only — fine for dev/test, not for production at scale.

function createMemoryBuckets(windowMs, maxRequests) {
  const buckets = new Map();
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [k, b] of buckets) { if (b.resetAt <= now) buckets.delete(k); }
  }, 5 * 60_000);
  if (cleanup.unref) cleanup.unref();
  return {
    async check(key) {
      if (maxRequests <= 0) return true;
      const now = Date.now();
      const b = buckets.get(key);
      if (!b || b.resetAt <= now) { buckets.set(key, { count: 1, resetAt: now + windowMs }); return true; }
      b.count += 1;
      return b.count <= maxRequests;
    },
  };
}

function createRateLimiter(options = {}) {
  const ipMax   = Number(options.maxRequests ?? process.env.API_RATE_LIMIT_MAX      ?? 600);
  const userMax = Number(process.env.API_USER_RATE_LIMIT_MAX ?? 120);

  const upstashUrl   = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (upstashUrl && upstashToken) {
    // ── Redis-backed (cross-instance, production-safe) ──────────────────────
    const redis = new Redis({ url: upstashUrl, token: upstashToken });
    const ipLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(ipMax, "1 m"),
      prefix:  "rl:ip",
      analytics: false,
    });
    const userLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(userMax, "1 m"),
      prefix:  "rl:user",
      analytics: false,
    });

    return {
      async check(request, userId) {
        const ip = request.headers["x-forwarded-for"]?.split(",")[0]?.trim()
                   || request.socket?.remoteAddress || "unknown";
        const { success: ipOk } = await ipLimiter.limit(ip);
        if (!ipOk) return false;
        if (userId && request.method !== "GET" && request.method !== "OPTIONS") {
          const { success: userOk } = await userLimiter.limit(userId);
          if (!userOk) return false;
        }
        return true;
      },
    };
  }

  // ── In-memory fallback (per-instance — dev / test only) ──────────────────
  if (process.env.NODE_ENV === "production") {
    console.warn(
      "[rate-limit] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are not set. " +
      "Rate limiting is per-instance only. Add Upstash from the Vercel Marketplace " +
      "to enforce limits across the entire fleet."
    );
  }
  const windowMs = Number(options.windowMs ?? process.env.API_RATE_LIMIT_WINDOW_MS ?? 60_000);
  const ipBuckets   = createMemoryBuckets(windowMs, ipMax);
  const userBuckets = createMemoryBuckets(windowMs, userMax);
  return {
    async check(request, userId) {
      const ip = request.headers["x-forwarded-for"]?.split(",")[0]?.trim()
                 || request.socket?.remoteAddress || "local";
      if (!await ipBuckets.check(ip)) return false;
      if (userId && request.method !== "GET" && request.method !== "OPTIONS") {
        if (!await userBuckets.check(userId)) return false;
      }
      return true;
    },
  };
}

// ── Payment helpers ───────────────────────────────────────────────────────────

function paymentStatusForMethod(method) {
  return ["card", "ussd", "wallet"].includes(method) ? "paid" : "pending";
}
function paymentGatewayForMethod(method) {
  return ["card", "ussd", "wallet"].includes(method) ? "prototype" : "manual";
}
function calcDeliveryFee(deliveryOption) {
  return deliveryOption === "pickup" ? 0 : 1200;
}

function getAllowedNextStatuses(order) {
  if (order.status === "cancelled" || order.status === "delivered") return [];
  const flow =
    order.deliveryOption === "pickup"
      ? ["awaiting_confirmation", "preparing_order", "ready_for_pickup", "delivered"]
      : ["awaiting_confirmation", "preparing_order", "ready_for_pickup", "assigned_to_rider", "out_for_delivery", "delivered"];
  const idx = flow.indexOf(order.status);
  const next = idx >= 0 ? flow[idx + 1] : undefined;
  return ["cancelled", next].filter(Boolean);
}

// ── App ────────────────────────────────────────────────────────────────────────

export function createApp(options = {}) {
  // ── Resolve store (memory path for tests/dataFile, Postgres otherwise) ────
  let store = options.store ?? null;
  if (!store && options.dataFile) {
    let initial = null;
    try { initial = JSON.parse(readFileSync(options.dataFile, "utf8")); } catch { /* first run */ }
    store = createMemoryStore(initial?.data ?? null);
  }
  // Memory-mode tests register admin as "+2348000000000"; production uses env/default.
  const adminPhone = options.adminPhone ??
    (store ? "08000000000" : (process.env.KANO_ADMIN_PHONE ?? DEFAULT_ADMIN_PHONE));
  const allowedOrigin = options.allowedOrigin ?? process.env.CORS_ORIGIN ?? "http://localhost:4173,http://localhost:63342";
  const rateLimiter = options.rateLimiter ?? createRateLimiter(options.rateLimit);
  const publicApiBasePath = options.publicApiBasePath ?? process.env.API_PUBLIC_BASE_PATH ?? "";
  const dao = store ? createMemoryDao(store) : createPostgresDao();
  const {
    dbGetUserByIdentifier, dbGetUserById, dbCreateUser, dbUpdateUser, dbGetAllUsers,
    dbCreateSession, dbGetSessionUser, dbDeleteSession,
    dbCreateVendorApplication, dbGetVendorApplicationById, dbGetVendorApplicationByUserId,
    dbGetAllVendorApplications, dbUpdateVendorApplication,
    dbGetProductById, dbGetProductsForVendor, dbGetPublicCatalog, dbGetAllProducts,
    dbCreateProduct, dbUpdateProductListing, dbUpdateProductModeration, dbDecrementProductQuantity,
    dbGetCart, dbUpsertCartItem, dbDeleteCartItem, dbClearCart,
    dbCreateOrderWithItems, dbCreateLedgerForOrder, dbGetOrderWithItems,
    dbGetOrdersForCustomer, dbGetOrdersForVendor, dbGetAllOrders, dbUpdateOrderStatus,
    dbGetPaymentById, dbGetAllPayments, dbUpdatePaymentStatus,
    dbGetVendorWallet, dbGetPayoutRequests, dbCreatePayoutRequest, dbUpdatePayoutStatus,
    dbCreateNotification, dbNotifyAdmins, dbGetNotifications, dbMarkNotificationRead,
    dbGetWishlist, dbAddWishlist, dbRemoveWishlist,
    dbGetReviews, dbGetVendorReviews, dbGetAllReviews, dbCreateReview, dbUpdateReview,
    dbCustomerHasDeliveredOrder,
    dbGetPromotions, dbGetActivePromotionForProduct, dbCreatePromotion, dbUpdatePromotion,
    dbGetCategories, dbUpsertCategory,
    dbSaveUpload, dbGetUpload,
    dbRecordSearchEvent, dbIncrementProductView, dbGetAnalytics,
  } = dao; // eslint-disable-line no-unused-vars

  async function handle(request, response) {
    const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    const method = request.method ?? "GET";
    const headers = corsHeaders(request, allowedOrigin);

    if (method === "OPTIONS") { response.writeHead(204, headers); response.end(); return; }
    // IP check only at the gate; per-user check happens after session resolution below.
    if (!await rateLimiter.check(request, null)) { sendError(response, 429, "rate_limited", "Too many requests."); return; }

    try {

      if (method === "GET" && requestUrl.pathname === "/health") {
        send(response, 200, { status: "ok", service: "kano-mart-api", db: "postgres" }, headers);
        return;
      }

      // ── AUTH ──────────────────────────────────────────────────────────────

      if (method === "POST" && requestUrl.pathname === "/auth/register") {
        const body = await readJson(request);
        const parsed = validateSignup(body);
        if (!parsed.valid) { sendError(response, 422, "validation_failed", "Check the highlighted fields.", parsed.errors); return; }

        const existing = await dbGetUserByIdentifier(parsed.value.phone);
        if (existing) { sendError(response, 409, "user_exists", "A user with this phone number already exists."); return; }
        if (parsed.value.email) {
          const existingEmail = await dbGetUserByIdentifier(parsed.value.email);
          if (existingEmail) { sendError(response, 409, "email_exists", "A user with this email already exists."); return; }
        }

        const isAdmin = normalizePhone(parsed.value.phone) === normalizePhone(adminPhone);
        const role = isAdmin ? "admin" : parsed.value.role;
        const firstName = isAdmin ? "Admin" : parsed.value.firstName;
        const lastName = isAdmin ? "" : parsed.value.lastName;
        const displayName = isAdmin ? "Kano Mart Admin" : `${firstName} ${lastName}`.trim();

        const user = await dbCreateUser({
          id: randomUUID(), phone: parsed.value.phone, email: parsed.value.email || null,
          passwordHash: await hashPassword(parsed.value.password), firstName, lastName, name: displayName,
          role, deliveryAddress: parsed.value.deliveryAddress || null,
          preferredLanguage: parsed.value.preferredLanguage,
          vendorStatus: role === "vendor" ? "pending" : null,
        });

        if (role === "vendor") {
          await dbCreateVendorApplication({
            id: randomUUID(), userId: user.id,
            businessName: parsed.value.businessName || displayName,
            phone: user.phone, area: parsed.value.area || "Kano",
            category: parsed.value.category || "essentials",
          });
          await dbNotifyAdmins({ title: "New vendor application", message: `${displayName} applied to become a vendor.`, type: "vendor" });
        }

        const session = await dbCreateSession(user.id);
        send(response, 201, { user: publicUser(user), token: session.token, expiresAt: session.expiresAt },
          { ...headers, "set-cookie": createCookie(session.token) });
        return;
      }

      if (method === "POST" && requestUrl.pathname === "/auth/login") {
        const body = await readJson(request);
        const identifier = String(body.identifier ?? body.phone ?? body.email ?? "").trim();
        const password = String(body.password ?? "");
        const user = await dbGetUserByIdentifier(identifier);
        if (!user || !(await verifyPassword(password, user.passwordHash))) {
          sendError(response, 401, "invalid_credentials", "Phone/email or password is incorrect."); return;
        }
        const session = await dbCreateSession(user.id);
        send(response, 200, { user: publicUser(user), token: session.token, expiresAt: session.expiresAt },
          { ...headers, "set-cookie": createCookie(session.token) });
        return;
      }

      if (method === "POST" && requestUrl.pathname === "/auth/logout") {
        const token = getSessionToken(request);
        await dbDeleteSession(token);
        send(response, 200, { ok: true }, { ...headers, "set-cookie": clearCookie() });
        return;
      }

      if (method === "GET" && requestUrl.pathname === "/me") {
        const user = await dbGetSessionUser(getSessionToken(request));
        if (!user) { sendError(response, 401, "unauthenticated", "Sign in is required."); return; }
        send(response, 200, { user: publicUser(user) }, headers);
        return;
      }

      if (method === "PATCH" && requestUrl.pathname === "/me") {
        const user = await dbGetSessionUser(getSessionToken(request));
        if (!await assertAuthenticated(response, user, request, rateLimiter)) return;
        const body = await readJson(request);
        const rawName = sanitizeText(String(body.name ?? ""), 120);
        const [firstName, ...nameParts] = rawName.trim().split(/\s+/);
        const updated = await dbUpdateUser(user.id, {
          name: rawName || undefined,
          firstName: firstName || undefined,
          lastName: nameParts.join(" ") || undefined,
          email: body.email ? normalizeEmail(String(body.email)) : undefined,
          deliveryAddress: body.deliveryAddress !== undefined ? sanitizeText(String(body.deliveryAddress), 180) : undefined,
          preferredLanguage: body.preferredLanguage === "ha" ? "ha" : body.preferredLanguage === "en" ? "en" : undefined,
        });
        send(response, 200, { user: publicUser(updated) }, headers);
        return;
      }

      // ── NOTIFICATIONS ─────────────────────────────────────────────────────

      if (method === "GET" && requestUrl.pathname === "/notifications") {
        const user = await dbGetSessionUser(getSessionToken(request));
        if (!await assertAuthenticated(response, user, request, rateLimiter)) return;
        const notifications = await dbGetNotifications(user.id);
        send(response, 200, { notifications: notifications.map(publicNotification) }, headers);
        return;
      }

      const notifMatch = requestUrl.pathname.match(/^\/notifications\/([^/]+)$/);
      if (method === "PATCH" && notifMatch) {
        const user = await dbGetSessionUser(getSessionToken(request));
        if (!await assertAuthenticated(response, user, request, rateLimiter)) return;
        const notif = await dbMarkNotificationRead(decodeURIComponent(notifMatch[1]), user.id);
        if (!notif) { sendError(response, 404, "notification_not_found", "Notification not found."); return; }
        send(response, 200, { notification: publicNotification(notif) }, headers);
        return;
      }

      // ── CATEGORIES ────────────────────────────────────────────────────────

      if (method === "GET" && requestUrl.pathname === "/categories") {
        const cats = await dbGetCategories();
        send(response, 200, { categories: cats.map(publicCategory) }, headers);
        return;
      }

      // ── UPLOADS ───────────────────────────────────────────────────────────

      const uploadMatch = requestUrl.pathname.match(/^\/uploads\/([^/]+)$/);
      if (method === "GET" && uploadMatch) {
        const upload = await dbGetUpload(decodeURIComponent(uploadMatch[1]));
        if (!upload) { sendError(response, 404, "upload_not_found", "Upload not found."); return; }
        // New uploads: redirect to Vercel Blob CDN URL (no DB read cost)
        if (upload.blobUrl || (!upload.dataUrl)) {
          const dest = upload.blobUrl ?? upload.url;
          response.writeHead(301, { location: dest, "cache-control": "public, max-age=31536000, immutable" });
          response.end();
          return;
        }
        // Legacy uploads: serve the stored base64 (backward compat)
        const base64 = upload.dataUrl.slice(upload.dataUrl.indexOf(",") + 1);
        response.writeHead(200, { "content-type": upload.mimeType, "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff" });
        response.end(Buffer.from(base64, "base64"));
        return;
      }

      // ── VENDOR ────────────────────────────────────────────────────────────

      if (method === "GET" && requestUrl.pathname === "/vendor/application") {
        const user = await dbGetSessionUser(getSessionToken(request));
        if (!await assertAuthenticated(response, user, request, rateLimiter)) return;
        if (user.role !== "vendor") { sendError(response, 403, "forbidden", "Vendor access required."); return; }
        const app = await dbGetVendorApplicationByUserId(user.id);
        if (!app) { sendError(response, 404, "vendor_application_not_found", "Application not found."); return; }
        send(response, 200, { application: publicVendorApplication(app) }, headers);
        return;
      }

      if (method === "GET" && requestUrl.pathname === "/vendor/products") {
        const user = await dbGetSessionUser(getSessionToken(request));
        if (!await assertAuthenticated(response, user, request, rateLimiter)) return;
        if (user.role !== "vendor") { sendError(response, 403, "forbidden", "Vendor access required."); return; }
        const pg = parsePagination(requestUrl, 100);
        const products = await dbGetProductsForVendor(user.id, pg);
        send(response, 200, { products: products.map((p) => publicProduct(p, { includeAdminFields: true })), page: pg.page, limit: pg.limit }, headers);
        return;
      }

      if (method === "POST" && requestUrl.pathname === "/vendor/products") {
        const user = await dbGetSessionUser(getSessionToken(request));
        if (!await assertAuthenticated(response, user, request, rateLimiter)) return;
        if (user.role !== "vendor") { sendError(response, 403, "forbidden", "Vendor access required."); return; }
        if (user.vendorStatus !== "approved") { sendError(response, 403, "vendor_not_approved", "Vendor approval required."); return; }
        const body = await readJson(request);
        const parsed = validateProductInput(body);
        if (!parsed.valid) { sendError(response, 422, "validation_failed", "Check the highlighted fields.", parsed.errors); return; }
        const product = await dbCreateProduct(user.id, user.name, parsed.value);
        send(response, 201, { product: publicProduct(product, { includeAdminFields: true }) }, headers);
        return;
      }

      if (method === "POST" && requestUrl.pathname === "/vendor/uploads") {
        const user = await dbGetSessionUser(getSessionToken(request));
        if (!await assertAuthenticated(response, user, request, rateLimiter)) return;
        if (user.role !== "vendor") { sendError(response, 403, "forbidden", "Vendor access required."); return; }
        if (user.vendorStatus !== "approved") { sendError(response, 403, "vendor_not_approved", "Vendor approval required."); return; }
        const parsed = validateUploadInput(await readJson(request));
        if (!parsed.valid) { sendError(response, 422, "validation_failed", "Check the highlighted fields.", parsed.errors); return; }

        const uploadId = randomUUID();
        const base64Data = parsed.value.dataUrl.replace(/^data:[^;]+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        const ext = parsed.value.mimeType === "image/png" ? "png" : parsed.value.mimeType === "image/webp" ? "webp" : "jpg";
        const blobPath = `products/${uploadId}.${ext}`;

        let finalUrl;
        let blobUrl = null;
        let storedDataUrl = null;

        if (process.env.BLOB_READ_WRITE_TOKEN) {
          const blob = await blobPut(blobPath, buffer, {
            access: "public",
            contentType: parsed.value.mimeType,
            token: process.env.BLOB_READ_WRITE_TOKEN,
          });
          blobUrl = blob.url;
          finalUrl = blobUrl;
        } else {
          // No Blob token — fall back to dataUrl storage (suitable for local dev / small pilots).
          storedDataUrl = parsed.value.dataUrl;
          finalUrl = `/uploads/${uploadId}`;
        }

        const upload = await dbSaveUpload({
          id: uploadId, vendorUserId: user.id, fileName: parsed.value.fileName,
          mimeType: parsed.value.mimeType,
          dataUrl: storedDataUrl,
          blobUrl,
          url: finalUrl,
        });
        send(response, 201, { upload: { id: upload.id, url: finalUrl, fileName: upload.fileName, mimeType: upload.mimeType } }, headers);
        return;
      }

      const vendorProductMatch = requestUrl.pathname.match(/^\/vendor\/products\/([^/]+)$/);
      if (method === "PATCH" && vendorProductMatch) {
        const user = await dbGetSessionUser(getSessionToken(request));
        if (!await assertAuthenticated(response, user, request, rateLimiter)) return;
        if (user.role !== "vendor") { sendError(response, 403, "forbidden", "Vendor access required."); return; }
        const product = await dbGetProductById(decodeURIComponent(vendorProductMatch[1]));
        if (!product || product.vendorUserId !== user.id) { sendError(response, 404, "product_not_found", "Product not found."); return; }
        const body = await readJson(request);
        const parsed = validateListingStatus(body);
        if (!parsed.valid) { sendError(response, 422, "validation_failed", "Check the highlighted fields.", parsed.errors); return; }
        const updated = await dbUpdateProductListing(product.id, parsed.value.listingStatus);
        send(response, 200, { product: publicProduct(updated, { includeAdminFields: true }) }, headers);
        return;
      }

      // ── PRODUCTS ──────────────────────────────────────────────────────────

      if (method === "GET" && requestUrl.pathname === "/products") {
        const category = requestUrl.searchParams.get("category")?.toLowerCase();
        const query = requestUrl.searchParams.get("q")?.trim().toLowerCase();
        const pg = parsePagination(requestUrl, 60);
        if (query) await dbRecordSearchEvent(query);
        const products = await dbGetPublicCatalog(category, query, pg);
        send(response, 200, { products: products.map((p) => publicProduct(p)), page: pg.page, limit: pg.limit }, headers);
        return;
      }

      const productDetailMatch = requestUrl.pathname.match(/^\/products\/([^/]+)$/);
      if (method === "GET" && productDetailMatch) {
        const product = await dbGetProductById(decodeURIComponent(productDetailMatch[1]), true);
        if (!product || product.moderationStatus !== "approved" || product.listingStatus !== "active") {
          sendError(response, 404, "product_not_found", "Product not found."); return;
        }
        await dbIncrementProductView(product.id);
        send(response, 200, { product: publicProduct(product) }, headers);
        return;
      }

      // ── WISHLIST ──────────────────────────────────────────────────────────

      if (method === "GET" && requestUrl.pathname === "/wishlist") {
        const user = await dbGetSessionUser(getSessionToken(request));
        if (!await assertAuthenticated(response, user, request, rateLimiter)) return;
        if (user.role !== "customer") { sendError(response, 403, "forbidden", "Customer access required."); return; }
        const pg = parsePagination(requestUrl, 100);
        const products = await dbGetWishlist(user.id, pg);
        send(response, 200, { products: products.map((p) => publicProduct(p)), page: pg.page, limit: pg.limit }, headers);
        return;
      }

      if (method === "POST" && requestUrl.pathname === "/wishlist") {
        const user = await dbGetSessionUser(getSessionToken(request));
        if (!await assertAuthenticated(response, user, request, rateLimiter)) return;
        if (user.role !== "customer") { sendError(response, 403, "forbidden", "Customer access required."); return; }
        const body = await readJson(request);
        const product = await dbGetProductById(String(body.productId ?? ""), true);
        if (!product || product.moderationStatus !== "approved" || product.listingStatus !== "active") {
          sendError(response, 404, "product_not_found", "Product not found."); return;
        }
        await dbAddWishlist(user.id, product.id);
        const products = await dbGetWishlist(user.id);
        send(response, 200, { products: products.map((p) => publicProduct(p)) }, headers);
        return;
      }

      const wishlistMatch = requestUrl.pathname.match(/^\/wishlist\/([^/]+)$/);
      if (method === "DELETE" && wishlistMatch) {
        const user = await dbGetSessionUser(getSessionToken(request));
        if (!await assertAuthenticated(response, user, request, rateLimiter)) return;
        if (user.role !== "customer") { sendError(response, 403, "forbidden", "Customer access required."); return; }
        await dbRemoveWishlist(user.id, decodeURIComponent(wishlistMatch[1]));
        const products = await dbGetWishlist(user.id);
        send(response, 200, { products: products.map((p) => publicProduct(p)) }, headers);
        return;
      }

      // ── REVIEWS ───────────────────────────────────────────────────────────

      if (method === "GET" && requestUrl.pathname.match(/^\/products\/[^/]+\/reviews$/)) {
        const productId = decodeURIComponent(requestUrl.pathname.split("/")[2]);
        const pg = parsePagination(requestUrl, 50);
        const reviews = await dbGetReviews(productId, false, pg);
        send(response, 200, { reviews: reviews.map(publicReview), page: pg.page, limit: pg.limit }, headers);
        return;
      }

      if (method === "POST" && requestUrl.pathname === "/reviews") {
        const user = await dbGetSessionUser(getSessionToken(request));
        if (!await assertAuthenticated(response, user, request, rateLimiter)) return;
        if (user.role !== "customer") { sendError(response, 403, "forbidden", "Customer access required."); return; }
        const body = await readJson(request);
        const parsed = validateReviewInput(body);
        if (!parsed.valid) { sendError(response, 422, "validation_failed", "Check the highlighted fields.", parsed.errors); return; }
        const product = await dbGetProductById(parsed.value.productId, true);
        if (!product) { sendError(response, 404, "product_not_found", "Product not found."); return; }
        const canReview = await dbCustomerHasDeliveredOrder(user.id, parsed.value.productId);
        if (!canReview) { sendError(response, 403, "review_not_allowed", "Only customers with delivered orders can review this product."); return; }
        const review = await dbCreateReview({ productId: parsed.value.productId, vendorUserId: product.vendorUserId, customerUserId: user.id, reviewerName: user.name, rating: parsed.value.rating, comment: parsed.value.comment });
        await dbCreateNotification({ audience: "vendor", recipientUserId: product.vendorUserId, title: "New product review", message: `${user.name} reviewed ${product.name.en}.`, type: "review", productId: product.id });
        send(response, 201, { review: publicReview(review) }, headers);
        return;
      }

      // ── CART ──────────────────────────────────────────────────────────────

      if (method === "GET" && requestUrl.pathname === "/cart") {
        const user = await dbGetSessionUser(getSessionToken(request));
        if (!await assertAuthenticated(response, user, request, rateLimiter)) return;
        if (user.role !== "customer") { sendError(response, 403, "forbidden", "Customer access required."); return; }
        const cartRows = await dbGetCart(user.id);
        const items = cartRows.map((r) => {
          const product = productFromRow(r);
          return { productId: r.product_id, quantity: r.quantity, product: publicProduct(product), lineTotal: product.price * r.quantity, addedAt: r.added_at, updatedAt: r.updated_at };
        });
        send(response, 200, { cart: { items, subtotal: items.reduce((t, i) => t + i.lineTotal, 0) } }, headers);
        return;
      }

      if (method === "POST" && requestUrl.pathname === "/cart/items") {
        const user = await dbGetSessionUser(getSessionToken(request));
        if (!await assertAuthenticated(response, user, request, rateLimiter)) return;
        if (user.role !== "customer") { sendError(response, 403, "forbidden", "Customer access required."); return; }
        const body = await readJson(request);
        const parsed = validateCartItem(body);
        if (!parsed.valid) { sendError(response, 422, "validation_failed", "Check the highlighted fields.", parsed.errors); return; }
        const product = await dbGetProductById(parsed.value.productId, true);
        if (!product || product.moderationStatus !== "approved" || product.listingStatus !== "active") { sendError(response, 404, "product_not_found", "Product not found."); return; }
        if (product.quantityAvailable < parsed.value.quantity) { sendError(response, 409, "insufficient_stock", `${product.name.en} has only ${product.quantityAvailable} available.`); return; }
        await dbUpsertCartItem(user.id, parsed.value.productId, parsed.value.quantity);
        const cartRows = await dbGetCart(user.id);
        const items = cartRows.map((r) => { const p = productFromRow(r); return { productId: r.product_id, quantity: r.quantity, product: publicProduct(p), lineTotal: p.price * r.quantity, addedAt: r.added_at, updatedAt: r.updated_at }; });
        send(response, 200, { cart: { items, subtotal: items.reduce((t, i) => t + i.lineTotal, 0) } }, headers);
        return;
      }

      const cartItemMatch = requestUrl.pathname.match(/^\/cart\/items\/([^/]+)$/);
      if ((method === "PATCH" || method === "DELETE") && cartItemMatch) {
        const user = await dbGetSessionUser(getSessionToken(request));
        if (!await assertAuthenticated(response, user, request, rateLimiter)) return;
        if (user.role !== "customer") { sendError(response, 403, "forbidden", "Customer access required."); return; }
        const productId = decodeURIComponent(cartItemMatch[1]);
        if (method === "DELETE") {
          await dbDeleteCartItem(user.id, productId);
        } else {
          const body = await readJson(request);
          const parsed = validateCartItem({ ...body, productId });
          if (!parsed.valid) { sendError(response, 422, "validation_failed", "Check the highlighted fields.", parsed.errors); return; }
          const product = await dbGetProductById(productId, true);
          if (!product || product.moderationStatus !== "approved" || product.listingStatus !== "active") { sendError(response, 404, "product_not_found", "Product not found."); return; }
          if (product.quantityAvailable < parsed.value.quantity) { sendError(response, 409, "insufficient_stock", `${product.name.en} has only ${product.quantityAvailable} available.`); return; }
          await dbUpsertCartItem(user.id, productId, parsed.value.quantity);
        }
        const cartRows = await dbGetCart(user.id);
        const items = cartRows.map((r) => { const p = productFromRow(r); return { productId: r.product_id, quantity: r.quantity, product: publicProduct(p), lineTotal: p.price * r.quantity, addedAt: r.added_at, updatedAt: r.updated_at }; });
        send(response, 200, { cart: { items, subtotal: items.reduce((t, i) => t + i.lineTotal, 0) } }, headers);
        return;
      }

      // ── CHECKOUT ──────────────────────────────────────────────────────────

      if (method === "POST" && requestUrl.pathname === "/checkout") {
        const user = await dbGetSessionUser(getSessionToken(request));
        if (!await assertAuthenticated(response, user, request, rateLimiter)) return;
        if (user.role !== "customer") { sendError(response, 403, "forbidden", "Customer access required."); return; }
        const body = await readJson(request);
        const parsed = validateCheckout(body);
        if (!parsed.valid) { sendError(response, 422, "validation_failed", "Check the highlighted fields.", parsed.errors); return; }

        const cartRows = await dbGetCart(user.id);
        if (!cartRows.length) { sendError(response, 409, "cart_empty", "Cart is empty."); return; }

        const orderItems = [];
        for (const row of cartRows) {
          const product = productFromRow(row);
          if (product.moderationStatus !== "approved" || product.listingStatus !== "active") { sendError(response, 409, "product_unavailable", "One or more products in your cart are no longer available."); return; }
          if (product.quantityAvailable < row.quantity) { sendError(response, 409, "insufficient_stock", `${product.name.en} has only ${product.quantityAvailable} available.`); return; }
          const promo = await dbGetActivePromotionForProduct(product, parsed.value.promotionCode);
          const unitPrice = promo ? Math.max(0, Math.round(product.price * (1 - promo.discountPercent / 100))) : product.price;
          const discountAmount = (product.price - unitPrice) * row.quantity;
          const lineTotal = unitPrice * row.quantity;
          const commissionRate = 0.1;
          const commissionAmount = Math.round(lineTotal * commissionRate);
          orderItems.push({ productId: product.id, vendorUserId: product.vendorUserId, vendorName: product.vendorName, name: product.name, unitPrice, originalUnitPrice: product.price, quantity: row.quantity, lineTotal, discountAmount, promotionId: promo?.id, commissionRate, commissionAmount, vendorPayout: lineTotal - commissionAmount });
        }

        const itemsSubtotal = orderItems.reduce((t, i) => t + i.lineTotal, 0);
        const deliveryFee = calcDeliveryFee(parsed.value.deliveryOption);
        const now = new Date().toISOString();
        const paymentStatus = paymentStatusForMethod(parsed.value.paymentMethod);
        const paymentId = randomUUID();
        const order = {
          id: `KM-${randomUUID().slice(0, 8).toUpperCase()}`,
          customerUserId: user.id, customerName: user.name, customerPhone: user.phone,
          deliveryOption: parsed.value.deliveryOption, deliveryAddress: parsed.value.deliveryOption === "delivery" ? parsed.value.deliveryAddress : undefined,
          deliveryArea: parsed.value.deliveryArea, deliveryFee,
          paymentMethod: parsed.value.paymentMethod, paymentReference: `KM-PAY-${randomUUID().slice(0, 10).toUpperCase()}`,
          paymentStatus, itemsSubtotal, subtotal: itemsSubtotal + deliveryFee,
          commissionTotal: orderItems.reduce((t, i) => t + i.commissionAmount, 0),
          vendorPayoutTotal: orderItems.reduce((t, i) => t + i.vendorPayout, 0),
        };
        const payment = { id: paymentId, orderId: order.id, reference: order.paymentReference, method: order.paymentMethod, gateway: paymentGatewayForMethod(order.paymentMethod), amount: order.subtotal, currency: "NGN", status: paymentStatus, verifiedAt: paymentStatus === "paid" ? now : null };

        // Decrement stock atomically — fails fast if a concurrent checkout took the last unit.
        for (const item of orderItems) {
          const ok = await dbDecrementProductQuantity(item.productId, item.quantity);
          if (!ok) {
            sendError(response, 409, "out_of_stock", `"${item.name.en}" is no longer available in the requested quantity.`); return;
          }
        }
        await dbCreateOrderWithItems(order, orderItems, payment);
        await dbClearCart(user.id);

        await dbCreateNotification({ audience: "customer", recipientUserId: user.id, title: "Order placed", message: `Order ${order.id} has been placed.`, type: "order", orderId: order.id });
        await dbNotifyAdmins({ title: "New order", message: `Order ${order.id} is awaiting confirmation.`, type: "order", orderId: order.id });
        for (const vendorId of new Set(orderItems.map((i) => i.vendorUserId))) {
          await dbCreateNotification({ audience: "vendor", recipientUserId: vendorId, title: "New order", message: `Order ${order.id} includes your product.`, type: "order", orderId: order.id });
        }

        const placedOrder = await dbGetOrderWithItems(order.id);
        send(response, 201, { order: publicOrder(placedOrder), cart: { items: [], subtotal: 0 } }, headers);
        // Fire-and-forget emails — never block the response
        if (user.email) void sendEmail({ to: user.email, subject: `Order ${order.id} confirmed — Kano Mart`, html: orderConfirmationEmail(placedOrder, user.name) });
        for (const vendorId of new Set(orderItems.map((i) => i.vendorUserId))) {
          dbGetUserById(vendorId).then((v) => {
            if (v?.email) void sendEmail({ to: v.email, subject: `New order ${order.id} — Kano Mart`, html: vendorNewOrderEmail(v.name, placedOrder) });
          }).catch(() => {});
        }
        return;
      }

      // ── ORDERS ────────────────────────────────────────────────────────────

      if (method === "GET" && requestUrl.pathname === "/orders") {
        const user = await dbGetSessionUser(getSessionToken(request));
        if (!await assertAuthenticated(response, user, request, rateLimiter)) return;
        if (user.role !== "customer") { sendError(response, 403, "forbidden", "Customer access required."); return; }
        const pg = parsePagination(requestUrl, 50);
        const orders = await dbGetOrdersForCustomer(user.id, pg);
        send(response, 200, { orders: orders.map(publicOrder), page: pg.page, limit: pg.limit }, headers);
        return;
      }

      if (method === "GET" && requestUrl.pathname === "/vendor/orders") {
        const user = await dbGetSessionUser(getSessionToken(request));
        if (!await assertAuthenticated(response, user, request, rateLimiter)) return;
        if (user.role !== "vendor") { sendError(response, 403, "forbidden", "Vendor access required."); return; }
        const pg = parsePagination(requestUrl, 50);
        const orders = await dbGetOrdersForVendor(user.id, pg);
        send(response, 200, { orders: orders.map(publicOrder), page: pg.page, limit: pg.limit }, headers);
        return;
      }

      if (method === "GET" && requestUrl.pathname === "/vendor/reviews") {
        const user = await dbGetSessionUser(getSessionToken(request));
        if (!await assertAuthenticated(response, user, request, rateLimiter)) return;
        if (user.role !== "vendor") { sendError(response, 403, "forbidden", "Vendor access required."); return; }
        const pg = parsePagination(requestUrl, 50);
        const reviews = await dbGetVendorReviews(user.id, pg);
        send(response, 200, { reviews: reviews.map(publicReview), page: pg.page, limit: pg.limit }, headers);
        return;
      }

      if (method === "GET" && requestUrl.pathname === "/vendor/wallet") {
        const user = await dbGetSessionUser(getSessionToken(request));
        if (!await assertAuthenticated(response, user, request, rateLimiter)) return;
        if (user.role !== "vendor") { sendError(response, 403, "forbidden", "Vendor access required."); return; }
        const wallet = await dbGetVendorWallet(user.id);
        const payouts = await dbGetPayoutRequests(user.id);
        send(response, 200, { wallet, payouts: payouts.map(publicPayoutRequest) }, headers);
        return;
      }

      if (method === "POST" && requestUrl.pathname === "/vendor/payouts") {
        const user = await dbGetSessionUser(getSessionToken(request));
        if (!await assertAuthenticated(response, user, request, rateLimiter)) return;
        if (user.role !== "vendor") { sendError(response, 403, "forbidden", "Vendor access required."); return; }
        const body = await readJson(request);
        const parsed = validatePayoutInput(body);
        if (!parsed.valid) { sendError(response, 422, "validation_failed", "Check the highlighted fields.", parsed.errors); return; }
        const wallet = await dbGetVendorWallet(user.id);
        if (parsed.value.amount > wallet.availableBalance) { sendError(response, 409, "insufficient_wallet_balance", "Payout exceeds available balance."); return; }
        const payout = await dbCreatePayoutRequest({ id: randomUUID(), vendorUserId: user.id, ...parsed.value });
        await dbNotifyAdmins({ title: "New payout request", message: `${user.name} requested NGN ${payout.amount}.`, type: "payout" });
        send(response, 201, { payout: publicPayoutRequest(payout) }, headers);
        return;
      }

      // ── ADMIN ─────────────────────────────────────────────────────────────

      if (method === "GET" && requestUrl.pathname === "/admin/users") {
        const user = await dbGetSessionUser(getSessionToken(request));
        if (!assertAdmin(response, user)) return;
        const pg = parsePagination(requestUrl, 100);
        const users = await dbGetAllUsers(pg);
        send(response, 200, { users: users.map(publicUser), page: pg.page, limit: pg.limit }, headers);
        return;
      }

      if (method === "POST" && requestUrl.pathname === "/admin/categories") {
        const user = await dbGetSessionUser(getSessionToken(request));
        if (!assertAdmin(response, user)) return;
        const body = await readJson(request);
        const parsed = validateCategoryInput(body);
        if (!parsed.valid) { sendError(response, 422, "validation_failed", "Check the highlighted fields.", parsed.errors); return; }
        const cat = await dbUpsertCategory(parsed.value);
        send(response, 200, { category: publicCategory(cat) }, headers);
        return;
      }

      if (method === "GET" && requestUrl.pathname === "/admin/promotions") {
        const user = await dbGetSessionUser(getSessionToken(request));
        if (!assertAdmin(response, user)) return;
        const pg = parsePagination(requestUrl, 100);
        const promotions = await dbGetPromotions(false, pg);
        send(response, 200, { promotions: promotions.map((p) => ({ id: p.id, title: { en: p.titleEn ?? p.title_en, ha: p.titleHa ?? p.title_ha }, type: p.type, discountPercent: p.discountPercent ?? p.discount_percent, code: p.code, productId: p.productId ?? p.product_id, vendorUserId: p.vendorUserId ?? p.vendor_user_id, category: p.category, active: p.active, startsAt: p.startsAt ?? p.starts_at, endsAt: p.endsAt ?? p.ends_at, createdAt: p.createdAt ?? p.created_at })), page: pg.page, limit: pg.limit }, headers);
        return;
      }

      if (method === "POST" && requestUrl.pathname === "/admin/promotions") {
        const user = await dbGetSessionUser(getSessionToken(request));
        if (!assertAdmin(response, user)) return;
        const body = await readJson(request);
        const parsed = validatePromotionInput(body);
        if (!parsed.valid) { sendError(response, 422, "validation_failed", "Check the highlighted fields.", parsed.errors); return; }
        const promo = await dbCreatePromotion(parsed.value);
        send(response, 201, { promotion: { id: promo.id, title: { en: promo.titleEn ?? promo.title_en, ha: promo.titleHa ?? promo.title_ha }, type: promo.type, discountPercent: promo.discountPercent ?? promo.discount_percent, active: promo.active } }, headers);
        return;
      }

      const adminPromoMatch = requestUrl.pathname.match(/^\/admin\/promotions\/([^/]+)$/);
      if (method === "PATCH" && adminPromoMatch) {
        const user = await dbGetSessionUser(getSessionToken(request));
        if (!assertAdmin(response, user)) return;
        const body = await readJson(request);
        const promo = await dbUpdatePromotion(decodeURIComponent(adminPromoMatch[1]), typeof body.active === "boolean" ? body.active : true);
        if (!promo) { sendError(response, 404, "promotion_not_found", "Promotion not found."); return; }
        send(response, 200, { promotion: promo }, headers);
        return;
      }

      if (method === "GET" && requestUrl.pathname === "/admin/reviews") {
        const user = await dbGetSessionUser(getSessionToken(request));
        if (!assertAdmin(response, user)) return;
        const pg = parsePagination(requestUrl, 100);
        const reviews = await dbGetAllReviews(pg);
        send(response, 200, { reviews: reviews.map(publicReview), page: pg.page, limit: pg.limit }, headers);
        return;
      }

      const adminReviewMatch = requestUrl.pathname.match(/^\/admin\/reviews\/([^/]+)$/);
      if (method === "PATCH" && adminReviewMatch) {
        const user = await dbGetSessionUser(getSessionToken(request));
        if (!assertAdmin(response, user)) return;
        const body = await readJson(request);
        const review = await dbUpdateReview(decodeURIComponent(adminReviewMatch[1]), Boolean(body.hidden), sanitizeText(body.adminNote ?? "", 500));
        if (!review) { sendError(response, 404, "review_not_found", "Review not found."); return; }
        send(response, 200, { review: publicReview(review) }, headers);
        return;
      }

      if (method === "GET" && requestUrl.pathname === "/admin/payouts") {
        const user = await dbGetSessionUser(getSessionToken(request));
        if (!assertAdmin(response, user)) return;
        const pg = parsePagination(requestUrl, 100);
        const payouts = await dbGetPayoutRequests(null, pg);
        send(response, 200, { payouts: payouts.map(publicPayoutRequest), page: pg.page, limit: pg.limit }, headers);
        return;
      }

      const adminPayoutMatch = requestUrl.pathname.match(/^\/admin\/payouts\/([^/]+)$/);
      if (method === "PATCH" && adminPayoutMatch) {
        const user = await dbGetSessionUser(getSessionToken(request));
        if (!assertAdmin(response, user)) return;
        const payoutId = decodeURIComponent(adminPayoutMatch[1]);
        const payouts = await dbGetPayoutRequests(null);
        const payout = payouts.find((p) => p.id === payoutId);
        if (!payout) { sendError(response, 404, "payout_not_found", "Payout not found."); return; }
        if (payout.status !== "pending") { sendError(response, 409, "payout_already_reviewed", "Payout already reviewed."); return; }
        const decision = validatePayoutDecision(await readJson(request));
        if (!decision.valid) { sendError(response, 422, "validation_failed", "Check the highlighted fields.", decision.errors); return; }
        if (decision.value.status === "approved") {
          const wallet = await dbGetVendorWallet(payout.vendorUserId ?? payout.vendor_user_id);
          if (payout.amount > wallet.availableBalance) { sendError(response, 409, "insufficient_wallet_balance", "Payout exceeds available balance."); return; }
        }
        const vendorId = payout.vendorUserId ?? payout.vendor_user_id;
        const updated = await dbUpdatePayoutStatus(payoutId, vendorId, decision.value.status, decision.value.adminNote, payout.amount);
        await dbCreateNotification({ audience: "vendor", recipientUserId: vendorId, title: `Payout ${updated.status}`, message: `Your payout of NGN ${payout.amount} was ${updated.status}.`, type: "payout" });
        send(response, 200, { payout: publicPayoutRequest(updated) }, headers);
        dbGetUserById(vendorId).then((v) => {
          if (v?.email) void sendEmail({ to: v.email, subject: `Payout ${updated.status} — Kano Mart`, html: payoutDecisionEmail(v.name, payout.amount, updated.status === "approved") });
        }).catch(() => {});
        return;
      }

      if (method === "GET" && requestUrl.pathname === "/admin/analytics") {
        const user = await dbGetSessionUser(getSessionToken(request));
        if (!assertAdmin(response, user)) return;
        const analytics = await dbGetAnalytics();
        send(response, 200, { analytics }, headers);
        return;
      }

      if (method === "GET" && requestUrl.pathname === "/admin/orders") {
        const user = await dbGetSessionUser(getSessionToken(request));
        if (!assertAdmin(response, user)) return;
        const pg = parsePagination(requestUrl, 100);
        const orders = await dbGetAllOrders(pg);
        send(response, 200, { orders: orders.map(publicOrder), page: pg.page, limit: pg.limit }, headers);
        return;
      }

      const adminOrderMatch = requestUrl.pathname.match(/^\/admin\/orders\/([^/]+)$/);
      if (method === "PATCH" && adminOrderMatch) {
        const user = await dbGetSessionUser(getSessionToken(request));
        if (!assertAdmin(response, user)) return;
        const orderId = decodeURIComponent(adminOrderMatch[1]);
        const order = await dbGetOrderWithItems(orderId);
        if (!order) { sendError(response, 404, "order_not_found", "Order not found."); return; }
        const body = await readJson(request);
        const parsed = validateOrderStatusInput(body);
        if (!parsed.valid) { sendError(response, 422, "validation_failed", "Check the highlighted fields.", parsed.errors); return; }
        const allowed = getAllowedNextStatuses(order);
        if (!allowed.includes(parsed.value.status)) { sendError(response, 409, "invalid_order_transition", `Cannot move from ${order.status} to ${parsed.value.status}.`); return; }
        await dbUpdateOrderStatus(orderId, parsed.value.status, parsed.value.deliveryPerson);
        await dbCreateNotification({ audience: "customer", recipientUserId: order.customerUserId, title: parsed.value.status === "delivered" ? "Order delivered" : "Order updated", message: `Order ${orderId} is now ${parsed.value.status}.`, type: parsed.value.status === "delivered" ? "delivery" : "order", orderId });
        const updated = await dbGetOrderWithItems(orderId);
        send(response, 200, { order: publicOrder(updated) }, headers);
        dbGetUserById(order.customerUserId).then((c) => {
          if (c?.email) void sendEmail({ to: c.email, subject: `Order ${orderId} update — Kano Mart`, html: orderStatusEmail({ ...order, status: parsed.value.status }, c.name) });
        }).catch(() => {});
        return;
      }

      if (method === "GET" && requestUrl.pathname === "/admin/payments") {
        const user = await dbGetSessionUser(getSessionToken(request));
        if (!assertAdmin(response, user)) return;
        const pg = parsePagination(requestUrl, 100);
        const payments = await dbGetAllPayments(pg);
        send(response, 200, { payments: payments.map(publicPayment), page: pg.page, limit: pg.limit }, headers);
        return;
      }

      const adminPaymentMatch = requestUrl.pathname.match(/^\/admin\/payments\/([^/]+)$/);
      if (method === "PATCH" && adminPaymentMatch) {
        const user = await dbGetSessionUser(getSessionToken(request));
        if (!assertAdmin(response, user)) return;
        const paymentId = decodeURIComponent(adminPaymentMatch[1]);
        const payment = await dbGetPaymentById(paymentId);
        if (!payment) { sendError(response, 404, "payment_not_found", "Payment not found."); return; }
        const body = await readJson(request);
        const decision = validatePaymentDecision(body);
        if (!decision.valid) { sendError(response, 422, "validation_failed", "Check the highlighted fields.", decision.errors); return; }
        const order = await dbGetOrderWithItems(payment.orderId);
        if (decision.value.status === "paid" && order?.status === "cancelled") { sendError(response, 409, "order_cancelled", "Cannot confirm payment for a cancelled order."); return; }
        await dbUpdatePaymentStatus(paymentId, payment.orderId, decision.value.status, decision.value.adminNote);
        const updatedPayment = await dbGetPaymentById(paymentId);
        const updatedOrder = await dbGetOrderWithItems(payment.orderId);
        await dbCreateNotification({ audience: "customer", recipientUserId: updatedOrder.customerUserId, title: decision.value.status === "paid" ? "Payment successful" : decision.value.status === "failed" ? "Payment failed" : "Payment refunded", message: `Payment for order ${payment.orderId} is ${decision.value.status}.`, type: "payment", orderId: payment.orderId });
        if (decision.value.status === "paid") {
          for (const vendorId of new Set(updatedOrder.items.map((i) => i.vendorUserId))) {
            await dbCreateNotification({ audience: "vendor", recipientUserId: vendorId, title: "Payment confirmed", message: `Payment confirmed for order ${payment.orderId}.`, type: "payment", orderId: payment.orderId });
          }
        }
        send(response, 200, { payment: publicPayment(updatedPayment), order: publicOrder(updatedOrder) }, headers);
        dbGetUserById(updatedOrder.customerUserId).then((c) => {
          if (c?.email) void sendEmail({ to: c.email, subject: `Payment ${decision.value.status} for order ${payment.orderId} — Kano Mart`, html: paymentStatusEmail(updatedOrder, c.name, decision.value.status) });
        }).catch(() => {});
        return;
      }

      if (method === "GET" && requestUrl.pathname === "/admin/products") {
        const user = await dbGetSessionUser(getSessionToken(request));
        if (!assertAdmin(response, user)) return;
        const status = requestUrl.searchParams.get("status");
        const pg = parsePagination(requestUrl, 100);
        const products = await dbGetAllProducts(status, pg);
        send(response, 200, { products: products.map((p) => publicProduct(p, { includeAdminFields: true })) }, headers);
        return;
      }

      const productModerationMatch = requestUrl.pathname.match(/^\/admin\/products\/([^/]+)$/);
      if (method === "PATCH" && productModerationMatch) {
        const user = await dbGetSessionUser(getSessionToken(request));
        if (!assertAdmin(response, user)) return;
        const productId = decodeURIComponent(productModerationMatch[1]);
        const product = await dbGetProductById(productId, true);
        if (!product) { sendError(response, 404, "product_not_found", "Product not found."); return; }
        const body = await readJson(request);
        const decision = validateProductModeration(body);
        if (!decision.valid) { sendError(response, 422, "validation_failed", "Check the highlighted fields.", decision.errors); return; }
        const updated = await dbUpdateProductModeration(productId, decision.value.status, decision.value.reviewNote);
        await dbCreateNotification({ audience: "vendor", recipientUserId: product.vendorUserId, title: `Product ${decision.value.status}`, message: `${product.name.en} was ${decision.value.status}.`, type: "product", productId });
        send(response, 200, { product: publicProduct(updated, { includeAdminFields: true }) }, headers);
        return;
      }

      if (method === "GET" && requestUrl.pathname === "/admin/vendor-applications") {
        const user = await dbGetSessionUser(getSessionToken(request));
        if (!assertAdmin(response, user)) return;
        const status = requestUrl.searchParams.get("status");
        const pg = parsePagination(requestUrl, 100);
        const apps = await dbGetAllVendorApplications(status, pg);
        send(response, 200, { applications: apps.map(publicVendorApplication), page: pg.page, limit: pg.limit }, headers);
        return;
      }

      const vendorDecisionMatch = requestUrl.pathname.match(/^\/admin\/vendor-applications\/([^/]+)$/);
      if (method === "PATCH" && vendorDecisionMatch) {
        const user = await dbGetSessionUser(getSessionToken(request));
        if (!assertAdmin(response, user)) return;
        const appRow = await dbGetVendorApplicationById(decodeURIComponent(vendorDecisionMatch[1]));
        if (!appRow) { sendError(response, 404, "vendor_application_not_found", "Application not found."); return; }
        const body = await readJson(request);
        const decision = validateVendorDecision(body);
        if (!decision.valid) { sendError(response, 422, "validation_failed", "Check the highlighted fields.", decision.errors); return; }
        await dbUpdateVendorApplication(appRow.id, appRow.user_id, decision.value.status, decision.value.adminNote);
        await dbCreateNotification({ audience: "vendor", recipientUserId: appRow.user_id, title: decision.value.status === "approved" ? "Vendor approved" : "Vendor rejected", message: `Your vendor application was ${decision.value.status}.`, type: "vendor" });
        const updated = await dbGetVendorApplicationById(appRow.id);
        send(response, 200, { application: publicVendorApplication(updated) }, headers);
        dbGetUserById(appRow.user_id).then((v) => {
          if (v?.email) void sendEmail({ to: v.email, subject: decision.value.status === "approved" ? `Your store is approved! — Kano Mart` : `Vendor application update — Kano Mart`, html: vendorApprovalEmail(v.name, appRow.business_name, decision.value.status === "approved") });
        }).catch(() => {});
        return;
      }

      sendError(response, 404, "not_found", "Route not found.");

    } catch (error) {
      console.error("[api error]", method, requestUrl.pathname, error?.message ?? error);
      void captureException(error, { method, path: requestUrl.pathname });
      sendError(response, error.status ?? 500, error.code ?? "internal_error", error.status ? error.message : "Something went wrong.");
    }
  }

  // File persistence: write snapshot after every mutating request
  let innerHandle = handle;
  if (store && options.dataFile) {
    const dataFile = options.dataFile;
    innerHandle = async (req, res) => {
      await handle(req, res);
      const m = req.method ?? "GET";
      if (m !== "GET" && m !== "OPTIONS") {
        try { writeFileSync(dataFile, JSON.stringify({ data: serializeStore(store) })); } catch { /* ignore */ }
      }
    };
  }

  // ── Observability wrapper ──────────────────────────────────────────────────
  // Adds to every request:
  //   • x-request-id header (echoed back to caller; used in log drain correlation)
  //   • Structured JSON log line: { ts, requestId, method, path, status, durationMs }
  //
  // Vercel captures stdout as structured logs. Point a Vercel Log Drain at
  // Datadog / Axiom / Logtail and every line is searchable and alertable.
  const finalHandle = async (req, res) => {
    const requestId = req.headers["x-request-id"] || randomUUID();
    const start     = Date.now();
    const method    = req.method ?? "GET";
    const path      = (() => {
      try { return new URL(req.url ?? "/", "http://localhost").pathname; } catch { return req.url ?? "/"; }
    })();

    // Intercept writeHead so we can capture the status code and inject the request ID.
    let statusCode = 200;
    const origWriteHead = res.writeHead.bind(res);
    res.writeHead = (status, hdrs = {}) => {
      statusCode = status;
      return origWriteHead(status, { "x-request-id": requestId, ...hdrs });
    };

    try {
      await innerHandle(req, res);
    } finally {
      const durationMs = Date.now() - start;
      // Skip logging for OPTIONS preflight and health-check noise in dev.
      if (method !== "OPTIONS" && !(method === "GET" && path === "/health")) {
        console.log(JSON.stringify({
          ts:          new Date().toISOString(),
          requestId,
          method,
          path,
          status:      statusCode,
          durationMs,
        }));
      }
    }
  };

  return { handle: finalHandle, store };
}

// ── Postgres DAO wrapper (production) ────────────────────────────────────────

function createPostgresDao() {
  return {
    dbGetUserByIdentifier, dbGetUserById, dbCreateUser, dbUpdateUser, dbGetAllUsers,
    dbCreateSession, dbGetSessionUser, dbDeleteSession,
    dbCreateVendorApplication, dbGetVendorApplicationById, dbGetVendorApplicationByUserId,
    dbGetAllVendorApplications, dbUpdateVendorApplication,
    dbGetProductById, dbGetProductsForVendor, dbGetPublicCatalog, dbGetAllProducts,
    dbCreateProduct, dbUpdateProductListing, dbUpdateProductModeration, dbDecrementProductQuantity,
    dbGetCart, dbUpsertCartItem, dbDeleteCartItem, dbClearCart,
    dbCreateOrderWithItems, dbCreateLedgerForOrder, dbGetOrderWithItems,
    dbGetOrdersForCustomer, dbGetOrdersForVendor, dbGetAllOrders, dbUpdateOrderStatus,
    dbGetPaymentById, dbGetAllPayments, dbUpdatePaymentStatus,
    dbGetVendorWallet, dbGetPayoutRequests, dbCreatePayoutRequest, dbUpdatePayoutStatus,
    dbCreateNotification, dbNotifyAdmins, dbGetNotifications, dbMarkNotificationRead,
    dbGetWishlist, dbAddWishlist, dbRemoveWishlist,
    dbGetReviews, dbGetVendorReviews, dbGetAllReviews, dbCreateReview, dbUpdateReview,
    dbCustomerHasDeliveredOrder,
    dbGetPromotions, dbGetActivePromotionForProduct, dbCreatePromotion, dbUpdatePromotion,
    dbGetCategories, dbUpsertCategory,
    dbSaveUpload, dbGetUpload,
    dbRecordSearchEvent, dbIncrementProductView, dbGetAnalytics,
  };
}

// ── In-memory store ───────────────────────────────────────────────────────────

const DEFAULT_CATEGORIES = (now) => new Map([
  ["food",       { key: "food",       name: { en: "Food",       ha: "Abinci" },             searchTerms: ["food","abinci","groceries"], createdAt: now, updatedAt: now }],
  ["fashion",    { key: "fashion",    name: { en: "Fashion",    ha: "Kaya" },               searchTerms: ["fashion","kaya","clothes"], createdAt: now, updatedAt: now }],
  ["children",   { key: "children",  name: { en: "Children",   ha: "Yara" },               searchTerms: ["children","yara","school"], createdAt: now, updatedAt: now }],
  ["essentials", { key: "essentials",name: { en: "Essentials", ha: "Kayan yau da kullum" },searchTerms: ["essentials","daily"], createdAt: now, updatedAt: now }],
]);

export function createMemoryStore(initial = null) {
  const now = new Date().toISOString();
  if (!initial) {
    return {
      users: new Map(), sessions: new Map(), vendorApplications: new Map(),
      products: new Map(), uploads: new Map(), cartItems: new Map(),
      orders: new Map(), orderItems: new Map(), payments: new Map(),
      walletLedger: new Map(), notifications: new Map(), wishlists: new Set(),
      reviews: new Map(), promotions: new Map(), payoutRequests: new Map(),
      categories: DEFAULT_CATEGORIES(now), productViews: new Map(), searchEvents: [],
    };
  }
  return {
    users:              new Map((initial.users              ?? []).map(u => [u.id, u])),
    sessions:           new Map((initial.sessions           ?? []).map(s => [s.token, { userId: s.userId, expiresAt: s.expiresAt }])),
    vendorApplications: new Map((initial.vendorApplications ?? []).map(a => [a.id, a])),
    products:           new Map((initial.products           ?? []).map(p => [p.id, p])),
    uploads:            new Map((initial.uploads            ?? []).map(u => [u.id, u])),
    cartItems:          new Map((initial.cartItems          ?? []).map(c => [c.key, c])),
    orders:             new Map((initial.orders             ?? []).map(o => [o.id, o])),
    orderItems:         new Map((initial.orderItems         ?? []).map(oi => [oi.orderId, oi.items])),
    payments:           new Map((initial.payments           ?? []).map(p => [p.id, p])),
    walletLedger:       new Map((initial.walletLedger       ?? []).map(e => [e.id, e])),
    notifications:      new Map((initial.notifications      ?? []).map(n => [n.id, n])),
    wishlists:          new Set(initial.wishlists           ?? []),
    reviews:            new Map((initial.reviews            ?? []).map(r => [r.id, r])),
    promotions:         new Map((initial.promotions         ?? []).map(p => [p.id, p])),
    payoutRequests:     new Map((initial.payoutRequests     ?? []).map(p => [p.id, p])),
    categories: (initial.categories?.length > 0)
      ? new Map((initial.categories).map(c => [c.key, c]))
      : DEFAULT_CATEGORIES(now),
    productViews: new Map((initial.productViews ?? []).map(v => [v.id, { views: v.views, lastViewedAt: v.lastViewedAt }])),
    searchEvents: initial.searchEvents ?? [],
  };
}

function serializeStore(store) {
  return {
    users:              [...store.users.values()],
    sessions:           [...store.sessions.entries()].map(([token, s]) => ({ token, ...s })),
    vendorApplications: [...store.vendorApplications.values()],
    products:           [...store.products.values()],
    uploads:            [...store.uploads.values()],
    cartItems:          [...store.cartItems.entries()].map(([key, item]) => ({ key, ...item })),
    orders:             [...store.orders.values()],
    orderItems:         [...store.orderItems.entries()].map(([orderId, items]) => ({ orderId, items })),
    payments:           [...store.payments.values()],
    walletLedger:       [...store.walletLedger.values()],
    notifications:      [...store.notifications.values()],
    wishlists:          [...store.wishlists],
    reviews:            [...store.reviews.values()],
    promotions:         [...store.promotions.values()],
    payoutRequests:     [...store.payoutRequests.values()],
    categories:         [...store.categories.values()],
    productViews:       [...store.productViews.entries()].map(([id, v]) => ({ id, ...v })),
    searchEvents:       store.searchEvents,
  };
}

// ── In-memory DAO ─────────────────────────────────────────────────────────────

function createMemoryDao(store) {
  const now = () => new Date().toISOString();

  // ── helpers ────────────────────────────────────────────────────────────────

  function memUserToPublic(u) {
    if (!u) return null;
    return {
      id: u.id, phone: u.phone, email: u.email ?? undefined,
      passwordHash: u.passwordHash,
      firstName: u.firstName, lastName: u.lastName, name: u.name,
      role: u.role, deliveryAddress: u.deliveryAddress ?? undefined,
      preferredLanguage: u.preferredLanguage, vendorStatus: u.vendorStatus ?? undefined,
      disabledAt: u.disabledAt ?? undefined,
      createdAt: u.createdAt, updatedAt: u.updatedAt,
    };
  }

  function vendorAppRow(app) {
    if (!app) return null;
    const user = store.users.get(app.userId);
    return {
      id: app.id, user_id: app.userId,
      business_name: app.businessName, phone: app.phone,
      area: app.area, category: app.category,
      status: app.status, admin_note: app.adminNote ?? null,
      reviewed_at: app.reviewedAt ?? null,
      created_at: app.createdAt, updated_at: app.updatedAt,
      user_name: user?.name ?? "", user_phone: user?.phone ?? "",
      user_email: user?.email ?? null, user_role: user?.role ?? "vendor",
      user_vendor_status: user?.vendorStatus ?? null,
    };
  }

  function productToPublicRow(p) {
    if (!p) return null;
    return {
      id: p.id, vendor_user_id: p.vendorUserId, vendor_name: p.vendorName,
      vendor_phone: p.vendorPhone ?? null,
      name_en: p.name.en, name_ha: p.name.ha,
      description_en: p.description?.en ?? "", description_ha: p.description?.ha ?? "",
      category: p.category, price: p.price, currency: p.currency ?? "NGN",
      quantity_available: p.quantityAvailable ?? 0, area: p.area ?? "Kano",
      image_url: p.imageUrl ?? null, tags: p.tags ?? [],
      listing_status: p.listingStatus ?? "active",
      moderation_status: p.moderationStatus ?? "pending",
      review_note: p.reviewNote ?? null, reviewed_at: p.reviewedAt ?? null,
      created_at: p.createdAt, updated_at: p.updatedAt,
    };
  }

  function cartRow(productId, qty, item, product) {
    const pRow = productToPublicRow(product);
    return {
      product_id: productId, quantity: qty,
      added_at: item.addedAt, updated_at: item.updatedAt,
      ...pRow,
    };
  }

  function ledgerCalc(vendorUserId) {
    let pendingBalance = 0, availableBalance = 0, totalCommission = 0;
    for (const e of store.walletLedger.values()) {
      if (e.vendorUserId !== vendorUserId) continue;
      if (e.type === "vendor_pending_credit") {
        if (e.status === "available") availableBalance += e.amount;
        else pendingBalance += e.amount;
      }
      if (e.type === "platform_commission") totalCommission += e.amount;
      if (e.type === "vendor_withdrawal_debit") availableBalance -= e.amount;
    }
    return { vendorUserId, pendingBalance, availableBalance, totalCommission };
  }

  function buildOrder(orderId) {
    const order = store.orders.get(orderId);
    if (!order) return null;
    const items = store.orderItems.get(orderId) ?? [];
    const payment = order.paymentId ? store.payments.get(order.paymentId) : null;
    return { ...order, items, payment: payment ?? undefined };
  }

  function memCreateLedger(orderId, items) {
    for (const item of items) {
      const creditId = randomUUID();
      store.walletLedger.set(creditId, {
        id: creditId, orderId, productId: item.productId, vendorUserId: item.vendorUserId,
        type: "vendor_pending_credit", status: "pending", amount: item.vendorPayout,
        createdAt: now(),
      });
      const commId = randomUUID();
      store.walletLedger.set(commId, {
        id: commId, orderId, productId: item.productId, vendorUserId: item.vendorUserId,
        type: "platform_commission", status: "available", amount: item.commissionAmount,
        createdAt: now(),
      });
    }
  }

  // ── Users ──────────────────────────────────────────────────────────────────

  async function dbGetUserByIdentifier(identifier) {
    const phone = normalizePhone(identifier);
    const email = normalizeEmail(identifier);
    for (const u of store.users.values()) {
      if (u.phone === phone || (email && u.email === email)) return memUserToPublic(u);
    }
    return null;
  }

  async function dbGetUserById(id) {
    return memUserToPublic(store.users.get(id) ?? null);
  }

  async function dbCreateUser(user) {
    const u = { ...user, createdAt: now(), updatedAt: now() };
    store.users.set(u.id, u);
    return memUserToPublic(u);
  }

  async function dbUpdateUser(id, fields) {
    const u = store.users.get(id);
    if (!u) return null;
    if (fields.name !== undefined) u.name = fields.name;
    if (fields.firstName !== undefined) u.firstName = fields.firstName;
    if (fields.lastName !== undefined) u.lastName = fields.lastName;
    if (fields.email !== undefined) u.email = fields.email;
    if (fields.deliveryAddress !== undefined) u.deliveryAddress = fields.deliveryAddress;
    if (fields.preferredLanguage !== undefined) u.preferredLanguage = fields.preferredLanguage;
    if (fields.vendorStatus !== undefined) u.vendorStatus = fields.vendorStatus;
    u.updatedAt = now();
    return memUserToPublic(u);
  }

  async function dbGetAllUsers() {
    return [...store.users.values()].map(memUserToPublic).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  // ── Sessions ───────────────────────────────────────────────────────────────

  async function dbCreateSession(userId) {
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000).toISOString();
    store.sessions.set(token, { userId, expiresAt });
    return { token, expiresAt };
  }

  async function dbGetSessionUser(token) {
    if (!token) return null;
    const session = store.sessions.get(token);
    if (!session || new Date(session.expiresAt) <= new Date()) return null;
    const u = store.users.get(session.userId);
    if (!u || u.disabledAt) return null;
    return memUserToPublic(u);
  }

  async function dbDeleteSession(token) {
    store.sessions.delete(token);
  }

  // ── Vendor applications ────────────────────────────────────────────────────

  async function dbCreateVendorApplication(app) {
    // Upsert by userId
    for (const [id, existing] of store.vendorApplications) {
      if (existing.userId === app.userId) {
        const updated = { ...existing, businessName: app.businessName, phone: app.phone, area: app.area, category: app.category, updatedAt: now() };
        store.vendorApplications.set(id, updated);
        return updated;
      }
    }
    const a = { ...app, status: "pending", createdAt: now(), updatedAt: now() };
    store.vendorApplications.set(a.id, a);
    return a;
  }

  async function dbGetVendorApplicationById(appId) {
    return vendorAppRow(store.vendorApplications.get(appId) ?? null);
  }

  async function dbGetVendorApplicationByUserId(userId) {
    for (const a of store.vendorApplications.values()) {
      if (a.userId === userId) return vendorAppRow(a);
    }
    return null;
  }

  async function dbGetAllVendorApplications(status) {
    const apps = [...store.vendorApplications.values()]
      .filter(a => !status || a.status === status)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return apps.map(vendorAppRow);
  }

  async function dbUpdateVendorApplication(appId, userId, status, adminNote) {
    const a = store.vendorApplications.get(appId);
    if (a) { Object.assign(a, { status, adminNote: adminNote ?? null, reviewedAt: now(), updatedAt: now() }); }
    const u = store.users.get(userId);
    if (u) { u.vendorStatus = status; u.updatedAt = now(); }
  }

  // ── Products ───────────────────────────────────────────────────────────────

  async function dbGetProductById(productId, includeVendorPhone) {
    const p = store.products.get(productId);
    if (!p) return null;
    if (includeVendorPhone && !p.vendorPhone) {
      const u = store.users.get(p.vendorUserId);
      if (u) p.vendorPhone = u.phone;
    }
    return productFromRow(productToPublicRow(p));
  }

  async function dbGetProductsForVendor(vendorUserId) {
    return [...store.products.values()]
      .filter(p => p.vendorUserId === vendorUserId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(p => productFromRow(productToPublicRow(p)));
  }

  async function dbGetPublicCatalog(category, query) {
    const q = query ? query.toLowerCase() : null;
    return [...store.products.values()]
      .filter(p => {
        if (p.moderationStatus !== "approved" || p.listingStatus !== "active") return false;
        if (category && p.category !== category) return false;
        if (q) {
          const haystack = [p.name.en, p.name.ha, ...(p.tags ?? [])].map(s => s.toLowerCase()).join(" ");
          if (!haystack.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(p => productFromRow(productToPublicRow(p)));
  }

  async function dbGetAllProducts(status) {
    return [...store.products.values()]
      .filter(p => !status || p.moderationStatus === status)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(p => productFromRow(productToPublicRow(p)));
  }

  async function dbCreateProduct(vendorId, vendorName, input) {
    const id = randomUUID();
    const vendor = store.users.get(vendorId);
    const p = {
      id, vendorUserId: vendorId, vendorName,
      vendorPhone: vendor?.phone ?? null,
      name: input.name, description: input.description,
      category: input.category, price: input.price, currency: input.currency,
      quantityAvailable: input.quantityAvailable, area: input.area,
      imageUrl: input.imageUrl ?? null, tags: input.tags,
      listingStatus: input.quantityAvailable > 0 ? "active" : "out_of_stock",
      moderationStatus: "pending",
      reviewNote: null, reviewedAt: null,
      createdAt: now(), updatedAt: now(),
    };
    store.products.set(id, p);
    return productFromRow(productToPublicRow(p));
  }

  async function dbUpdateProductListing(productId, listingStatus) {
    const p = store.products.get(productId);
    if (!p) return null;
    p.listingStatus = listingStatus; p.updatedAt = now();
    return productFromRow(productToPublicRow(p));
  }

  async function dbUpdateProductModeration(productId, status, reviewNote) {
    const p = store.products.get(productId);
    if (!p) return null;
    p.moderationStatus = status; p.reviewNote = reviewNote ?? null; p.reviewedAt = now(); p.updatedAt = now();
    return productFromRow(productToPublicRow(p));
  }

  async function dbDecrementProductQuantity(productId, qty) {
    const p = store.products.get(productId);
    if (!p || (p.quantityAvailable ?? 0) < qty) return false;
    p.quantityAvailable -= qty;
    if (p.quantityAvailable <= 0) p.listingStatus = "out_of_stock";
    p.updatedAt = now();
    return true;
  }

  // ── Cart ───────────────────────────────────────────────────────────────────

  async function dbGetCart(userId) {
    const rows = [];
    for (const [key, item] of store.cartItems) {
      if (!key.startsWith(userId + ":")) continue;
      const product = store.products.get(item.productId);
      if (!product) continue;
      rows.push(cartRow(item.productId, item.quantity, item, product));
    }
    return rows.sort((a, b) => b.added_at.localeCompare(a.added_at));
  }

  async function dbUpsertCartItem(userId, productId, quantity) {
    const key = `${userId}:${productId}`;
    const existing = store.cartItems.get(key);
    store.cartItems.set(key, {
      productId, quantity,
      addedAt: existing?.addedAt ?? now(), updatedAt: now(),
    });
  }

  async function dbDeleteCartItem(userId, productId) {
    store.cartItems.delete(`${userId}:${productId}`);
  }

  async function dbClearCart(userId) {
    for (const key of [...store.cartItems.keys()]) {
      if (key.startsWith(userId + ":")) store.cartItems.delete(key);
    }
  }

  // ── Orders ─────────────────────────────────────────────────────────────────

  async function dbCreateOrderWithItems(order, items, payment) {
    store.orders.set(order.id, {
      ...order,
      paymentId: payment.id,        // link order → payment (mirrors the Postgres payment_id column)
      status: "awaiting_confirmation",
      createdAt: now(), updatedAt: now(),
    });
    store.orderItems.set(order.id, items.map(i => ({ ...i })));
    store.payments.set(payment.id, { ...payment, createdAt: now() });
    if (order.paymentStatus === "paid") memCreateLedger(order.id, items);
  }

  async function dbCreateLedgerForOrder(orderId, items) {
    memCreateLedger(orderId, items);
  }

  async function dbGetOrderWithItems(orderId) {
    return buildOrder(orderId);
  }

  async function dbGetOrdersForCustomer(userId) {
    return [...store.orders.values()]
      .filter(o => o.customerUserId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(o => buildOrder(o.id));
  }

  async function dbGetOrdersForVendor(vendorUserId) {
    const result = [];
    for (const order of [...store.orders.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
      const allItems = store.orderItems.get(order.id) ?? [];
      const vendorItems = allItems.filter(i => i.vendorUserId === vendorUserId);
      if (!vendorItems.length) continue;
      const payment = order.paymentId ? store.payments.get(order.paymentId) : null;
      result.push({ ...order, items: vendorItems, payment: payment ?? undefined });
    }
    return result;
  }

  async function dbGetAllOrders() {
    return [...store.orders.values()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(o => buildOrder(o.id));
  }

  async function dbUpdateOrderStatus(orderId, status, deliveryPerson) {
    const order = store.orders.get(orderId);
    if (!order) return null;
    order.status = status;
    if (deliveryPerson) order.deliveryPerson = deliveryPerson;
    order.updatedAt = now();
    if (status === "delivered") {
      for (const e of store.walletLedger.values()) {
        if (e.orderId === orderId && e.type === "vendor_pending_credit" && e.status === "pending") {
          e.status = "available"; e.availableAt = now();
        }
      }
    }
    return order;
  }

  // ── Payments ───────────────────────────────────────────────────────────────

  async function dbGetPaymentById(paymentId) {
    return store.payments.get(paymentId) ?? null;
  }

  async function dbGetAllPayments() {
    return [...store.payments.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async function dbUpdatePaymentStatus(paymentId, orderId, status, adminNote) {
    const payment = store.payments.get(paymentId);
    if (!payment) return;
    const n = now();
    payment.status = status;
    if (adminNote !== undefined) payment.adminNote = adminNote;
    if (status === "paid") payment.verifiedAt = n;
    if (status === "failed") payment.failedAt = n;
    if (status === "refunded") payment.refundedAt = n;
    const order = store.orders.get(orderId);
    if (order) { order.paymentStatus = status; order.updatedAt = n; }
    if (status === "paid") {
      // Guard against duplicate ledger entries
      const hasLedger = [...store.walletLedger.values()].some(e => e.orderId === orderId);
      if (!hasLedger) {
        const items = store.orderItems.get(orderId) ?? [];
        memCreateLedger(orderId, items);
        if (order?.status === "delivered") {
          for (const e of store.walletLedger.values()) {
            if (e.orderId === orderId && e.type === "vendor_pending_credit" && e.status === "pending") {
              e.status = "available"; e.availableAt = n;
            }
          }
        }
      }
    }
  }

  // ── Wallet & payouts ───────────────────────────────────────────────────────

  async function dbGetVendorWallet(vendorUserId) {
    return ledgerCalc(vendorUserId);
  }

  async function dbGetPayoutRequests(vendorUserId) {
    return [...store.payoutRequests.values()]
      .filter(p => !vendorUserId || p.vendorUserId === vendorUserId)
      .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  }

  async function dbCreatePayoutRequest(payout) {
    const p = { ...payout, status: "pending", requestedAt: now() };
    store.payoutRequests.set(p.id, p);
    return p;
  }

  async function dbUpdatePayoutStatus(payoutId, vendorUserId, status, adminNote, amount) {
    const p = store.payoutRequests.get(payoutId);
    if (!p) return null;
    p.status = status;
    if (adminNote !== undefined) p.adminNote = adminNote;
    p.reviewedAt = now();
    if (status === "approved") {
      const id = randomUUID();
      store.walletLedger.set(id, {
        id, vendorUserId, payoutRequestId: payoutId,
        type: "vendor_withdrawal_debit", status: "available",
        amount, availableAt: now(), createdAt: now(),
      });
    }
    return p;
  }

  // ── Notifications ──────────────────────────────────────────────────────────

  async function dbCreateNotification(n) {
    const id = randomUUID();
    store.notifications.set(id, {
      id, audience: n.audience, recipientUserId: n.recipientUserId,
      title: n.title, message: n.message, type: n.type,
      orderId: n.orderId ?? null, productId: n.productId ?? null,
      readAt: null, createdAt: now(),
    });
  }

  async function dbNotifyAdmins(n) {
    for (const u of store.users.values()) {
      if (u.role === "admin") await dbCreateNotification({ ...n, audience: "admin", recipientUserId: u.id });
    }
  }

  async function dbGetNotifications(userId) {
    return [...store.notifications.values()]
      .filter(n => n.recipientUserId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 50);
  }

  async function dbMarkNotificationRead(notifId, userId) {
    const n = store.notifications.get(notifId);
    if (!n || n.recipientUserId !== userId) return null;
    n.readAt = now();
    return n;
  }

  // ── Wishlist ───────────────────────────────────────────────────────────────

  async function dbGetWishlist(userId) {
    const result = [];
    for (const key of store.wishlists) {
      const [uid, productId] = key.split(":");
      if (uid !== userId) continue;
      const p = store.products.get(productId);
      if (!p || p.moderationStatus !== "approved" || p.listingStatus !== "active") continue;
      result.push(productFromRow(productToPublicRow(p)));
    }
    return result;
  }

  async function dbAddWishlist(userId, productId) {
    store.wishlists.add(`${userId}:${productId}`);
  }

  async function dbRemoveWishlist(userId, productId) {
    store.wishlists.delete(`${userId}:${productId}`);
  }

  // ── Reviews ────────────────────────────────────────────────────────────────

  async function dbGetReviews(productId, includeHidden) {
    return [...store.reviews.values()]
      .filter(r => r.productId === productId && (includeHidden || !r.hidden))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async function dbGetVendorReviews(vendorUserId) {
    return [...store.reviews.values()]
      .filter(r => r.vendorUserId === vendorUserId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async function dbGetAllReviews() {
    return [...store.reviews.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async function dbCreateReview(review) {
    const id = randomUUID();
    const r = { id, ...review, hidden: false, adminNote: null, createdAt: now(), updatedAt: now() };
    store.reviews.set(id, r);
    return r;
  }

  async function dbUpdateReview(reviewId, hidden, adminNote) {
    const r = store.reviews.get(reviewId);
    if (!r) return null;
    r.hidden = hidden; r.adminNote = adminNote ?? null; r.updatedAt = now();
    return r;
  }

  async function dbCustomerHasDeliveredOrder(customerId, productId) {
    for (const order of store.orders.values()) {
      if (order.customerUserId !== customerId || order.status !== "delivered") continue;
      const items = store.orderItems.get(order.id) ?? [];
      if (items.some(i => i.productId === productId)) return true;
    }
    return false;
  }

  // ── Promotions ─────────────────────────────────────────────────────────────

  async function dbGetPromotions(activeOnly) {
    const n = new Date();
    return [...store.promotions.values()]
      .filter(p => !activeOnly || (p.active && new Date(p.startsAt) <= n))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(p => ({
        id: p.id, titleEn: p.title.en, titleHa: p.title.ha, type: p.type,
        discountPercent: p.discountPercent, code: p.code ?? null,
        productId: p.productId ?? null, vendorUserId: p.vendorUserId ?? null,
        category: p.category ?? null, active: p.active,
        startsAt: p.startsAt, endsAt: p.endsAt ?? null,
        createdAt: p.createdAt, updatedAt: p.updatedAt,
      }));
  }

  async function dbGetActivePromotionForProduct(product, code) {
    const n = new Date();
    const normalizedCode = code ? code.toUpperCase() : null;
    for (const p of [...store.promotions.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
      if (!p.active) continue;
      if (new Date(p.startsAt) > n) continue;
      if (p.endsAt && new Date(p.endsAt) <= n) continue;
      if (p.code && p.code !== normalizedCode) continue;
      if (p.productId && p.productId !== product.id) continue;
      if (p.vendorUserId && p.vendorUserId !== product.vendorUserId) continue;
      if (p.category && p.category !== product.category) continue;
      return {
        id: p.id, type: p.type, discountPercent: p.discountPercent,
        code: p.code ?? null, productId: p.productId ?? null,
      };
    }
    return null;
  }

  async function dbCreatePromotion(p) {
    const id = randomUUID();
    const promo = { id, ...p, createdAt: now(), updatedAt: now() };
    store.promotions.set(id, promo);
    return { id, titleEn: promo.title.en, titleHa: promo.title.ha, type: promo.type, discountPercent: promo.discountPercent, active: promo.active };
  }

  async function dbUpdatePromotion(promoId, active) {
    const p = store.promotions.get(promoId);
    if (!p) return null;
    p.active = active; p.updatedAt = now();
    return { id: p.id, active: p.active };
  }

  // ── Categories ─────────────────────────────────────────────────────────────

  async function dbGetCategories() {
    return [...store.categories.values()];
  }

  async function dbUpsertCategory(cat) {
    const existing = store.categories.get(cat.key) ?? {};
    const c = { ...existing, ...cat, updatedAt: now(), createdAt: existing.createdAt ?? now() };
    store.categories.set(cat.key, c);
    return c;
  }

  // ── Uploads ────────────────────────────────────────────────────────────────

  async function dbSaveUpload(upload) {
    const u = { ...upload, createdAt: now() };
    store.uploads.set(u.id, u);
    return u;
  }

  async function dbGetUpload(uploadId) {
    return store.uploads.get(uploadId) ?? null;
  }

  // ── Analytics ──────────────────────────────────────────────────────────────

  async function dbRecordSearchEvent(query) {
    store.searchEvents.push({ id: randomUUID(), query, createdAt: now() });
  }

  async function dbIncrementProductView(productId) {
    const existing = store.productViews.get(productId) ?? { views: 0 };
    store.productViews.set(productId, { views: existing.views + 1, lastViewedAt: now() });
  }

  async function dbGetAnalytics() {
    const orders = [...store.orders.values()];
    const users = [...store.users.values()];
    const totalSales = orders.reduce((t, o) => t + (o.subtotal ?? 0), 0);
    const cancelledOrders = orders.filter(o => o.status === "cancelled").length;
    const productViews = [...store.productViews.entries()]
      .map(([productId, v]) => ({ productId, views: v.views, lastViewedAt: v.lastViewedAt }))
      .sort((a, b) => b.views - a.views).slice(0, 20);
    const searchCounts = {};
    for (const e of store.searchEvents) searchCounts[e.query] = (searchCounts[e.query] ?? 0) + 1;
    const popularSearches = Object.entries(searchCounts)
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count).slice(0, 20);
    const salesByProduct = {};
    for (const [orderId, items] of store.orderItems) {
      for (const i of items) {
        if (!salesByProduct[i.productId]) salesByProduct[i.productId] = { quantity: 0, sales: 0 };
        salesByProduct[i.productId].quantity += i.quantity;
        salesByProduct[i.productId].sales += i.lineTotal;
      }
    }
    const bestSellingProducts = Object.entries(salesByProduct)
      .map(([productId, v]) => ({ productId, ...v }))
      .sort((a, b) => b.quantity - a.quantity).slice(0, 10);
    return {
      totalSales, totalOrders: orders.length, cancelledOrders,
      customerGrowth: users.filter(u => u.role === "customer").length,
      vendorGrowth: users.filter(u => u.role === "vendor").length,
      productViews, popularSearches, bestSellingProducts,
    };
  }

  return {
    dbGetUserByIdentifier, dbGetUserById, dbCreateUser, dbUpdateUser, dbGetAllUsers,
    dbCreateSession, dbGetSessionUser, dbDeleteSession,
    dbCreateVendorApplication, dbGetVendorApplicationById, dbGetVendorApplicationByUserId,
    dbGetAllVendorApplications, dbUpdateVendorApplication,
    dbGetProductById, dbGetProductsForVendor, dbGetPublicCatalog, dbGetAllProducts,
    dbCreateProduct, dbUpdateProductListing, dbUpdateProductModeration, dbDecrementProductQuantity,
    dbGetCart, dbUpsertCartItem, dbDeleteCartItem, dbClearCart,
    dbCreateOrderWithItems, dbCreateLedgerForOrder, dbGetOrderWithItems,
    dbGetOrdersForCustomer, dbGetOrdersForVendor, dbGetAllOrders, dbUpdateOrderStatus,
    dbGetPaymentById, dbGetAllPayments, dbUpdatePaymentStatus,
    dbGetVendorWallet, dbGetPayoutRequests, dbCreatePayoutRequest, dbUpdatePayoutStatus,
    dbCreateNotification, dbNotifyAdmins, dbGetNotifications, dbMarkNotificationRead,
    dbGetWishlist, dbAddWishlist, dbRemoveWishlist,
    dbGetReviews, dbGetVendorReviews, dbGetAllReviews, dbCreateReview, dbUpdateReview,
    dbCustomerHasDeliveredOrder,
    dbGetPromotions, dbGetActivePromotionForProduct, dbCreatePromotion, dbUpdatePromotion,
    dbGetCategories, dbUpsertCategory,
    dbSaveUpload, dbGetUpload,
    dbRecordSearchEvent, dbIncrementProductView, dbGetAnalytics,
  };
}

// ── HTTP inject helper (test utility) ────────────────────────────────────────

export async function inject(app, { path, method, headers = {}, body }) {
  return new Promise((resolve) => {
    const listeners = {};
    const req = {
      url: path,
      method: method ?? (body ? "POST" : "GET"),
      headers: { host: "localhost", ...Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])) },
      socket: { remoteAddress: "127.0.0.1" },
      on(event, fn) { (listeners[event] ??= []).push(fn); return this; },
      emit(event, ...args) { (listeners[event] ?? []).forEach(fn => fn(...args)); },
      [Symbol.asyncIterator]() {
        const chunks = body ? [Buffer.from(body, "utf8")] : [];
        let i = 0;
        return { async next() { return i < chunks.length ? { value: chunks[i++], done: false } : { done: true }; } };
      },
    };

    let statusCode = 200;
    const responseHeaders = {};
    const responseChunks = [];
    const res = {
      writeHead(status, hdrs = {}) { statusCode = status; Object.assign(responseHeaders, hdrs); },
      end(data) {
        if (data) responseChunks.push(typeof data === "string" ? Buffer.from(data) : data);
        const raw = Buffer.concat(responseChunks).toString("utf8");
        let parsed;
        try { parsed = JSON.parse(raw); } catch { parsed = raw; }
        resolve({ status: statusCode, headers: responseHeaders, body: parsed });
      },
    };

    Promise.resolve(app.handle(req, res)).catch(err => {
      res.writeHead(500, {});
      res.end(JSON.stringify({ error: { code: "internal_error", message: err.message } }));
    });
  });
}

// ── Remote store app factory ──────────────────────────────────────────────────

export async function createRemoteStoreApp(options) {
  const { remoteStoreConfig, ...appOptions } = options;
  const { url, token, key } = remoteStoreConfig;
  const authHeaders = { Authorization: `Bearer ${token}`, "Content-Type": "text/plain" };

  let initial = null;
  try {
    const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, { headers: authHeaders });
    const body = await res.json();
    if (body.result) initial = JSON.parse(body.result);
  } catch { /* first run or unavailable */ }

  const store = createMemoryStore(initial?.data ?? null);
  const app = createApp({ ...appOptions, store });
  const originalHandle = app.handle;

  app.handle = async (req, res) => {
    await originalHandle(req, res);
    const m = req.method ?? "GET";
    if (m !== "GET" && m !== "OPTIONS") {
      void fetch(`${url}/set/${encodeURIComponent(key)}`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ data: serializeStore(store) }),
      }).catch(() => undefined);
    }
  };

  return app;
}

// ── Vercel handler ────────────────────────────────────────────────────────────

let _app;
export default async function handler(request, response) {
  _app ??= createApp({ allowedOrigin: process.env.CORS_ORIGIN ?? "*", publicApiBasePath: "/api" });
  if (request.url?.startsWith("/api")) request.url = request.url.slice(4) || "/";
  return _app.handle(request, response);
}

// ── Local dev server ──────────────────────────────────────────────────────────

export function startServer(options = {}) {
  const app = createApp(options);
  const port = Number(options.port ?? process.env.PORT ?? 8787);
  const server = createServer(app.handle);
  server.listen(port, options.host ?? "0.0.0.0");
  return { app, server };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { server } = startServer();
  server.on("listening", () => {
    const addr = server.address();
    const port = typeof addr === "object" && addr ? addr.port : process.env.PORT ?? 8787;
    console.log(`Kano Mart API (Postgres) listening on http://localhost:${port}`);
  });
}
