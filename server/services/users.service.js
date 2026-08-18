const { database } = require('../config/database');
const { createUserModel, sanitizeUser } = require('../models/user.model');
const { createCenterAssignmentModel } = require('../models/assignment.model');
const { AppError } = require('../utils/errors');
const { isEmail, isNonEmptyString, validatePassword, normalizeRole, pickDefined, isPastOrTodayDate, normalizeDateOnly } = require('../utils/validators');
const { CENTER_ASSIGNMENT_ROLES, UNICORN_GENDERS } = require('../utils/constants');
const { hashPassword, verifyPasswordHash } = require('./password.service');
const { env } = require('../config/env');
const identityRepository = require('../repositories/identity.repository');

function getAllUsers() {
  return database.getUsers().map(sanitizeUser);
}

function findUserById(id) {
  return database.getUsers().find((user) => user.id === String(id)) || null;
}

function findUserByEmail(email) {
  return database.getUsers().find((user) => user.email.toLowerCase() === String(email).toLowerCase()) || null;
}

function assertUniqueEmail(email, currentUserId = null) {
  const existing = findUserByEmail(email);
  if (existing && existing.id !== String(currentUserId)) {
    throw new AppError('Ya existe un usuario con ese email.', 409);
  }
}

function findCenterById(id) {
  return (database.getCollection('centers') || []).find((center) => center.id === String(id)) || null;
}

function getCenterAssignmentRoleForUser(role) {
  switch (String(role || '').toUpperCase()) {
    case 'SCHOOL':
      return CENTER_ASSIGNMENT_ROLES.SCHOOL_MANAGER;
    case 'TEACHER':
      return CENTER_ASSIGNMENT_ROLES.TEACHER;
    case 'PROFESSIONAL':
      return CENTER_ASSIGNMENT_ROLES.PROFESSIONAL;
    case 'STUDENT':
      return CENTER_ASSIGNMENT_ROLES.STUDENT;
    case 'FAMILY':
      return CENTER_ASSIGNMENT_ROLES.FAMILY;
    default:
      return CENTER_ASSIGNMENT_ROLES.OTHER;
  }
}

function ensureCenterAssignment(user, centerId, now) {
  if (!centerId) {
    return null;
  }

  const center = findCenterById(centerId);
  if (!center || !center.isActive) {
    throw new AppError('El centro asignado no es valido.', 404);
  }

  const assignments = database.getCollection('userCenterAssignments') || [];
  const existing = assignments.find((assignment) => assignment.userId === user.id && assignment.centerId === String(centerId));

  if (existing) {
    if (!existing.isActive) {
      existing.isActive = true;
      existing.updatedAt = now;
      database.setCollection('userCenterAssignments', assignments);
    }
    user.schoolId = String(centerId);
    database.persistUsers();
    return existing;
  }

  const assignment = createCenterAssignmentModel({
    id: database.nextId('userCenterAssignments', 'uca'),
    userId: user.id,
    centerId: String(centerId),
    role: getCenterAssignmentRoleForUser(user.role),
    isPrimary: true,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  assignments.forEach((item) => {
    if (item.userId === user.id && item.isActive) {
      item.isPrimary = false;
    }
  });

  assignments.push(assignment);
  database.setCollection('userCenterAssignments', assignments);
  user.schoolId = String(centerId);
  return assignment;
}

function resolveLinkedStudent(data, role) {
  if (String(role || '').toUpperCase() !== 'FAMILY') {
    return null;
  }

  const linkedStudentId = data.linkedStudentId ? String(data.linkedStudentId).trim() : null;
  if (!isNonEmptyString(linkedStudentId)) {
    throw new AppError('El estudiante vinculado es obligatorio para familias.', 400);
  }

  const linkedStudent = findUserById(linkedStudentId);
  if (!linkedStudent || !linkedStudent.isActive) {
    throw new AppError('El estudiante vinculado no es valido.', 404);
  }

  if (String(linkedStudent.role || '').toUpperCase() !== 'STUDENT') {
    throw new AppError('El usuario vinculado debe ser un alumno.', 400);
  }

  return {
    linkedStudentId: linkedStudent.id,
  };
}

function normalizeBirthDate(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return normalizeDateOnly(String(value).trim());
}

function assertValidStudentBirthDate(role, birthDate) {
  if (String(role || '').toUpperCase() !== 'STUDENT') {
    return;
  }

  if (!birthDate) {
    throw new AppError('La fecha de nacimiento es obligatoria para alumnos.', 400);
  }

  if (!isPastOrTodayDate(birthDate)) {
    throw new AppError('La fecha de nacimiento no es valida.', 400);
  }
}

async function createUser(data) {
  const name = String(data.name || '').trim();
  const email = String(data.email || '').trim().toLowerCase();
  const password = String(data.password || '');
  const role = normalizeRole(data.role);
  const schoolId = data.schoolId ? String(data.schoolId).trim() : null;
  const linkedStudent = resolveLinkedStudent(data, role);
  const birthDate = normalizeBirthDate(data.birthDate);
  const nextSchoolId = role === 'FAMILY' ? null : schoolId;
  const nextGroupId = role === 'FAMILY' ? null : (data.groupId || null);

  if (!isNonEmptyString(name)) {
    throw new AppError('El nombre es obligatorio.', 400);
  }

  if (!isEmail(email)) {
    throw new AppError('El email no es valido.', 400);
  }

  if (!validatePassword(password)) {
    throw new AppError('La contrasena debe tener al menos 8 caracteres.', 400);
  }

  if (role === 'FAMILY' && schoolId) {
    throw new AppError('Las familias no se vinculan directamente a un centro.', 400);
  }

  if (role === 'SCHOOL' && !data.allowSchoolCreation) {
    throw new AppError('Las cuentas de centro se crean desde el alta de centro.', 400);
  }

  assertValidStudentBirthDate(role, birthDate);
  assertUniqueEmail(email);

  const now = new Date().toISOString();
  const user = createUserModel({
    id: database.nextUserId(),
    name,
    email,
    passwordHash: await hashPassword(password),
    role,
    isActive: true,
    schoolId: nextSchoolId,
    groupId: nextGroupId,
    linkedStudentId: linkedStudent?.linkedStudentId || null,
    birthDate: role === 'STUDENT' ? birthDate : null,
    ageRange: data.ageRange || null,
    createdAt: now,
    updatedAt: now,
  });

  const users = database.getUsers();
  users.push(user);
  database.setUsers(users);

  if (user.schoolId && user.role !== 'ADMIN') {
    ensureCenterAssignment(user, user.schoolId, now);
  }
  database.persistUsers();

  return sanitizeUser(user);
}

function createUserWithPasswordHash(data) {
  const name = String(data.name || '').trim();
  const email = String(data.email || '').trim().toLowerCase();
  const passwordHash = String(data.passwordHash || '');
  const role = normalizeRole(data.role);
  const schoolId = data.schoolId ? String(data.schoolId).trim() : null;
  const linkedStudent = resolveLinkedStudent(data, role);
  const birthDate = normalizeBirthDate(data.birthDate);
  const nextSchoolId = role === 'FAMILY' ? null : schoolId;
  const nextGroupId = role === 'FAMILY' ? null : (data.groupId || null);

  if (!isNonEmptyString(name)) {
    throw new AppError('El nombre es obligatorio.', 400);
  }

  if (!isEmail(email)) {
    throw new AppError('El email no es valido.', 400);
  }

  if (!isNonEmptyString(passwordHash)) {
    throw new AppError('El hash de contrasena es obligatorio.', 400);
  }

  if (role === 'FAMILY' && schoolId) {
    throw new AppError('Las familias no se vinculan directamente a un centro.', 400);
  }

  if (role === 'SCHOOL' && !data.allowSchoolCreation) {
    throw new AppError('Las cuentas de centro se crean desde el alta de centro.', 400);
  }

  assertValidStudentBirthDate(role, birthDate);
  assertUniqueEmail(email);

  const now = new Date().toISOString();
  const user = createUserModel({
    id: database.nextUserId(),
    name,
    email,
    passwordHash,
    role,
    isActive: true,
    schoolId: nextSchoolId,
    groupId: nextGroupId,
    linkedStudentId: linkedStudent?.linkedStudentId || null,
    birthDate: role === 'STUDENT' ? birthDate : null,
    ageRange: data.ageRange || null,
    createdAt: now,
    updatedAt: now,
  });

  const users = database.getUsers();
  users.push(user);
  database.setUsers(users);

  if (user.schoolId && user.role !== 'ADMIN') {
    ensureCenterAssignment(user, user.schoolId, now);
  }
  database.persistUsers();

  return sanitizeUser(user);
}

async function updateUser(id, updates, options = {}) {
  const user = findUserById(id);
  if (!user) {
    throw new AppError('Usuario no encontrado.', 404);
  }

  const allowedKeys = ['name', 'email', 'password', 'schoolId', 'groupId', 'ageRange', 'birthDate', 'role', 'linkedStudentId'];
  const patch = pickDefined(updates, allowedKeys);
  const canUpdateRole = Boolean(options.canUpdateRole);
  const roleChanged = patch.role !== undefined && canUpdateRole;
  const nextRole = roleChanged ? normalizeRole(patch.role) : user.role;
  const nextBirthDate = nextRole === 'STUDENT'
    ? (patch.birthDate !== undefined ? normalizeBirthDate(patch.birthDate) : normalizeBirthDate(user.birthDate))
    : null;
  const nextLinkedStudentId = nextRole === 'FAMILY'
    ? (patch.linkedStudentId !== undefined ? (patch.linkedStudentId || null) : user.linkedStudentId)
    : null;

  if (patch.name !== undefined) {
    if (!isNonEmptyString(patch.name)) {
      throw new AppError('El nombre no puede estar vacio.', 400);
    }
    user.name = String(patch.name).trim();
  }

  if (patch.email !== undefined) {
    if (!isEmail(patch.email)) {
      throw new AppError('El email no es valido.', 400);
    }
    assertUniqueEmail(String(patch.email).trim().toLowerCase(), user.id);
    user.email = String(patch.email).trim().toLowerCase();
  }

  if (patch.password !== undefined) {
    if (!validatePassword(patch.password)) {
      throw new AppError('La contrasena debe tener al menos 8 caracteres.', 400);
    }
    user.passwordHash = await hashPassword(String(patch.password));
  }

  if (patch.schoolId !== undefined) {
    const nextSchoolId = patch.schoolId || null;
    if (nextRole === 'FAMILY') {
      throw new AppError('Las familias no se vinculan directamente a un centro.', 400);
    }
    user.schoolId = nextSchoolId;
  }

  if (patch.groupId !== undefined) {
    if (nextRole === 'FAMILY') {
      throw new AppError('Las familias no se vinculan directamente a un grupo.', 400);
    }
    user.groupId = patch.groupId || null;
  }

  if (patch.linkedStudentId !== undefined) {
    if (nextRole !== 'FAMILY') {
      throw new AppError('Solo las familias pueden vincular un estudiante.', 400);
    }
  }

  if (patch.ageRange !== undefined) {
    user.ageRange = patch.ageRange || null;
  }

  assertValidStudentBirthDate(nextRole, nextBirthDate);

  if (nextRole === 'FAMILY') {
    if (!nextLinkedStudentId) {
      throw new AppError('Las familias necesitan un estudiante vinculado.', 400);
    }

    const linkedStudent = findUserById(nextLinkedStudentId);
    if (!linkedStudent || !linkedStudent.isActive) {
      throw new AppError('El estudiante vinculado no es valido.', 404);
    }
    if (String(linkedStudent.role || '').toUpperCase() !== 'STUDENT') {
      throw new AppError('El usuario vinculado debe ser un alumno.', 400);
    }

    user.role = nextRole;
    user.linkedStudentId = linkedStudent.id;
    user.schoolId = null;
    user.groupId = null;
    user.birthDate = null;
  } else {
    if (roleChanged) {
      user.role = nextRole;
    }
    user.linkedStudentId = null;
    user.birthDate = nextRole === 'STUDENT' ? nextBirthDate : null;
  }

  user.updatedAt = new Date().toISOString();
  database.persistUsers();
  return sanitizeUser(user);
}

function deleteUser(id) {
  const user = findUserById(id);
  if (!user) {
    throw new AppError('Usuario no encontrado.', 404);
  }

  const centerAssignments = database.getCollection('userCenterAssignments') || [];
  const groupAssignments = database.getCollection('userGroupAssignments') || [];
  database.setCollection('userCenterAssignments', centerAssignments.filter((assignment) => assignment.userId !== user.id));
  database.setCollection('userGroupAssignments', groupAssignments.filter((assignment) => assignment.userId !== user.id));
  database.setUsers(database.getUsers().filter((candidate) => candidate.id !== user.id));
  database.persistUsers();
  return sanitizeUser(user);
}

async function verifyPassword(user, password) {
  const verification = await verifyPasswordHash(password, user.passwordHash);
  if (verification.valid && verification.needsUpgrade) {
    user.passwordHash = await hashPassword(password);
    user.updatedAt = new Date().toISOString();
    database.persistUsers();
    await database.flush();
  }
  return verification.valid;
}

async function changePassword(id, currentPassword, newPassword) {
  const user = findUserById(id);
  if (!user) {
    throw new AppError('Usuario no encontrado.', 404);
  }

  if (!await verifyPassword(user, String(currentPassword || ''))) {
    throw new AppError('La contraseña actual no es correcta.', 400);
  }

  if (!validatePassword(newPassword)) {
    throw new AppError('La nueva contraseña debe tener al menos 8 caracteres.', 400);
  }

  user.passwordHash = await hashPassword(String(newPassword));
  user.sessionVersion = Number(user.sessionVersion || 1) + 1;
  user.updatedAt = new Date().toISOString();
  database.persistUsers();
  return sanitizeUser(user);
}

function updateUnicornGender(id, unicornGender) {
  const user = findUserById(id);
  if (!user) {
    throw new AppError('Usuario no encontrado.', 404);
  }

  const normalizedGender = String(unicornGender || '').toUpperCase();
  if (!Object.values(UNICORN_GENDERS).includes(normalizedGender)) {
    throw new AppError('La preferencia del unicornio no es valida.', 400);
  }

  user.unicornGender = normalizedGender;
  user.updatedAt = new Date().toISOString();
  database.persistUsers();
  return sanitizeUser(user, { includePreferences: true });
}

async function updateOwnProfile(currentUser, auth, profile, options = {}) {
  const config = options.config || env;
  const repository = options.repository || identityRepository;
  if (config.appProfile === 'production') {
    const updated = await repository.updateOwnProfile(auth.sub, profile);
    if (!updated) throw new AppError('Usuario no encontrado.', 404);
    const { passwordHash, internalId, sessionVersion, ...publicUser } = updated;
    return publicUser;
  }
  return updateUser(currentUser.id, { name: profile.name }, { canUpdateRole: false });
}

async function updateOwnCompanion(currentUser, auth, unicornGender, options = {}) {
  const normalizedGender = String(unicornGender || '').toUpperCase();
  if (!Object.values(UNICORN_GENDERS).includes(normalizedGender)) {
    throw new AppError('La preferencia del unicornio no es valida.', 400);
  }
  const config = options.config || env;
  const repository = options.repository || identityRepository;
  if (config.appProfile === 'production') {
    const updated = await repository.updateOwnCompanion(auth.sub, normalizedGender);
    if (!updated) throw new AppError('Usuario no encontrado.', 404);
    const { passwordHash, internalId, sessionVersion, ...publicUser } = updated;
    return publicUser;
  }
  return updateUnicornGender(currentUser.id, normalizedGender);
}

module.exports = {
  getAllUsers,
  findUserById,
  findUserByEmail,
  createUser,
  createUserWithPasswordHash,
  updateUser,
  changePassword,
  updateUnicornGender,
  updateOwnProfile,
  updateOwnCompanion,
  deleteUser,
  verifyPassword,
};
