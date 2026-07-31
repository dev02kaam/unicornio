const { AppError } = require('../utils/errors');
const {
  isEmail,
  isNonEmptyString,
  validatePassword,
  isOneOf,
  isRole,
  isPastOrTodayDate,
} = require('../utils/validators');
const {
  CENTER_TYPES,
  ACADEMIC_YEAR_STAGES,
  CENTER_ASSIGNMENT_ROLES,
  GROUP_ASSIGNMENT_ROLES,
  UNICORN_GENDERS,
} = require('../utils/constants');

function validateRegister(req, _res, next) {
  const { name, email, password, birthDate, schoolId, groupId } = req.body || {};
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
  if (!isNonEmptyString(birthDate)) {
    errors.push('La fecha de nacimiento es obligatoria para alumnos.');
  } else if (!isPastOrTodayDate(birthDate)) {
    errors.push('La fecha de nacimiento no es valida.');
  }
  if (isNonEmptyString(schoolId) || isNonEmptyString(groupId)) {
    errors.push('La asignacion a centros y grupos debe realizarla un centro autorizado.');
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

function validateChangePassword(req, _res, next) {
  const { currentPassword, newPassword } = req.body || {};
  const errors = [];

  if (!isNonEmptyString(currentPassword)) {
    errors.push('La contraseña actual es obligatoria.');
  }
  if (!validatePassword(newPassword)) {
    errors.push('La nueva contraseña debe tener al menos 8 caracteres.');
  }

  if (errors.length > 0) {
    return next(new AppError('Validación fallida.', 400, errors));
  }

  return next();
}

function validateCompanionPreference(req, _res, next) {
  const { unicornGender } = req.body || {};
  if (!isOneOf(String(unicornGender || '').toUpperCase(), Object.values(UNICORN_GENDERS))) {
    return next(new AppError('Selecciona una preferencia valida para tu unicornio.', 400));
  }

  return next();
}

function validateUserUpdate(req, _res, next) {
  const { name, email, password, role, schoolId, linkedStudentId, birthDate } = req.body || {};
  const errors = [];

  if (name !== undefined && !isNonEmptyString(name)) {
    errors.push('El nombre no puede estar vacio.');
  }
  if (email !== undefined && !isEmail(email)) {
    errors.push('El email no es valido.');
  }
  if (password !== undefined && !validatePassword(password)) {
    errors.push('La contrasena debe tener al menos 8 caracteres.');
  }
  if (role !== undefined && !isRole(role)) {
    errors.push('El rol no es valido.');
  }
  if (schoolId !== undefined && schoolId !== null && !isNonEmptyString(schoolId)) {
    errors.push('El centro no puede estar vacio.');
  }
  if (linkedStudentId !== undefined && linkedStudentId !== null && !isNonEmptyString(linkedStudentId)) {
    errors.push('El estudiante vinculado no puede estar vacio.');
  }
  if (birthDate !== undefined && birthDate !== null && birthDate !== '' && !isPastOrTodayDate(birthDate)) {
    errors.push('La fecha de nacimiento no es valida.');
  }
  if (String(role || '').toUpperCase() === 'STUDENT' && birthDate === '') {
    errors.push('La fecha de nacimiento es obligatoria para alumnos.');
  }

  if (errors.length > 0) {
    return next(new AppError('Validacion fallida.', 400, errors));
  }

  return next();
}

function validateAdminCreateUser(req, _res, next) {
  const { name, email, password, role, schoolId, linkedStudentId, birthDate } = req.body || {};
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
  if (!isRole(role)) {
    errors.push('El rol no es valido.');
  }

  const normalizedRole = String(role || '').toUpperCase();
  const requiresCenter = ['TEACHER', 'PROFESSIONAL', 'STUDENT'].includes(normalizedRole);
  if (requiresCenter && !isNonEmptyString(schoolId)) {
    errors.push('Selecciona un centro para este tipo de usuario.');
  }
  if (normalizedRole === 'SCHOOL') {
    errors.push('Las cuentas de centro se crean desde el alta de centro.');
  }
  if (normalizedRole === 'FAMILY' && isNonEmptyString(schoolId)) {
    errors.push('Las familias no se vinculan directamente a un centro.');
  }
  if (normalizedRole === 'FAMILY' && !isNonEmptyString(linkedStudentId)) {
    errors.push('Selecciona un estudiante para la familia.');
  }
  if (normalizedRole === 'STUDENT' && !isNonEmptyString(birthDate)) {
    errors.push('Indica la fecha de nacimiento del alumno.');
  }
  if (birthDate !== undefined && birthDate !== null && birthDate !== '' && !isPastOrTodayDate(birthDate)) {
    errors.push('La fecha de nacimiento no es valida.');
  }

  if (errors.length > 0) {
    return next(new AppError('Validacion fallida.', 400, errors));
  }

  return next();
}

function validateCenterCreate(req, _res, next) {
  const {
    name,
    code,
    type,
    academicYearId,
    city,
    questionnaireSupportContact,
    userName,
    userEmail,
    userPassword,
  } = req.body || {};
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
  if (questionnaireSupportContact !== undefined && !isNonEmptyString(questionnaireSupportContact)) {
    errors.push('El contacto de apoyo no puede estar vacio.');
  }
  if (userName !== undefined && !isNonEmptyString(userName)) {
    errors.push('El nombre de acceso no puede estar vacio.');
  }
  if (userEmail !== undefined && !isEmail(userEmail)) {
    errors.push('El email de acceso no es valido.');
  }
  if (userPassword !== undefined && !validatePassword(userPassword)) {
    errors.push('La contrasena de acceso debe tener al menos 8 caracteres.');
  }

  if (errors.length > 0) {
    return next(new AppError('Validacion fallida.', 400, errors));
  }

  return next();
}

function validateCenterUpdate(req, _res, next) {
  const { name, code, type, academicYearId, city, questionnaireSupportContact } = req.body || {};
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
  if (questionnaireSupportContact !== undefined && !isNonEmptyString(questionnaireSupportContact)) {
    errors.push('El contacto de apoyo no puede estar vacio.');
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

function validateConsentRequest(req, _res, next) {
  const { studentId, familyUserId, legalTextVersionId, centerId, campaignId } = req.body || {};
  const errors = [];

  if (!isNonEmptyString(studentId)) {
    errors.push('El estudiante es obligatorio.');
  }
  if (!isNonEmptyString(familyUserId)) {
    errors.push('La familia es obligatoria.');
  }
  if (!isNonEmptyString(legalTextVersionId)) {
    errors.push('La version legal es obligatoria.');
  }
  if (centerId !== undefined && !isNonEmptyString(centerId)) {
    errors.push('El centro no es valido.');
  }
  if (campaignId !== undefined && campaignId !== null && !isNonEmptyString(campaignId)) {
    errors.push('La campaña no es válida.');
  }

  if (errors.length > 0) {
    return next(new AppError('Validacion fallida.', 400, errors));
  }

  return next();
}

function validateConsentRevoke(req, _res, next) {
  const { reason } = req.body || {};
  const errors = [];

  if (!isNonEmptyString(reason)) {
    errors.push('Debes indicar un motivo para revocar el consentimiento.');
  }

  if (errors.length > 0) {
    return next(new AppError('Validacion fallida.', 400, errors));
  }

  return next();
}

function validateLegalTextVersionCreate(req, _res, next) {
  const { version, title, content, isActive, effectiveFrom, effectiveTo } = req.body || {};
  const errors = [];

  if (!isNonEmptyString(version)) {
    errors.push('La version es obligatoria.');
  }
  if (!isNonEmptyString(title)) {
    errors.push('El titulo es obligatorio.');
  }
  if (!isNonEmptyString(content)) {
    errors.push('El contenido es obligatorio.');
  }
  if (isActive !== undefined && typeof isActive !== 'boolean') {
    errors.push('isActive debe ser un valor booleano.');
  }
  if (effectiveFrom !== undefined && !isNonEmptyString(effectiveFrom)) {
    errors.push('La fecha de inicio no es valida.');
  }
  if (effectiveTo !== undefined && !isNonEmptyString(effectiveTo)) {
    errors.push('La fecha de fin no es valida.');
  }

  if (errors.length > 0) {
    return next(new AppError('Validacion fallida.', 400, errors));
  }

  return next();
}

module.exports = {
  validateRegister,
  validateLogin,
  validateChangePassword,
  validateCompanionPreference,
  validateUserUpdate,
  validateAdminCreateUser,
  validateCenterCreate,
  validateCenterUpdate,
  validateGroupCreate,
  validateGroupUpdate,
  validateAssignmentCreate,
  validateAssignmentDelete,
  validateConsentRequest,
  validateConsentRevoke,
  validateLegalTextVersionCreate,
};
