import pino from 'pino';
import pinoHttp from 'pino-http';
import crypto from 'node:crypto';

const isTest = process.env.NODE_ENV === 'test';
const logLevel = process.env.LOG_LEVEL || (isTest ? 'silent' : 'info');

export const logger = pino({
  level: logLevel,
  formatters: {
    level(label) {
      return { level: label };
    }
  },
  timestamp: pino.stdTimeFunctions.isoTime
});

export const httpLogger = pinoHttp({
  logger,
  genReqId: (req) => req.headers['x-request-id'] || crypto.randomUUID(),
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customProps: (req) => {
    return {
      shopId: req.user?.shop_id || null,
      userId: req.user?.sub || null,
      role: req.user?.role || null
    };
  },
  autoLogging: {
    ignore: (req) => (req.url && req.url.startsWith('/api/health')) || isTest
  }
});
