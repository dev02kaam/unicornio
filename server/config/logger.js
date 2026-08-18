const crypto = require('node:crypto');
const pino = require('pino');
const pinoHttp = require('pino-http');

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function createLogger(config) {
  return pino({
    level: config.nodeEnv === 'test' ? 'silent' : (process.env.LOG_LEVEL || 'info'),
    base: undefined,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers.x-csrf-token',
        'request.headers.authorization',
        'request.headers.cookie',
        'request.headers.x-csrf-token',
        '*.email',
        '*.password',
        '*.currentPassword',
        '*.newPassword',
        '*.token',
        '*.answers',
        '*.clinical',
        '*.note',
      ],
      censor: '[REDACTED]',
    },
  });
}

function createRequestLogger(config) {
  const logger = createLogger(config);
  return pinoHttp({
    logger,
    genReqId(req, res) {
      const supplied = req.headers['x-request-id'];
      const requestId = typeof supplied === 'string' && UUID_V4.test(supplied)
        ? supplied.toLowerCase()
        : crypto.randomUUID();
      res.setHeader('X-Request-ID', requestId);
      return requestId;
    },
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
    customLogLevel(_req, res, error) {
      if (error || res.statusCode >= 500) return 'error';
      if ([401, 403, 429].includes(res.statusCode)) return 'warn';
      return 'info';
    },
  });
}

module.exports = { createLogger, createRequestLogger, UUID_V4 };
