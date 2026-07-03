const { verifyToken } = require('../services/token.service');
const { findUserById } = require('../services/users.service');
const { AppError } = require('../utils/errors');
const { sanitizeUser } = require('../models/user.model');

function authMiddleware(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const [, token] = header.split(' ');

    if (!token) {
      throw new AppError('Falta token de autenticacion.', 401);
    }

    const payload = verifyToken(token);
    const user = findUserById(payload.sub);

    if (!user || !user.isActive) {
      throw new AppError('Usuario no valido o desactivado.', 401);
    }

    req.auth = payload;
    req.user = sanitizeUser(user);
    next();
  } catch (error) {
    next(new AppError('Autenticacion invalida.', 401));
  }
}

module.exports = { authMiddleware };

