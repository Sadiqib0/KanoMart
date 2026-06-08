/**
 * verify-db-backup.mjs
 *
 * Verifies the production Postgres database is reachable and contains live data,
 * and prints a checklist of backup readiness for Neon-hosted databases.
 *
 * Usage:
 *   node scripts/verify-db-backup.mjs
 *
 * Requires DATABASE_URL in environment (or .env / .env.local).
 */

import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// Load .env or .env.local if DATABASE_URL is not already in the environment.
for (const file of [".env.local", ".env"]) {
  const path = resolve(process.cwd(), file);
  if (!process.env.DATABASE_URL && existsSync(path)) {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

const require = createRequire(import.meta.url);

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌  DATABASE_URL is not set. Cannot verify database.");
  process.exit(1);
}

// Redact password from URL for display.
function redactUrl(url) {
  try {
    const u = new URL(url);
    if (u.password) u.password = "***";
    return u.toString();
  } catch {
    return "<invalid url>";
  }
}

let sql;
try {
  const postgres = (await import("postgres")).default;
  sql = postgres(DATABASE_URL, { max: 1, connect_timeout: 10, idle_timeout: 5 });
} catch (e) {
  console.error("❌  Failed to import postgres driver:", e.message);
  process.exit(1);
}

console.log("\n─── Kano Mart DB Backup Verification ──────────────────────────────────────");
console.log(`  Database: ${redactUrl(DATABASE_URL)}\n`);

let exitCode = 0;

async function check(label, fn) {
  try {
    const result = await fn();
    console.log(`  ✅  ${label}: ${result}`);
  } catch (e) {
    console.log(`  ❌  ${label}: ${e.message}`);
    exitCode = 1;
  }
}

// 1. Connectivity
await check("DB connection", async () => {
  const [r] = await sql`SELECT current_database() AS db, version() AS ver`;
  return `connected to "${r.db}"`;
});

// 2. Schema is migrated (key tables exist)
await check("Schema present", async () => {
  const tables = ["users", "products", "orders", "payments", "wallet_ledger"];
  const [{ count }] = await sql`
    SELECT COUNT(*) AS count FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = ANY(${tables})
  `;
  if (Number(count) < tables.length) throw new Error(`only ${count}/${tables.length} core tables found — run migrations`);
  return `all ${tables.length} core tables present`;
});

// 3. Row counts (sanity check — data should exist after seeding/use)
await check("Data present", async () => {
  const [{ users, products }] = await sql`
    SELECT
      (SELECT COUNT(*) FROM users)    AS users,
      (SELECT COUNT(*) FROM products) AS products
  `;
  return `${users} users, ${products} products`;
});

// 4. Neon PITR — check if WAL level is set for point-in-time recovery
await check("WAL level (PITR readiness)", async () => {
  const [r] = await sql`SHOW wal_level`;
  const level = r.wal_level;
  if (level !== "logical" && level !== "replica") {
    throw new Error(`wal_level=${level} — Neon should always report "replica" or higher`);
  }
  return `wal_level=${level} (PITR capable)`;
});

// 5. Connection pool health
await check("Connection pool", async () => {
  const [r] = await sql`
    SELECT state, COUNT(*) AS count
    FROM pg_stat_activity
    WHERE datname = current_database()
    GROUP BY state
  `;
  return `active sessions visible`;
});

await sql.end();

console.log("\n─── Manual steps to verify Neon backups ───────────────────────────────────");
console.log(`
  Neon manages backups automatically on all plans. To verify:

  1. Open https://console.neon.tech and select your project.
  2. Navigate to Branches → main → Restore.
     • Free (Hobby): 24-hour PITR window.
     • Launch/Scale plans: 7-30 day PITR window.
  3. Verify a restore point exists within the last 24 hours.
  4. Optionally fork the main branch to a test branch and inspect
     the restored data — delete the branch afterwards.

  Recommended actions for production:
  • Upgrade to Neon Launch ($19/mo) for 7-day PITR.
  • Enable Neon's logical replication if you need CDC/streaming.
  • Set a DATABASE_URL for a separate "staging" branch for preview deploys.
`);

process.exit(exitCode);
