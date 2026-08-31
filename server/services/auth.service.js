const { AppError } = require('../utils/errors');
const {
  createUser,
  findUserByEmail,
  verifyPassword,
  changePassword: changeDemoPassword,
} = require('./users.service');
const { sanitizeUser } = require('../models/user.model');
const { env } = require('../config/env');
const identityRepository = require('../repositories/identity.repository');
const { verifyPasswordHash, hashPassword } = require('./password.service');
const { verifyTotp } = require('./totp.service');

async function register(payload) {
  if (!env.publicRegistrationEnabled) {
    throw new AppError('Ruta no encontrada.', 404, null, 'NOT_FOUND');
  }

  const user = await createUser({
    name: payload.name,
    email: payload.email,
    password: payload.password,
    role: 'STUDENT',
    birthDate: payload.birthDate,
    ageRange: payload.ageRange,
  });

  return { user };
}

async function login(payload, options = {}) {
  const config = options.config || env;
  const repository = options.repository || identityRepository;
  const email = String(payload.email || '').trim().toLowerCase();
  const password = String(payload.password || '');

  if (config.appProfile === 'production') {
    const identity = await repository.findLocalUserByEmail(email);
    const allowedLocalRoles = ['STUDENT', 'FAMILY', 'ADMIN'];
    if (config.localAdultAuthEnabled) {
      allowedLocalRoles.push('SCHOOL', 'TEACHER', 'PROFESSIONAL');
    }
    if (!identity || !identity.isActive || !allowedLocalRoles.includes(identity.role) || !identity.passwordHash) {
      throw new AppError('Credenciales invalidas.', 401);
    }

    const verification = await verifyPasswordHash(password, identity.passwordHash);
    if (!verification.valid) throw new AppError('Credenciales invalidas.', 401);
    if (identity.role === 'ADMIN' && !verifyTotp(payload.mfaCode, config.emergencyAdminTotpSecret)) {
      throw new AppError('Credenciales invalidas.', 401);
    }
    if (verification.needsUpgrade) {
      await repository.replacePasswordHash(
        identity.internalId,
        identity.passwordHash,
        await hashPassword(password),
      );
    }

    const { passwordHash, internalId, sessionVersion, ...user } = identity;
    return { user, auth: { internalId, sessionVersion } };
  }

  const user = findUserByEmail(email);

  if (!user || !user.isActive) {
    throw new AppError('Credenciales invalidas.', 401);
  }

  if (!await verifyPassword(user, password)) {
    throw new AppError('Credenciales invalidas.', 401);
  }

  const publicUser = sanitizeUser(user, { includePreferences: true });
  return {
    user: publicUser,
    auth: { internalId: publicUser.id, sessionVersion: Number(user.sessionVersion || 1) },
  };
}

function logout() {
  return {
    message: 'Sesión cerrada correctamente.',
  };
}

async function changePasswordAndRevokeSessions(currentUser, auth, payload, options = {}) {
  const config = options.config || env;
  const repository = options.repository || identityRepository;

  if (config.appProfile === 'production') {
    const identity = await repository.findUserByInternalId(auth.sub);
    if (!identity || !identity.passwordHash) throw new AppError('Usuario no encontrado.', 404);
    const verification = await verifyPasswordHash(payload.currentPassword, identity.passwordHash);
    if (!verification.valid) throw new AppError('La contrasena actual no es correcta.', 400);
    const sessionVersion = await repository.changePasswordAndRevokeSessions(
      identity.internalId,
      await hashPassword(payload.newPassword),
    );
    if (!sessionVersion) throw new AppError('Usuario no encontrado.', 404);
    const { passwordHash, internalId, ...user } = identity;
    return { user, sessionVersion };
  }

  const user = await changeDemoPassword(currentUser.id, payload.currentPassword, payload.newPassword);
  return { user, sessionVersion: Number(findUserByEmail(user.email).sessionVersion) };
}

module.exports = { register, login, logout, changePasswordAndRevokeSessions };
