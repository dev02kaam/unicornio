const {
  register,
  login,
  logout,
  changePasswordAndRevokeSessions,
} = require('../services/auth.service');
const { sendSuccess } = require('../utils/response');
const { getDashboardContextForUser } = require('../utils/organization.helpers');
const { database } = require('../config/database');
const { generateCsrfToken, revokeCsrfToken } = require('../security/csrf');
const { env } = require('../config/env');
const { getSessionCookieName } = require('../config/session');
const { beginOidcLogin, completeOidcLogin } = require('../services/oidc.service');

function regenerateSession(req) {
  return new Promise((resolve, reject) => req.session.regenerate((error) => (error ? reject(error) : resolve())));
}

function saveSession(req) {
  return new Promise((resolve, reject) => req.session.save((error) => (error ? reject(error) : resolve())));
}

async function registerController(req, res, next) {
  try {
    const result = await register(req.body);
    await database.flush();
    return sendSuccess(res, result, 'Usuario registrado correctamente.', 201);
  } catch (error) {
    return next(error);
  }
}

async function loginController(req, res, next) {
  try {
    const result = await login(req.body);
    await regenerateSession(req);
    req.session.userId = result.auth.internalId;
    req.session.sessionVersion = result.auth.sessionVersion;
    req.session.createdAt = Date.now();
    req.session.authenticatedAt = Date.now();
    const csrfToken = generateCsrfToken(req, true);
    await saveSession(req);
    req.log?.info({ event: 'AUTH_LOGIN_SUCCESS', userId: result.user.id, role: result.user.role }, 'authentication succeeded');
    return sendSuccess(res, { user: result.user, csrfToken }, 'Inicio de sesion correcto.');
  } catch (error) {
    return next(error);
  }
}

function meController(req, res) {
  return sendSuccess(
    res,
    {
      user: {
        ...req.user,
        context: getDashboardContextForUser(req.user),
      },
    },
    'Usuario autenticado.',
  );
}

function logoutController(req, res, next) {
  revokeCsrfToken(req);
  return req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie(getSessionCookieName(env), { path: '/' });
    req.log?.info({ event: 'AUTH_LOGOUT', userId: req.user.id }, 'session destroyed');
    return sendSuccess(res, logout(), 'Sesion cerrada correctamente.');
  });
}

function csrfController(req, res) {
  return sendSuccess(res, { csrfToken: generateCsrfToken(req) }, 'Token CSRF generado.');
}

function sessionController(req, res) {
  return meController(req, res);
}

async function oidcStartController(req, res, next) {
  try {
    const redirectUrl = await beginOidcLogin(req.session, { config: env.oidc });
    await saveSession(req);
    return res.redirect(302, redirectUrl.href);
  } catch (error) {
    return next(error);
  }
}

async function oidcCallbackController(req, res, next) {
  try {
    const callbackUrl = new URL(env.oidc.redirectUri);
    const parameters = req.method === 'POST' ? req.body : req.query;
    Object.entries(parameters || {}).forEach(([key, value]) => {
      if (typeof value === 'string') callbackUrl.searchParams.set(key, value);
    });
    const user = await completeOidcLogin(callbackUrl, req.session, { config: env.oidc });
    await regenerateSession(req);
    req.session.userId = user.internalId;
    req.session.sessionVersion = user.sessionVersion || 1;
    req.session.createdAt = Date.now();
    req.session.authenticatedAt = Date.now();
    generateCsrfToken(req, true);
    await saveSession(req);
    req.log?.info({ event: 'AUTH_OIDC_SUCCESS', userId: user.id, role: user.role }, 'OIDC authentication succeeded');
    return res.redirect(303, '/dashboard.html');
  } catch (error) {
    return next(error);
  }
}

async function changePasswordController(req, res, next) {
  try {
    const result = await changePasswordAndRevokeSessions(req.user, req.auth, req.body);
    await database.flush();
    revokeCsrfToken(req);
    await new Promise((resolve, reject) => req.session.destroy((error) => (error ? reject(error) : resolve())));
    res.clearCookie(getSessionCookieName(env), { path: '/' });
    req.log?.info({ event: 'PASSWORD_CHANGED', userId: req.user.id }, 'password changed and sessions revoked');
    return sendSuccess(res, { user: result.user }, 'Contrasena actualizada. Inicia sesion de nuevo.');
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  registerController,
  loginController,
  meController,
  logoutController,
  changePasswordController,
  csrfController,
  sessionController,
  oidcStartController,
  oidcCallbackController,
};
