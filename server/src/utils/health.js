import os from 'node:os';
import { logger } from './logger.js';

/**
 * Format raw byte counts into human-readable strings (e.g. "42.5 MB")
 * @param {number} bytes
 * @returns {string}
 */
export function formatBytes(bytes) {
  if (typeof bytes !== 'number' || isNaN(bytes) || bytes < 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let val = bytes;
  let unitIndex = 0;
  while (val >= 1024 && unitIndex < units.length - 1) {
    val /= 1024;
    unitIndex++;
  }
  return `${Math.round(val * 100) / 100} ${units[unitIndex]}`;
}

/**
 * Gather Node process and OS memory / system metrics
 * @returns {object}
 */
export function getSystemMetrics() {
  const mem = process.memoryUsage();
  return {
    memory: {
      rss: formatBytes(mem.rss),
      heapUsed: formatBytes(mem.heapUsed),
      heapTotal: formatBytes(mem.heapTotal),
      rssBytes: mem.rss,
      heapUsedBytes: mem.heapUsed,
      heapTotalBytes: mem.heapTotal
    },
    uptimeSeconds: Math.floor(process.uptime()),
    nodeVersion: process.version,
    platform: process.platform,
    loadAverage: os.loadavg ? os.loadavg() : []
  };
}

/**
 * Probe database connectivity and collect connection pool statistics
 * @param {import('pg').Pool|null} poolInstance
 * @param {boolean} demoModeFlag
 * @returns {Promise<object>}
 */
export async function getDatabaseDiagnostics(poolInstance, demoModeFlag = false) {
  if (demoModeFlag || !poolInstance) {
    return {
      status: 'demo-mode',
      connected: true,
      latencyMs: null,
      pool: null
    };
  }

  const poolMetrics = {
    totalCount: poolInstance.totalCount ?? 0,
    idleCount: poolInstance.idleCount ?? 0,
    waitingCount: poolInstance.waitingCount ?? 0
  };

  const startTime = Date.now();
  try {
    await poolInstance.query('SELECT 1');
    const latencyMs = Date.now() - startTime;
    return {
      status: 'connected',
      connected: true,
      latencyMs,
      pool: poolMetrics
    };
  } catch (err) {
    logger.error({ err: err.message }, 'Database health check probe failed');
    return {
      status: 'disconnected',
      connected: false,
      latencyMs: null,
      error: err.message,
      pool: poolMetrics
    };
  }
}

/**
 * Collect full health diagnostics for production health endpoints
 * @param {object} params
 * @param {import('pg').Pool|null} params.pool
 * @param {boolean} params.demoMode
 * @param {boolean} [params.isShuttingDown=false]
 * @returns {Promise<{ httpStatus: number, body: object }>}
 */
export async function getHealthDiagnostics({ pool, demoMode = false, isShuttingDown = false }) {
  const system = getSystemMetrics();
  const dbDiag = await getDatabaseDiagnostics(pool, demoMode);

  let status = 'ok';
  let httpStatus = 200;

  if (isShuttingDown) {
    status = 'shutting_down';
    httpStatus = 503;
  } else if (!dbDiag.connected) {
    status = 'unhealthy';
    httpStatus = 503;
  }

  return {
    httpStatus,
    body: {
      status,
      database: dbDiag.status,
      mode: demoMode ? 'demo' : 'database',
      uptimeSeconds: system.uptimeSeconds,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      nodeVersion: system.nodeVersion,
      system,
      databaseMetrics: {
        latencyMs: dbDiag.latencyMs,
        pool: dbDiag.pool
      }
    }
  };
}

/**
 * Set up production-grade graceful termination handler
 * @param {object} options
 * @param {import('http').Server|null} options.server
 * @param {import('pg').Pool|null} options.pool
 * @param {number} [options.timeoutMs=10000]
 * @param {object} [options.loggerInstance=logger]
 * @param {Function} [options.exitFn=process.exit]
 * @returns {object}
 */
export function setupGracefulShutdown({
  server = null,
  pool = null,
  timeoutMs = 10000,
  loggerInstance = logger,
  exitFn = process.exit
} = {}) {
  let isShuttingDown = false;

  const handleShutdown = async (signal = 'SIGTERM') => {
    if (isShuttingDown) {
      loggerInstance.warn({ signal }, 'Graceful shutdown already in progress, ignoring duplicate signal');
      return;
    }
    isShuttingDown = true;
    loggerInstance.info({ signal }, `Received ${signal}. Draining connections and shutting down gracefully...`);

    const timeoutHandle = setTimeout(() => {
      loggerInstance.error(`Shutdown timed out after ${timeoutMs}ms. Forcing exit.`);
      exitFn(1);
    }, timeoutMs);

    if (timeoutHandle && typeof timeoutHandle.unref === 'function') {
      timeoutHandle.unref();
    }

    try {
      if (server && typeof server.close === 'function') {
        await new Promise((resolve, reject) => {
          server.close((err) => {
            if (err) return reject(err);
            loggerInstance.info('HTTP server closed. In-flight connections drained.');
            resolve();
          });
        });
      }

      if (pool && typeof pool.end === 'function') {
        await pool.end();
        loggerInstance.info('Database connection pool closed cleanly.');
      }

      loggerInstance.info('Graceful shutdown finished cleanly.');
      exitFn(0);
    } catch (err) {
      loggerInstance.error({ err: err.message }, 'Error occurred during graceful shutdown');
      exitFn(1);
    }
  };

  const sigtermHandler = () => handleShutdown('SIGTERM');
  const sigintHandler = () => handleShutdown('SIGINT');

  process.on('SIGTERM', sigtermHandler);
  process.on('SIGINT', sigintHandler);

  return {
    handleShutdown,
    isTerminating: () => isShuttingDown,
    cleanupListeners: () => {
      process.removeListener('SIGTERM', sigtermHandler);
      process.removeListener('SIGINT', sigintHandler);
    }
  };
}
