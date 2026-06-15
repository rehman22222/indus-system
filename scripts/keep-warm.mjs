#!/usr/bin/env node
/**
 * Keep the Render free-tier backend awake.
 *
 * Render spins a free instance down after ~15 minutes of inactivity (then a cold
 * start takes ~50s). This pings `/health` on a shorter interval so it never
 * sleeps. `/health` is intentionally cheap — it is exempt from rate limiting and
 * only reads in-memory status (no DB query) — so this adds negligible CPU/RAM
 * load on Render (≈5 requests/hour).
 *
 * Usage:
 *   node scripts/keep-warm.mjs
 *   KEEP_WARM_URL=https://indus-system.onrender.com/health KEEP_WARM_MINUTES=12 node scripts/keep-warm.mjs
 *
 * Note: this must run somewhere that stays on (your PC while open, a Raspberry Pi,
 * a small VPS…). For a hands-off option that needs no machine of yours, use the
 * GitHub Actions workflow at .github/workflows/keep-warm.yml instead.
 */

const URL = process.env.KEEP_WARM_URL || 'https://indus-system.onrender.com/health';
// Clamp to 1–14 min (must stay under Render's ~15-min idle window).
const MINUTES = Math.min(Math.max(Number(process.env.KEEP_WARM_MINUTES) || 12, 1), 14);
const INTERVAL_MS = MINUTES * 60 * 1000;

async function ping() {
  const startedAt = Date.now();
  try {
    // Generous timeout so the very first ping survives a cold start.
    const res = await fetch(URL, { signal: AbortSignal.timeout(70_000) });
    const ms = Date.now() - startedAt;
    console.log(`[${new Date().toISOString()}] ${res.status} ${URL} (${ms} ms)`);
  } catch (error) {
    console.warn(`[${new Date().toISOString()}] ping failed: ${error.message}`);
  }
}

console.log(`Keeping ${URL} warm every ${MINUTES} min — leave this running. Ctrl+C to stop.`);
void ping();
setInterval(ping, INTERVAL_MS);
