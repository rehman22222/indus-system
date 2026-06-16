/**
 * Self-ping keep-alive.
 *
 * On free hosts (e.g. Render) the instance spins down after ~15 minutes with no
 * INBOUND traffic to its public URL. Internal timers don't count — but a request
 * the server makes to its OWN public URL goes out to the internet and comes back
 * through the load balancer as inbound traffic, which resets the idle timer.
 *
 * So this pings `<public-url>/health` every `SELF_PING_MINUTES` (< the idle
 * window). As long as the process runs, the instance never goes idle for 15 min
 * and therefore never sleeps — no external uptime service or always-on PC needed.
 *
 * Notes:
 * - Disabled outside production and when no public URL is known.
 * - `/health` is rate-limit-exempt and does only in-memory checks (cheap).
 * - If the instance is *already* asleep its timer is suspended too, so it can't
 *   self-wake — but if it never sleeps (this keeps it warm) that never happens.
 *   A first external hit after a cold deploy is enough to start the cycle.
 */
import { env } from '../config/env.js';

const MINUTE = 60 * 1000;

let timer = null;

function targetUrl() {
  const base = String(env.SELF_PING_URL || '').trim().replace(/\/+$/, '');
  return base ? `${base}/health` : '';
}

export function startSelfPing() {
  if (timer) return;
  if (!env.SELF_PING_ENABLED) {
    console.log('Self-ping disabled');
    return;
  }
  const url = targetUrl();
  if (!url) {
    console.log('Self-ping skipped (no public URL — set SELF_PING_URL or RENDER_EXTERNAL_URL)');
    return;
  }

  const intervalMs = env.SELF_PING_MINUTES * MINUTE;
  const ping = async () => {
    try {
      await fetch(url, { method: 'GET', signal: AbortSignal.timeout(20_000) });
    } catch (error) {
      console.warn('Self-ping failed:', error.message);
    }
  };

  timer = setInterval(ping, intervalMs);
  timer.unref?.();
  console.log(`Self-ping keep-alive started: ${url} every ${env.SELF_PING_MINUTES} min`);
}

export function stopSelfPing() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

export function selfPingStatus() {
  return { enabled: env.SELF_PING_ENABLED, running: Boolean(timer), url: targetUrl() || null };
}
