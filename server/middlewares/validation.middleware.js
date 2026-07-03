const { AppError } = require('../utils/errors');
const { isEmail, isNonEmptyString, validatePassword } = require('../utils/validators');

function validateRegister(req, _res, next) {
  const { name, email, password } = req.body || {};
  const errors = [];

  if (!isNonEmptyString(name)) {
    errors.push('El nombre es obligatorio.');
  }
  if (!isEmail(email)) {
    errors.push('El email no es valido.');
  }
  if (!validatePassword(password)) {
    errors.push('La contrasena debe tener al menos 8 caracteres.');
  }

  if (errors.length > 0) {
    return next(new AppError('Validacion fallida.', 400, errors));
  }

  return next();
}

function validateLogin(req, _res, next) {
  const { email, password } = req.body || {};
  const errors = [];

  if (!isEmail(email)) {
    errors.push('El email no es valido.');
  }
  if (!validatePassword(password)) {
    errors.push('La contrasena debe tener al menos 8 caracteres.');
  }

  if (errors.length > 0) {
    return next(new AppError('Validacion fallida.', 400, errors));
  }

  return next();
}

function validateUserUpdate(req, _res, next) {
  const { name, email } = req.body || {};
  const errors = [];

  if (name !== undefined && !isNonEmptyString(name)) {
    errors.push('El nombre no puede estar vacio.');
  }
  if (email !== undefined && !isEmail(email)) {
    errors.push('El email no es valido.');
  }

  if (errors.length > 0) {
    return next(new AppError('Validacion fallida.', 400, errors));
  }

  return next();
}

function validateAdminCreateUser(req, _res, next) {
  const { name, email, password } = req.body || {};
  const errors = [];

  if (!isNonEmptyString(name)) {
    errors.push('El nombre es obligatorio.');
  }
  if (!isEmail(email)) {
    errors.push('El email no es valido.');
  }
  if (!validatePassword(password)) {
    errors.push('La contrasena debe tener al menos 8 caracteres.');
  }

  if (errors.length > 0) {
    return next(new AppError('Validacion fallida.', 400, errors));
  }

  return next();
}

module.exports = {
  validateRegister,
  validateLogin,
  validateUserUpdate,
  validateAdminCreateUser,
};
