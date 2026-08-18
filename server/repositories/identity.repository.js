const { database } = require('../config/database');

function mapUser(row) {
  if (!row) return null;
  return {
    internalId: row.internal_id || row.id,
    id: row.public_id,
    email: row.email,
    name: row.name,
    role: row.role,
    isActive: row.status === 'ACTIVE',
    passwordHash: row.password_hash,
    sessionVersion: Number(row.session_version),
    birthDate: row.birth_date,
    ageRange: row.age_range,
    unicornGender: row.unicorn_gender,
  };
}

async function findLocalUserByEmail(email) {
  const result = await database.query(
    `select id as internal_id, public_id, email, name, role, status, password_hash,
            session_version, birth_date, age_range, unicorn_gender
     from unicornio_users
     where lower(email) = lower($1)`,
    [email],
  );
  return mapUser(result.rows[0]);
}

async function findUserByInternalId(internalId) {
  const result = await database.query(
    `select id as internal_id, public_id, email, name, role, status, password_hash,
            session_version, birth_date, age_range, unicorn_gender
     from unicornio_users
     where id = $1`,
    [internalId],
  );
  return mapUser(result.rows[0]);
}

async function replacePasswordHash(internalId, previousHash, passwordHash) {
  const result = await database.query(
    `update unicornio_users
     set password_hash = $3, updated_at = now()
     where id = $1 and password_hash = $2`,
    [internalId, previousHash, passwordHash],
  );
  return result.rowCount === 1;
}

async function changePasswordAndRevokeSessions(internalId, passwordHash) {
  const result = await database.query(
    `update unicornio_users
     set password_hash = $2,
         session_version = session_version + 1,
         updated_at = now()
     where id = $1
     returning session_version`,
    [internalId, passwordHash],
  );
  return result.rows[0] ? Number(result.rows[0].session_version) : null;
}

async function updateOwnProfile(internalId, profile) {
  const result = await database.query(
    `update unicornio_users
     set name = $2, updated_at = now()
     where id = $1 and status = 'ACTIVE'
     returning id as internal_id, public_id, email, name, role, status, password_hash,
               session_version, birth_date, age_range, unicorn_gender`,
    [internalId, profile.name],
  );
  return mapUser(result.rows[0]);
}

async function updateOwnCompanion(internalId, unicornGender) {
  const result = await database.query(
    `update unicornio_users
     set unicorn_gender = $2, updated_at = now()
     where id = $1 and status = 'ACTIVE'
     returning id as internal_id, public_id, email, name, role, status, password_hash,
               session_version, birth_date, age_range, unicorn_gender`,
    [internalId, unicornGender],
  );
  return mapUser(result.rows[0]);
}

module.exports = {
  mapUser,
  findLocalUserByEmail,
  findUserByInternalId,
  replacePasswordHash,
  changePasswordAndRevokeSessions,
  updateOwnProfile,
  updateOwnCompanion,
};
