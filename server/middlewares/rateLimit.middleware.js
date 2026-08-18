const crypto = require('node:crypto');
const rateLimit = require('express-rate-limit');
const { env } = require('../config/env');
const { database } = require('../config/database');

class PostgresRateLimitStore {
  constructor(namespace) {
    this.namespace = namespace;
    this.localKeys = true;
  }

  init(options) {
    this.windowMs = options.windowMs;
  }

  async increment(key) {
    const result = await database.query(
      `insert into unicornio_abuse_counters (namespace, key_hash, hits, reset_at)
       values ($1, $2, 1, now() + ($3 * interval '1 millisecond'))
       on conflict (namespace, key_hash) do update set
         hits = case when unicornio_abuse_counters.reset_at <= now() then 1
                     else unicornio_abuse_counters.hits + 1 end,
         reset_at = case when unicornio_abuse_counters.reset_at <= now()
                         then now() + ($3 * interval '1 millisecond')
                         else unicornio_abuse_counters.reset_at end
       returning hits, reset_at`,
      [this.namespace, key, this.windowMs],
    );
    return { totalHits: Number(result.rows[0].hits), resetTime: result.rows[0].reset_at };
  }

  async decrement(key) {
    await database.query(
      `update unicornio_abuse_counters set hits = greatest(hits - 1, 0)
       where namespace = $1 and key_hash = $2`,
      [this.namespace, key],
    );
  }

  async resetKey(key) {
    await database.query(
      'delete from unicornio_abuse_counters where namespace = $1 and key_hash = $2',
      [this.namespace, key],
    );
  }
}

function abuseKey(req) {
  const account = String(req.body?.email || req.params?.token || '').trim().toLowerCase();
  return crypto.createHash('sha256').update(`${req.ip}|${account}`, 'utf8').digest('hex');
}

function buildLimiter({ namespace, windowMs, max, message }) {
  return rateLimit({
    windowMs,
    max,
    skip: () => env.nodeEnv === 'test',
    store: env.appProfile === 'production' ? new PostgresRateLimitStore(namespace) : undefined,
    keyGenerator: abuseKey,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      const resetTime = req.rateLimit?.resetTime;
      const retryAfterSeconds = resetTime
        ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000))
        : 60;
      res.setHeader('Retry-After', retryAfterSeconds);
      return res.status(429).json({
        success: false,
        error: { code: 'RATE_LIMITED', message },
        data: { retryAfterSeconds },
      });
    },
  });
}

const loginLimiter = buildLimiter({
  namespace: 'login', windowMs: 15 * 60 * 1000, max: 10,
  message: 'Demasiados intentos de acceso. Intenta de nuevo mas tarde.',
});
const invitationAcceptLimiter = buildLimiter({
  namespace: 'invitation-accept', windowMs: 60 * 60 * 1000, max: 20,
  message: 'Demasiados intentos de invitacion. Intenta de nuevo mas tarde.',
});
const invitationIssueLimiter = buildLimiter({
  namespace: 'invitation-issue', windowMs: 60 * 60 * 1000, max: 100,
  message: 'Se ha alcanzado el limite temporal de invitaciones.',
});

module.exports = {
  PostgresRateLimitStore,
  abuseKey,
  loginLimiter,
  invitationAcceptLimiter,
  invitationIssueLimiter,
};
