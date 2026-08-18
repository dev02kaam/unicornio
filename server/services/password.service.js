const argon2 = require('argon2');
const bcrypt = require('bcryptjs');

const ARGON2_OPTIONS = Object.freeze({
  type: argon2.argon2id,
  memoryCost: 19 * 1024,
  timeCost: 2,
  parallelism: 1,
});

function isArgon2idHash(passwordHash) {
  return typeof passwordHash === 'string' && passwordHash.startsWith('$argon2id$');
}

function isBcryptHash(passwordHash) {
  return typeof passwordHash === 'string' && /^\$2[aby]\$/.test(passwordHash);
}

async function hashPassword(password) {
  return argon2.hash(String(password), ARGON2_OPTIONS);
}

async function verifyPasswordHash(password, passwordHash) {
  if (isArgon2idHash(passwordHash)) {
    const valid = await argon2.verify(passwordHash, String(password), ARGON2_OPTIONS);
    return {
      valid,
      needsUpgrade: valid && argon2.needsRehash(passwordHash, ARGON2_OPTIONS),
    };
  }

  if (isBcryptHash(passwordHash)) {
    const valid = await bcrypt.compare(String(password), passwordHash);
    return { valid, needsUpgrade: valid };
  }

  return { valid: false, needsUpgrade: false };
}

async function comparePassword(password, passwordHash) {
  return (await verifyPasswordHash(password, passwordHash)).valid;
}

module.exports = {
  ARGON2_OPTIONS,
  hashPassword,
  verifyPasswordHash,
  comparePassword,
  isArgon2idHash,
  isBcryptHash,
};
