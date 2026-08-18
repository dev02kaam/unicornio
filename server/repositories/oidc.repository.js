const { database } = require('../config/database');

async function findByOidcIdentity({ issuer, subject }) {
  return database.transaction(async (client) => {
    const result = await client.query(
      `select u.id as internal_id, u.public_id, u.email, u.name, u.role, u.status, u.session_version
       from unicornio_oidc_identities oi
       join unicornio_users u on u.id = oi.user_id
       where oi.issuer = $1 and oi.subject = $2
       for update of oi`,
      [issuer, subject],
    );
    const row = result.rows[0];
    if (!row || row.status !== 'ACTIVE') return null;

    await client.query(
      `update unicornio_oidc_identities
       set last_login_at = now()
       where issuer = $1 and subject = $2`,
      [issuer, subject],
    );
    return {
      internalId: row.internal_id,
      id: row.public_id,
      email: row.email,
      name: row.name,
      role: row.role,
      isActive: true,
      sessionVersion: Number(row.session_version),
    };
  });
}

module.exports = { findByOidcIdentity };
