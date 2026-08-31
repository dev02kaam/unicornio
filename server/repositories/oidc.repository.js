const { database } = require('../config/database');

function mapIdentityRow(row) {
  if (!row || row.status !== 'ACTIVE') return null;
  return {
    internalId: row.internal_id,
    id: row.public_id,
    email: row.email,
    name: row.name,
    role: row.role,
    isActive: true,
    sessionVersion: Number(row.session_version),
  };
}

async function findByOidcIdentity({
  issuer,
  subject,
  email,
  emailVerified = false,
  allowAutoLink = false,
}) {
  return database.transaction(async (client) => {
    const identityResult = await client.query(
      `select u.id as internal_id, u.public_id, u.email, u.name, u.role, u.status, u.session_version
       from unicornio_oidc_identities oi
       join unicornio_users u on u.id = oi.user_id
       where oi.issuer = $1 and oi.subject = $2
       for update of oi`,
      [issuer, subject],
    );
    let row = identityResult.rows[0];

    if (!row && allowAutoLink && emailVerified && email) {
      const candidateResult = await client.query(
        `select u.id as internal_id, u.public_id, u.email, u.name, u.role, u.status, u.session_version
         from unicornio_users u
         where lower(u.email) = lower($1)
           and u.status = 'ACTIVE'
           and u.role in ('SCHOOL', 'TEACHER', 'PROFESSIONAL')
           and not exists (
             select 1 from unicornio_oidc_identities oi where oi.user_id = u.id
           )
         for update of u`,
        [String(email).trim()],
      );
      if (candidateResult.rows.length !== 1) return null;

      const candidate = candidateResult.rows[0];
      const linked = await client.query(
        `insert into unicornio_oidc_identities (
           user_id, issuer, subject, email_at_link, created_at, last_login_at
         ) values ($1, $2, $3, $4, now(), now())
         on conflict do nothing
         returning user_id`,
        [candidate.internal_id, issuer, subject, String(email).trim().toLowerCase()],
      );
      if (linked.rows.length !== 1) return null;
      row = candidate;
    }

    const user = mapIdentityRow(row);
    if (!user) return null;

    await client.query(
      `update unicornio_oidc_identities
       set last_login_at = now()
       where issuer = $1 and subject = $2`,
      [issuer, subject],
    );
    return user;
  });
}

module.exports = { findByOidcIdentity, mapIdentityRow };
