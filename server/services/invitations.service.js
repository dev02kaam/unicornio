const crypto = require('node:crypto');
const { AppError } = require('../utils/errors');
const { hashPassword } = require('./password.service');
const invitationRepository = require('../repositories/invitations.repository');

const INVITATION_TTL_MS = 24 * 60 * 60 * 1000;

function hashInvitationToken(token) {
  return crypto.createHash('sha256').update(String(token), 'utf8').digest();
}

function normalizeInvitation(data) {
  const role = String(data.role || '').toUpperCase();
  if (!['STUDENT', 'FAMILY'].includes(role)) {
    throw new AppError('El rol de invitacion no es valido.', 400);
  }
  if (role === 'FAMILY' && !data.studentUserId) {
    throw new AppError('La invitacion familiar requiere un alumno vinculado.', 400);
  }
  if (role === 'STUDENT' && (!data.centerId || !data.groupId)) {
    throw new AppError('La invitacion de alumno requiere centro y grupo.', 400);
  }
  return {
    email: String(data.email || '').trim().toLowerCase(),
    role,
    centerId: data.centerId || null,
    groupId: data.groupId || null,
    studentUserId: data.studentUserId || null,
  };
}

async function issueInvitation(data, actor, options = {}) {
  const repository = options.repository || invitationRepository;
  const now = options.now ? options.now() : new Date();
  const randomBytes = options.randomBytes || crypto.randomBytes;
  const token = randomBytes(32).toString('base64url');
  const normalized = normalizeInvitation(data);
  const expiresAt = new Date(now.getTime() + INVITATION_TTL_MS);

  const invitation = await repository.createInvitation({
    ...normalized,
    tokenHash: hashInvitationToken(token),
    invitedByUserId: actor.internalId || actor.id,
    expiresAt,
  });
  if (!invitation) {
    throw new AppError('El recurso solicitado no existe.', 404, null, 'NOT_FOUND');
  }
  return {
    invitation: {
      id: invitation.id,
      email: normalized.email,
      role: normalized.role,
      expiresAt: invitation.expires_at || expiresAt,
    },
    token,
  };
}

async function acceptInvitation(token, data, options = {}) {
  const repository = options.repository || invitationRepository;
  let tokenBytes;
  try {
    tokenBytes = Buffer.from(String(token), 'base64url');
  } catch (_error) {
    tokenBytes = Buffer.alloc(0);
  }
  if (tokenBytes.length !== 32) {
    throw new AppError('La invitacion no es valida o ha caducado.', 410, null, 'GONE');
  }

  const passwordHash = await hashPassword(data.password);
  const user = await repository.consumeInvitation({
    tokenHash: hashInvitationToken(token),
    name: String(data.name || '').trim(),
    passwordHash,
    now: options.now ? options.now() : new Date(),
  });
  if (!user) {
    throw new AppError('La invitacion no es valida o ha caducado.', 410, null, 'GONE');
  }
  return user;
}

module.exports = {
  INVITATION_TTL_MS,
  issueInvitation,
  acceptInvitation,
  hashInvitationToken,
};
