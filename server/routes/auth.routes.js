const express = require('express');
const { registerController, loginController, meController, logoutController } = require('../controllers/auth.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { validateRegister, validateLogin } = require('../middlewares/validation.middleware');
const { loginLimiter } = require('../middlewares/rateLimit.middleware');

const authRouter = express.Router();

authRouter.post('/register', validateRegister, registerController);
authRouter.post('/login', loginLimiter, validateLogin, loginController);
authRouter.get('/me', authMiddleware, meController);
authRouter.post('/logout', authMiddleware, logoutController);

module.exports = { authRouter };

