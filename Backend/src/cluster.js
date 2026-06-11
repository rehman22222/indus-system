/**
 * Multi-core cluster entry point.
 *
 * Forks one worker per CPU core (or WEB_CONCURRENCY workers) so the Node.js
 * REST API uses every available core instead of a single thread. Each worker
 * runs the full Express app from server.js and shares the listening port via
 * the Node cluster module.
 *
 * Usage:
 *   node src/cluster.js          (clusters across all cores)
 *   npm run start:cluster
 *   WEB_CONCURRENCY=1 node src/cluster.js   (force single worker)
 *
 * IMPORTANT for realtime correctness:
 *   With multiple workers, Socket.IO clients connect to different processes.
 *   Set SOCKET_IO_REDIS_URL (Redis adapter) so queue events broadcast across
 *   all workers, and put a sticky-session load balancer in front in production.
 *   Without Redis, this file logs a warning and you should keep one worker.
 *
 * For local single-process dev, just run `node src/server.js` instead.
 */
import cluster from 'node:cluster';
import os from 'node:os';
import process from 'node:process';

import { env } from './config/env.js';

const requestedWorkers = env.WEB_CONCURRENCY > 0 ? env.WEB_CONCURRENCY : os.cpus().length;
const workerCount = Math.max(1, requestedWorkers);

async function bootSingleWorker() {
    process.env.CLUSTER_WORKER = process.env.CLUSTER_WORKER || '';
    await import('./server.js');
}

if (workerCount === 1 || !cluster.isPrimary) {
    if (cluster.isWorker) process.env.CLUSTER_WORKER = '1';
    await bootSingleWorker();
} else {
    console.log(`Primary ${process.pid} is starting ${workerCount} workers`);

    if (!env.SOCKET_IO_REDIS_URL) {
        console.warn(
            'WARNING: CLUSTER_ENABLED is on but SOCKET_IO_REDIS_URL is not set. ' +
                'Realtime queue events will NOT propagate across workers. ' +
                'Set SOCKET_IO_REDIS_URL (Redis) or run a single worker.',
        );
    }

    let shuttingDown = false;

    for (let i = 0; i < workerCount; i += 1) {
        cluster.fork({ CLUSTER_WORKER: '1' });
    }

    cluster.on('online', (worker) => {
        console.log(`Worker ${worker.process.pid} online`);
    });

    cluster.on('exit', (worker, code, signal) => {
        if (shuttingDown) return;
        console.warn(`Worker ${worker.process.pid} died (${signal || code}); respawning`);
        cluster.fork({ CLUSTER_WORKER: '1' });
    });

    const shutdown = (signal) => {
        shuttingDown = true;
        console.log(`Primary received ${signal}: stopping workers`);
        for (const worker of Object.values(cluster.workers ?? {})) {
            worker.kill(signal);
        }
        setTimeout(() => process.exit(0), env.SHUTDOWN_TIMEOUT_MS).unref();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
}
