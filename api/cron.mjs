/**
 * Vercel Cron handler — runs DB maintenance tasks on a schedule.
 *
 * Configured in vercel.json:
 *   { "crons": [{ "path": "/api/cron/maintenance", "schedule": "0 3 * * *" }] }
 *
 * Tasks:
 *   - Delete expired sessions (runs daily)
 *   - Delete search_events older than 90 days (runs daily)
 *
 * Security: Vercel sets the "authorization" header to a shared CRON_SECRET on
 * every cron invocation. We reject anything that doesn't carry it.
 */

import { runMaintenanceTasks } from "./server.mjs";

export default async function handler(request, response) {
  // CRON_SECRET must be set — reject if missing (prevents accidental open access).
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    response.writeHead(500, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "CRON_SECRET env var is not set. Add it in Vercel project settings." }));
    return;
  }
  const auth = request.headers["authorization"];
  if (auth !== `Bearer ${expected}`) {
    response.writeHead(401, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "Unauthorized" }));
    return;
  }

  try {
    const result = await runMaintenanceTasks();
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true, ...result }));
  } catch (err) {
    response.writeHead(500, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: false, error: err.message }));
  }
}
