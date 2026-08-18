const id = '009-emergency-admin';

const sql = `
  create unique index if not exists unicornio_one_active_emergency_admin
    on unicornio_users ((role))
    where role = 'ADMIN' and status = 'ACTIVE';
`;

module.exports = { id, sql };
