const { AppError } = require('../utils/errors');
const { createToken } = require('./token.service');
const { createUser, findUserByEmail, verifyPassword } = require('./users.service');
const { sanitizeUser } = require('../models/user.model');

function register(payload) {
  const user = createUser({
    name: payload.name,
    email: payload.email,
    password: payload.password,
    role: 'STUDENT',
    schoolId: payload.schoolId,
    groupId: payload.groupId,
    ageRange: payload.ageRange,
  });

  const token = createToken({
    sub: user.id,
    role: user.role,
    email: user.email,
  });

  return {
    token,
    user,
  };
}

function login(payload) {
  const email = String(payload.email || '').trim().toLowerCase();
  const password = String(payload.password || '');
  const user = findUserByEmail(email);

  if (!user || !user.isActive) {
    throw new AppError('Credenciales invalidas.', 401);
  }

  if (!verifyPassword(user, password)) {
    throw new AppError('Credenciales invalidas.', 401);
  }

  const publicUser = sanitizeUser(user);
  const token = createToken({
    sub: publicUser.id,
    role: publicUser.role,
    email: publicUser.email,
  });

  return {
    token,
    user: publicUser,
  };
}

function logout() {
  return {
    message: 'Sesión cerrada correctamente.',
  };
}

module.exports = { register, login, logout };
