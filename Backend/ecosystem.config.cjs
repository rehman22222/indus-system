/**
 * PM2 process manager config for production deployment.
 *
 * Runs the Express API in cluster mode across all CPU cores with automatic
 * restarts, memory ceilings, and zero-downtime reloads.
 *
 * Commands:
 *   npm i -g pm2
 *   pm2 start ecosystem.config.cjs --env production
 *   pm2 reload hms-backend          # zero-downtime redeploy
 *   pm2 logs hms-backend
 *   pm2 monit
 *
 * For correct realtime behaviour across workers, set SOCKET_IO_REDIS_URL (and
 * REDIS_URL) in the environment and front the app with a sticky-session load
 * balancer (e.g. nginx ip_hash).
 */
module.exports = {
  apps: [
    {
      name: 'hms-backend',
      script: 'src/server.js',
      instances: 'max', // one worker per CPU core
      exec_mode: 'cluster',
      max_memory_restart: '600M',
      kill_timeout: 15000, // matches SHUTDOWN_TIMEOUT_MS for graceful drains
      wait_ready: false,
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
        CLUSTER_WORKER: '1',
      },
    },
  ],
};
