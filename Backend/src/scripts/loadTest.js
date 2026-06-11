/**
 * Dependency-free concurrent load tester (uses the built-in global fetch).
 *
 * Spins up N concurrent virtual users that hammer an endpoint for a fixed
 * duration, then reports throughput, latency percentiles, and status-code
 * distribution. Useful to validate the server handles high concurrency
 * (e.g. 1000 simultaneous users) on the local machine.
 *
 * Usage:
 *   node src/scripts/loadTest.js
 *   CONCURRENCY=1000 DURATION=15 TARGET=http://localhost:5000 PATH=/health node src/scripts/loadTest.js
 *   npm run loadtest
 *
 * Env / args:
 *   TARGET       base URL              (default http://localhost:5000)
 *   PATH         path to hit           (default /health)
 *   CONCURRENCY  parallel virtual users(default 1000)
 *   DURATION     seconds to run        (default 10)
 *   WARMUP       seconds to discard    (default 2)
 *
 * Note: /api/* routes are rate-limited per IP, so a single-machine flood will
 * intentionally see 429s there — that proves the limiter works. Use /health
 * (rate-limit-exempt) to measure raw server concurrency capacity.
 */
const TARGET = process.env.TARGET || 'http://localhost:5000';
const PATH = process.env.PATH_OVERRIDE || process.env.ENDPOINT || '/health';
const CONCURRENCY = Number(process.env.CONCURRENCY || 1000);
const DURATION_MS = Number(process.env.DURATION || 10) * 1000;
const WARMUP_MS = Number(process.env.WARMUP || 2) * 1000;

const url = `${TARGET}${PATH}`;

const latencies = [];
let total = 0;
let ok = 0;
let failed = 0;
const statusCounts = new Map();
let measuring = false;

function record(status, ms, isError) {
    total += 1;
    statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
    if (isError || status >= 400) {
        failed += 1;
    } else {
        ok += 1;
    }
    if (measuring && !isError) latencies.push(ms);
}

async function virtualUser(deadline) {
    while (Date.now() < deadline) {
        const start = performance.now();
        try {
            const res = await fetch(url, { headers: { connection: 'keep-alive' } });
            // Drain body so the socket can be reused.
            await res.arrayBuffer();
            record(res.status, performance.now() - start, false);
        } catch {
            record('ERR', performance.now() - start, true);
        }
    }
}

function percentile(sorted, p) {
    if (sorted.length === 0) return 0;
    const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
    return sorted[index];
}

async function main() {
    console.log('='.repeat(64));
    console.log('Load test');
    console.log('='.repeat(64));
    console.log(`Target:       ${url}`);
    console.log(`Concurrency:  ${CONCURRENCY} virtual users`);
    console.log(`Duration:     ${DURATION_MS / 1000}s (after ${WARMUP_MS / 1000}s warmup)`);
    console.log('-'.repeat(64));

    // Fail fast if the server is unreachable.
    try {
        await fetch(url);
    } catch (error) {
        console.error(`Cannot reach ${url}: ${error.message}`);
        console.error('Start the backend first (npm run dev), then re-run.');
        process.exit(1);
    }

    const startedAt = Date.now();
    const deadline = startedAt + WARMUP_MS + DURATION_MS;

    // Flip on measurement after warmup.
    setTimeout(() => {
        measuring = true;
        console.log('Warmup complete — measuring...');
    }, WARMUP_MS);

    const measureStart = startedAt + WARMUP_MS;
    const users = Array.from({ length: CONCURRENCY }, () => virtualUser(deadline));
    await Promise.all(users);

    const measuredSeconds = (Date.now() - measureStart) / 1000;
    const sorted = latencies.slice().sort((a, b) => a - b);
    const measuredRequests = latencies.length;
    const rps = measuredRequests / measuredSeconds;

    console.log('-'.repeat(64));
    console.log('Results (measurement window)');
    console.log('-'.repeat(64));
    console.log(`Requests (measured):  ${measuredRequests.toLocaleString()}`);
    console.log(`Total (incl. warmup): ${total.toLocaleString()}  ok=${ok}  failed=${failed}`);
    console.log(`Throughput:           ${rps.toFixed(0)} req/s`);
    console.log(`Error rate:           ${total ? ((failed / total) * 100).toFixed(2) : '0.00'}%`);
    console.log('Latency (ms):');
    console.log(`   p50  ${percentile(sorted, 50).toFixed(1)}`);
    console.log(`   p90  ${percentile(sorted, 90).toFixed(1)}`);
    console.log(`   p99  ${percentile(sorted, 99).toFixed(1)}`);
    console.log(`   max  ${(sorted[sorted.length - 1] || 0).toFixed(1)}`);
    console.log('Status codes:');
    for (const [status, count] of [...statusCounts.entries()].sort()) {
        console.log(`   ${status}: ${count.toLocaleString()}`);
    }
    console.log('='.repeat(64));
}

main().catch((error) => {
    console.error('Load test failed:', error);
    process.exit(1);
});
