const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const { env } = require('./config/env');
const { createHealthRouter } = require('./routes/health.routes');
const { authRouter } = require('./routes/auth.routes');
const { usersRouter } = require('./routes/users.routes');
const { centersRouter } = require('./routes/centers.routes');
const { groupsRouter } = require('./routes/groups.routes');
const { assignmentsRouter } = require('./routes/assignments.routes');
const { consentsRouter } = require('./routes/consents.routes');
const { deletionImpactRouter } = require('./routes/deletion-impact.routes');
const { questionnairesRouter } = require('./routes/questionnaires.routes');
const { notFoundMiddleware, errorMiddleware } = require('./middlewares/error.middleware');
const { invitationsRouter } = require('./routes/invitations.routes');
const {
  createSessionMiddleware,
  enforceAbsoluteSessionLifetime,
} = require('./config/session');
const { requestSecurityMiddleware } = require('./middlewares/request-security.middleware');
const { csrfSynchronisedProtection } = require('./security/csrf');
const { createRequestLogger } = require('./config/logger');
const { openApiDocument } = require('./openapi');

function parseTrustProxy(value) {
  if (!value) return null;
  if (/^\d+$/.test(value)) return Number(value);
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function createApp({ config = env, sessionStore, readinessCheck } = {}) {
  const app = express();
  const trustProxy = parseTrustProxy(config.trustProxy);

  app.disable('x-powered-by');
  app.set('query parser', 'simple');
  if (trustProxy !== null) app.set('trust proxy', trustProxy);
  app.use(createRequestLogger(config));

  app.use(helmet({
    hsts: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        scriptSrcAttr: ["'none'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: null,
      },
    },
    referrerPolicy: { policy: 'no-referrer' },
  }));

  if (config.appProfile !== 'production') {
    app.use(cors({
      origin: config.corsOrigin,
      credentials: true,
      methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'X-Request-ID'],
    }));
  }

  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.use(express.json({ limit: '64kb', strict: true }));
  app.use(createSessionMiddleware({ config, store: sessionStore }));
  app.use(enforceAbsoluteSessionLifetime(config));
  app.use(requestSecurityMiddleware(config));
  app.use('/api', csrfSynchronisedProtection);
  app.use(express.static(path.join(__dirname, '..', 'public'), {
    dotfiles: 'ignore',
    index: false,
  }));

  app.use(createHealthRouter({ readinessCheck }));
  app.get('/api/openapi.json', (_req, res) => res.json(openApiDocument));
  app.use('/api/auth', authRouter);
  app.use('/api/invitations', invitationsRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/centers', centersRouter);
  app.use('/api/groups', groupsRouter);
  app.use('/api', assignmentsRouter);
  app.use('/api', consentsRouter);
  app.use('/api', deletionImpactRouter);
  app.use('/api', questionnairesRouter);

  app.get('/', (_req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  });

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);
  return app;
}

module.exports = { createApp, parseTrustProxy };
