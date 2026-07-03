function sendSuccess(res, data, message = 'OK', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

function sendError(res, message, statusCode = 400, details = null, errorCode = null) {
  return res.status(statusCode).json({
    success: false,
    message,
    ...(errorCode ? { error: { code: errorCode } } : {}),
    ...(details ? { details } : {}),
  });
}

module.exports = { sendSuccess, sendError };
