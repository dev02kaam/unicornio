const { register, login, logout } = require('../services/auth.service');
const { sendSuccess } = require('../utils/response');
const { getDashboardContextForUser } = require('../utils/organization.helpers');

function registerController(req, res, next) {
  try {
    const result = register(req.body);
    return sendSuccess(res, result, 'Usuario registrado correctamente.', 201);
  } catch (error) {
    return next(error);
  }
}

function loginController(req, res, next) {
  try {
    const result = login(req.body);
    return sendSuccess(res, result, 'Inicio de sesion correcto.');
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

function logoutController(req, res) {
  return sendSuccess(res, logout(), 'Sesion cerrada correctamente.');
}

module.exports = {
  registerController,
  loginController,
  meController,
  logoutController,
};
