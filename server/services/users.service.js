const bcrypt = require('bcryptjs');
const { database } = require('../config/database');
const { createUserModel, sanitizeUser } = require('../models/user.model');
const { AppError } = require('../utils/errors');
const { isEmail, isNonEmptyString, validatePassword, normalizeRole, pickDefined } = require('../utils/validators');

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

function createUser(data) {
  const name = String(data.name || '').trim();
  const email = String(data.email || '').trim().toLowerCase();
  const password = String(data.password || '');
  const role = normalizeRole(data.role);

  if (!isNonEmptyString(name)) {
    throw new AppError('El nombre es obligatorio.', 400);
  }

  if (!isEmail(email)) {
    throw new AppError('El email no es valido.', 400);
  }

  if (!validatePassword(password)) {
    throw new AppError('La contrasena debe tener al menos 8 caracteres.', 400);
  }

  assertUniqueEmail(email);

  const now = new Date().toISOString();
  const user = createUserModel({
    id: database.nextUserId(),
    name,
    email,
    passwordHash: bcrypt.hashSync(password, 10),
    role,
    isActive: true,
    schoolId: data.schoolId || null,
    groupId: data.groupId || null,
    ageRange: data.ageRange || null,
    createdAt: now,
    updatedAt: now,
  });

  const users = database.getUsers();
  users.push(user);
  database.setUsers(users);

  return sanitizeUser(user);
}

function createUserWithPasswordHash(data) {
  const name = String(data.name || '').trim();
  const email = String(data.email || '').trim().toLowerCase();
  const passwordHash = String(data.passwordHash || '');
  const role = normalizeRole(data.role);

  if (!isNonEmptyString(name)) {
    throw new AppError('El nombre es obligatorio.', 400);
  }

  if (!isEmail(email)) {
    throw new AppError('El email no es valido.', 400);
  }

  if (!isNonEmptyString(passwordHash)) {
    throw new AppError('El hash de contrasena es obligatorio.', 400);
  }

  assertUniqueEmail(email);

  const now = new Date().toISOString();
  const user = createUserModel({
    id: database.nextUserId(),
    name,
    email,
    passwordHash,
    role,
    isActive: true,
    schoolId: data.schoolId || null,
    groupId: data.groupId || null,
    ageRange: data.ageRange || null,
    createdAt: now,
    updatedAt: now,
  });

  const users = database.getUsers();
  users.push(user);
  database.setUsers(users);

  return sanitizeUser(user);
}

function updateUser(id, updates, options = {}) {
  const user = findUserById(id);
  if (!user) {
    throw new AppError('Usuario no encontrado.', 404);
  }

  const allowedKeys = ['name', 'email', 'schoolId', 'groupId', 'ageRange', 'role'];
  const patch = pickDefined(updates, allowedKeys);

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

  if (patch.role !== undefined && options.canUpdateRole) {
    user.role = normalizeRole(patch.role);
  }

  if (patch.schoolId !== undefined) {
    user.schoolId = patch.schoolId || null;
  }

  if (patch.groupId !== undefined) {
    user.groupId = patch.groupId || null;
  }

  if (patch.ageRange !== undefined) {
    user.ageRange = patch.ageRange || null;
  }

  user.updatedAt = new Date().toISOString();
  return sanitizeUser(user);
}

function deactivateUser(id) {
  const user = findUserById(id);
  if (!user) {
    throw new AppError('Usuario no encontrado.', 404);
  }

  user.isActive = false;
  user.updatedAt = new Date().toISOString();
  return sanitizeUser(user);
}

function verifyPassword(user, password) {
  return bcrypt.compareSync(password, user.passwordHash);
}

module.exports = {
  getAllUsers,
  findUserById,
  findUserByEmail,
  createUser,
  createUserWithPasswordHash,
  updateUser,
  deactivateUser,
  verifyPassword,
};
