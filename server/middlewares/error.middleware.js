const { AppError } = require('../utils/errors');
const { sendError } = require('../utils/response');

function notFoundMiddleware(_req, _res, next) {
  next(new AppError('Ruta no encontrada.', 404));
}

function errorMiddleware(error, _req, res, _next) {
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Error interno del servidor.';
  const details = error.details || null;

  return sendError(res, message, statusCode, details);
}

module.exports = { notFoundMiddleware, errorMiddleware };

