const { findUserById } = require('../services/users.service');
const { AppError } = require('../utils/errors');
const { sanitizeUser } = require('../models/user.model');
const { env } = require('../config/env');
const identityRepository = require('../repositories/identity.repository');
const { database } = require('../config/database');

async function authMiddleware(req, _res, next) {
  try {
    const userId = req.session?.userId;
    if (!userId) throw new AppError('Falta una sesion autenticada.', 401);

    if (env.appProfile === 'production') {
      const identity = await identityRepository.findUserByInternalId(userId);
      if (!identity || !identity.isActive || identity.sessionVersion !== Number(req.session.sessionVersion)) {
        await new Promise((resolve) => req.session.destroy(() => resolve()));
        throw new AppError('Usuario no valido o sesion revocada.', 401);
      }
      const { passwordHash, internalId, sessionVersion, ...publicUser } = identity;
      req.auth = { sessionId: req.sessionID, sub: internalId, sessionVersion };
      req.user = publicUser;
      return database.runAsUser(internalId, next);
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

module.exports = { authMiddleware };
