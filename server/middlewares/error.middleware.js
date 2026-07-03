const { AppError } = require('../utils/errors');
const { sendError } = require('../utils/response');

function notFoundMiddleware(_req, _res, next) {
  next(new AppError('Ruta no encontrada.', 404, null, 'NOT_FOUND'));
}

function errorMiddleware(error, _req, res, _next) {
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Error interno del servidor.';
  const details = error.details || null;
  const code = error.code || (statusCode === 404 ? 'NOT_FOUND' : statusCode === 403 ? 'FORBIDDEN' : statusCode === 401 ? 'UNAUTHORIZED' : statusCode === 400 ? 'BAD_REQUEST' : 'INTERNAL_ERROR');

  return sendError(res, message, statusCode, details, code);
}

module.exports = { notFoundMiddleware, errorMiddleware };
