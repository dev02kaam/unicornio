const express = require('express');
const {
  registerController,
  loginController,
  meController,
  logoutController,
  changePasswordController,
  csrfController,
  sessionController,
  oidcStartController,
  oidcCallbackController,
} = require('../controllers/auth.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { loginLimiter } = require('../middlewares/rateLimit.middleware');
const { validateRequest } = require('../middlewares/schema.middleware');
const {
  registerBodySchema,
  loginBodySchema,
  changePasswordBodySchema,
  oidcCallbackSchema,
} = require('../schemas/auth.schemas');
const { emptyQuerySchema, emptyBodySchema } = require('../schemas/common.schemas');

const authRouter = express.Router();
const oidcFormParser = express.urlencoded({
  extended: false,
  limit: '8kb',
  parameterLimit: 10,
});

authRouter.get('/oidc/start', validateRequest({ query: emptyQuerySchema }), oidcStartController);
authRouter.get('/oidc/callback', validateRequest({ query: oidcCallbackSchema }), oidcCallbackController);
authRouter.post('/oidc/callback', oidcFormParser, validateRequest({ body: oidcCallbackSchema }), oidcCallbackController);
authRouter.post('/register', validateRequest({ body: registerBodySchema }), registerController);
authRouter.post('/login', loginLimiter, validateRequest({ body: loginBodySchema }), loginController);
authRouter.get('/csrf', csrfController);
authRouter.get('/session', authMiddleware, sessionController);
authRouter.get('/me', authMiddleware, meController);
authRouter.post('/logout', authMiddleware, validateRequest({ body: emptyBodySchema }), logoutController);
authRouter.post('/change-password', authMiddleware, validateRequest({ body: changePasswordBodySchema }), changePasswordController);

module.exports = { authRouter };
