const { AppError } = require('../utils/errors');

function requireRole(roles) {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  return (req, _res, next) => {
    if (!req.user) {
      return next(new AppError('Autenticacion requerida.', 401));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError('No autorizado para este recurso.', 403));
    }

    return next();
  };
}

module.exports = { requireRole };

