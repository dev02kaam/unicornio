const rateLimit = require('express-rate-limit');
const { env } = require('../config/env');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skip: () => env.nodeEnv === 'test',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const resetTime = req.rateLimit?.resetTime;
    const retryAfterSeconds = resetTime ? Math.max(0, Math.ceil((resetTime.getTime() - Date.now()) / 1000)) : null;
    const retryAfterMinutes = retryAfterSeconds !== null ? Math.max(1, Math.ceil(retryAfterSeconds / 60)) : null;

    res.setHeader('Retry-After', retryAfterSeconds || 60);
    return res.status(429).json({
      success: false,
      message: 'Demasiados intentos de acceso. Intenta de nuevo mas tarde.',
      data: {
        retryAfterSeconds,
        retryAfterMinutes,
      },
    });
  },
});

module.exports = { loginLimiter };
