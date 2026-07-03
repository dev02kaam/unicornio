const { AppError } = require('../utils/errors');
const {
  isEmail,
  isNonEmptyString,
  validatePassword,
  isOneOf,
} = require('../utils/validators');
const {
  CENTER_TYPES,
  ACADEMIC_YEAR_STAGES,
  CENTER_ASSIGNMENT_ROLES,
  GROUP_ASSIGNMENT_ROLES,
} = require('../utils/constants');

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

function validateCenterCreate(req, _res, next) {
  const { name, code, type, academicYearId, city } = req.body || {};
  const errors = [];

  if (!isNonEmptyString(name)) {
    errors.push('El nombre del centro es obligatorio.');
  }
  if (code !== undefined && !isNonEmptyString(code)) {
    errors.push('El codigo del centro no puede estar vacio.');
  }
  if (type !== undefined && !isOneOf(String(type).toUpperCase(), Object.values(CENTER_TYPES))) {
    errors.push('El tipo de centro no es valido.');
  }
  if (academicYearId !== undefined && !isNonEmptyString(academicYearId)) {
    errors.push('El curso escolar no es valido.');
  }
  if (city !== undefined && !isNonEmptyString(city)) {
    errors.push('La ciudad no puede estar vacia.');
  }

  if (errors.length > 0) {
    return next(new AppError('Validacion fallida.', 400, errors));
  }

  return next();
}

function validateCenterUpdate(req, _res, next) {
  const { name, code, type, academicYearId, city } = req.body || {};
  const errors = [];

  if (name !== undefined && !isNonEmptyString(name)) {
    errors.push('El nombre del centro no puede estar vacio.');
  }
  if (code !== undefined && !isNonEmptyString(code)) {
    errors.push('El codigo del centro no puede estar vacio.');
  }
  if (type !== undefined && !isOneOf(String(type).toUpperCase(), Object.values(CENTER_TYPES))) {
    errors.push('El tipo de centro no es valido.');
  }
  if (academicYearId !== undefined && !isNonEmptyString(academicYearId)) {
    errors.push('El curso escolar no es valido.');
  }
  if (city !== undefined && !isNonEmptyString(city)) {
    errors.push('La ciudad no puede estar vacia.');
  }

  if (errors.length > 0) {
    return next(new AppError('Validacion fallida.', 400, errors));
  }

  return next();
}

function validateGroupCreate(req, _res, next) {
  const { name, code, stage, academicYearId, course, shift } = req.body || {};
  const errors = [];

  if (!isNonEmptyString(name)) {
    errors.push('El nombre del grupo es obligatorio.');
  }
  if (code !== undefined && !isNonEmptyString(code)) {
    errors.push('El codigo del grupo no puede estar vacio.');
  }
  if (stage !== undefined && !isOneOf(String(stage).toUpperCase(), Object.values(ACADEMIC_YEAR_STAGES))) {
    errors.push('La etapa educativa no es valida.');
  }
  if (academicYearId !== undefined && !isNonEmptyString(academicYearId)) {
    errors.push('El curso escolar no es valido.');
  }
  if (course !== undefined && !isNonEmptyString(course)) {
    errors.push('El curso no puede estar vacio.');
  }
  if (shift !== undefined && !isNonEmptyString(shift)) {
    errors.push('El turno no puede estar vacio.');
  }

  if (errors.length > 0) {
    return next(new AppError('Validacion fallida.', 400, errors));
  }

  return next();
}

function validateGroupUpdate(req, _res, next) {
  const { name, code, stage, academicYearId, course, shift } = req.body || {};
  const errors = [];

  if (name !== undefined && !isNonEmptyString(name)) {
    errors.push('El nombre del grupo no puede estar vacio.');
  }
  if (code !== undefined && !isNonEmptyString(code)) {
    errors.push('El codigo del grupo no puede estar vacio.');
  }
  if (stage !== undefined && !isOneOf(String(stage).toUpperCase(), Object.values(ACADEMIC_YEAR_STAGES))) {
    errors.push('La etapa educativa no es valida.');
  }
  if (academicYearId !== undefined && !isNonEmptyString(academicYearId)) {
    errors.push('El curso escolar no es valido.');
  }
  if (course !== undefined && !isNonEmptyString(course)) {
    errors.push('El curso no puede estar vacio.');
  }
  if (shift !== undefined && !isNonEmptyString(shift)) {
    errors.push('El turno no puede estar vacio.');
  }

  if (errors.length > 0) {
    return next(new AppError('Validacion fallida.', 400, errors));
  }

  return next();
}

function validateAssignmentCreate(req, _res, next) {
  const { role, isPrimary } = req.body || {};
  const errors = [];

  if (role !== undefined && !isNonEmptyString(role)) {
    errors.push('El rol de asignacion no puede estar vacio.');
  }

  if (isPrimary !== undefined && typeof isPrimary !== 'boolean') {
    errors.push('isPrimary debe ser un valor booleano.');
  }

  if (errors.length > 0) {
    return next(new AppError('Validacion fallida.', 400, errors));
  }

  return next();
}

function validateAssignmentDelete(_req, _res, next) {
  return next();
}

module.exports = {
  validateRegister,
  validateLogin,
  validateUserUpdate,
  validateAdminCreateUser,
  validateCenterCreate,
  validateCenterUpdate,
  validateGroupCreate,
  validateGroupUpdate,
  validateAssignmentCreate,
  validateAssignmentDelete,
};
