const session = require('express-session');
const connectPgSimple = require('connect-pg-simple');

function getSessionCookieName(config) {
  return config.appProfile === 'production'
    ? '__Host-unicornio_session'
    : 'unicornio_session';
}

function createPostgresSessionStore(pool) {
  if (!pool) throw new Error('El store de sesiones requiere un pool PostgreSQL inicializado.');
  const PgStore = connectPgSimple(session);
  return new PgStore({
    pool,
    tableName: 'unicornio_sessions',
    createTableIfMissing: false,
    pruneSessionInterval: false,
  });
}

function createSessionMiddleware({ config, store } = {}) {
  if (!store && config.appProfile === 'production') {
    throw new Error('MemoryStore no esta permitido en production.');
  }

  return session({
    name: getSessionCookieName(config),
    secret: config.sessionSecret,
    store: store || new session.MemoryStore(),
    resave: false,
    saveUninitialized: false,
    rolling: true,
    unset: 'destroy',
    cookie: {
      httpOnly: true,
      secure: config.sessionCookieSecure,
      sameSite: 'lax',
      path: '/',
      maxAge: config.sessionIdleMinutes * 60 * 1000,
    },
  });
}

function enforceAbsoluteSessionLifetime(config) {
  const absoluteLifetimeMs = config.sessionAbsoluteHours * 60 * 60 * 1000;

  return (req, _res, next) => {
    const now = Date.now();
    const createdAt = Number(req.session.createdAt || now);
    if (now - createdAt > absoluteLifetimeMs) {
      return req.session.destroy(() => next());
    }
    req.session.createdAt = createdAt;
    return next();
  };
}

module.exports = {
  createSessionMiddleware,
  createPostgresSessionStore,
  enforceAbsoluteSessionLifetime,
  getSessionCookieName,
};
