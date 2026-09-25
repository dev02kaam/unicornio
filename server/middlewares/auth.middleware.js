const { findUserById } = require('../services/users.service');
const { AppError } = require('../utils/errors');
const { sanitizeUser } = require('../models/user.model');
const { env } = require('../config/env');
const identityRepository = require('../repositories/identity.repository');
const { database } = require('../config/database');
const { loadDashboardReadCollections } = require('../repositories/dashboard-read.repository');

function needsDashboardReadCollections(req) {
  return ['GET', 'HEAD'].includes(req.method)
    && /^\/api\/(?:auth\/(?:me|session)$|users(?:\/|$)|centers(?:\/|$)|groups(?:\/|$)|academic-years(?:\/|$)|consents(?:\/|$)|legal-text-versions(?:\/|$)|students\/[^/]+\/consent-status$)/.test(req.originalUrl.split('?')[0]);
}

async function authenticateRequest(req, _res, next, { config, repository }) {
  try {
    const userId = req.session?.userId;
    if (!userId) throw new AppError('Falta una sesion autenticada.', 401);

    if (config.appProfile === 'production') {
      const identity = await repository.findUserByInternalId(userId);
      if (!identity || !identity.isActive || identity.sessionVersion !== Number(req.session.sessionVersion)) {
        await new Promise((resolve) => req.session.destroy(() => resolve()));
        throw new AppError('Usuario no valido o sesion revocada.', 401);
      }
      const { passwordHash, internalId, sessionVersion, ...publicUser } = identity;
      req.auth = { sessionId: req.sessionID, sub: internalId, sessionVersion };
      req.user = publicUser;
      return database.runAsUser(internalId, async () => {
        try {
          if (!needsDashboardReadCollections(req)) return next();
          req.dashboardReadCollections ||= await database.transaction(
            (client) => loadDashboardReadCollections(publicUser, client),
          );
          const profile = req.dashboardReadCollections.users.find((user) => user.id === publicUser.id);
          req.user = { ...publicUser, ...profile };
          return database.runWithReadCollections(req.dashboardReadCollections, next);
        } catch (error) {
          // A database outage is not an invalid session. Preserve the session
          // and let the normal error handler report the failure.
          return next(error);
        }
      });
    }

    const user = findUserById(userId);

    if (
      !user
      || !user.isActive
      || Number(user.sessionVersion || 1) !== Number(req.session.sessionVersion)
    ) {
      await new Promise((resolve) => req.session.destroy(() => resolve()));
      throw new AppError('Usuario no valido o desactivado.', 401);
    }

    req.auth = { sessionId: req.sessionID, sub: user.id };
    // Las preferencias solo viajan en el contexto del propio usuario.
    req.user = sanitizeUser(user, { includePreferences: true });
    return database.runAsUser(user.id, next);
  } catch (_error) {
    next(new AppError('Autenticacion invalida.', 401));
  }
}

function createAuthMiddleware({ config = env, repository = identityRepository } = {}) {
  return (req, res, next) => authenticateRequest(req, res, next, { config, repository });
}

const authMiddleware = createAuthMiddleware();
module.exports = { authMiddleware, createAuthMiddleware };
