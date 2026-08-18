const { AppError } = require('../utils/errors');
const { sendError } = require('../utils/response');

function notFoundMiddleware(_req, _res, next) {
  next(new AppError('Ruta no encontrada.', 404, null, 'NOT_FOUND'));
}

function getDefaultErrorCode(statusCode) {
  const codes = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    409: 'CONFLICT',
    410: 'GONE',
    413: 'PAYLOAD_TOO_LARGE',
    415: 'UNSUPPORTED_MEDIA_TYPE',
  };

  return codes[statusCode] || 'INTERNAL_ERROR';
}

function getBodyParserError(error) {
  const knownErrors = {
    'encoding.unsupported': {
      statusCode: 415,
      message: 'La codificación de la solicitud no es compatible.',
    },
    'entity.parse.failed': {
      statusCode: 400,
      message: 'El cuerpo JSON de la solicitud no es válido.',
    },
    'entity.too.large': {
      statusCode: 413,
      message: 'El cuerpo de la solicitud es demasiado grande.',
    },
    'parameters.too.many': {
      statusCode: 413,
      message: 'La solicitud contiene demasiados parámetros.',
    },
  };

  return knownErrors[error?.type] || null;
}

function errorMiddleware(error, req, res, _next) {
  const statusCode = error instanceof AppError ? error.statusCode : Number(error?.statusCode || 500);
  const logContext = {
    event: statusCode === 429 ? 'REQUEST_RATE_LIMITED' : 'REQUEST_REJECTED',
    requestId: req.id,
    method: req.method,
    path: req.path,
    statusCode,
    errorCode: error.code || error.type || error.name,
  };
  if (statusCode >= 500) req.log?.error(logContext, 'request failed');
  else if ([401, 403, 429].includes(statusCode)) req.log?.warn(logContext, 'request rejected');

  if (error instanceof AppError) {
    return sendError(
      res,
      error.message,
      error.statusCode,
      error.details,
      error.code || getDefaultErrorCode(error.statusCode),
    );
  }

  const bodyParserError = getBodyParserError(error);
  if (bodyParserError) {
    return sendError(
      res,
      bodyParserError.message,
      bodyParserError.statusCode,
      null,
      getDefaultErrorCode(bodyParserError.statusCode),
    );
  }

  if (Number.isInteger(error?.statusCode) && error.statusCode >= 400 && error.statusCode < 500) {
    return sendError(
      res,
      error.statusCode === 403 ? 'Solicitud rechazada.' : 'Solicitud no valida.',
      error.statusCode,
      null,
      getDefaultErrorCode(error.statusCode),
    );
  }

  return sendError(res, 'Error interno del servidor.', 500, null, 'INTERNAL_ERROR');
}

module.exports = { notFoundMiddleware, errorMiddleware };
