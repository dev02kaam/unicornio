const { AppError } = require('../utils/errors');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function requestSecurityMiddleware(config) {
  return (req, _res, next) => {
    if (SAFE_METHODS.has(req.method)) return next();

    // El callback OIDC se autentica con state/nonce y puede llegar como form_post desde el IdP.
    if (req.path === '/api/auth/oidc/callback') return next();

    const origin = req.get('origin');
    if (!origin || origin !== config.appOrigin) {
      return next(new AppError('Origen de solicitud no permitido.', 403, null, 'FORBIDDEN'));
    }

    const fetchSite = req.get('sec-fetch-site');
    if (fetchSite && fetchSite !== 'same-origin') {
      return next(new AppError('Contexto de navegacion no permitido.', 403, null, 'FORBIDDEN'));
    }

    return next();
  };
}

module.exports = { requestSecurityMiddleware, SAFE_METHODS };
