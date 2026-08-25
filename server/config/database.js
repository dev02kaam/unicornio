const { AsyncLocalStorage } = require('node:async_hooks');
const { createDemoUsers } = require('../data/demoUsers');
const { createDemoAcademicYears } = require('../data/demoAcademicYears');
const { createDemoCenters } = require('../data/demoCenters');
const { createDemoGroups } = require('../data/demoGroups');
const { createDemoLegalTextVersions } = require('../data/demoLegalTextVersions');
const { createDemoConsents, createDemoConsentAuditLogs } = require('../data/demoConsents');
const { env } = require('./env');
const {
  createDemoUserCenterAssignments,
  createDemoUserGroupAssignments,
} = require('../data/demoAssignments');
const {
  getMaximumPrefixedSequence,
  repairLegalTextVersions,
} = require('../utils/collection-integrity');

const collectionNames = [
  'users',
  'academicYears',
  'centers',
  'groups',
  'legalTextVersions',
  'consents',
  'consentAuditLogs',
  'userCenterAssignments',
  'userGroupAssignments',
];

function createDemoState() {
  return {
    users: createDemoUsers(),
    academicYears: createDemoAcademicYears(),
    centers: createDemoCenters(),
    groups: createDemoGroups(),
    legalTextVersions: createDemoLegalTextVersions(),
    consents: createDemoConsents(),
    consentAuditLogs: createDemoConsentAuditLogs(),
    userCenterAssignments: createDemoUserCenterAssignments(),
    userGroupAssignments: createDemoUserGroupAssignments(),
  };
}

function createDemoSequences() {
  return {
    users: 15,
    academicYears: 1,
    centers: 2,
    groups: 4,
    legalTextVersions: 2,
    consents: 5,
    consentAuditLogs: 11,
    userCenterAssignments: 10,
    userGroupAssignments: 8,
  };
}

function createRuntimeState() {
  return Object.fromEntries(collectionNames.map((name) => [name, []]));
}

function createRuntimeSequences() {
  return Object.fromEntries(collectionNames.map((name) => [name, 0]));
}

const state = createRuntimeState();
const sequences = createRuntimeSequences();

let pool = null;
let persistenceReady = false;
let writeQueue = Promise.resolve();
let persistenceError = null;
let persistenceMode = 'none';
const rlsContext = new AsyncLocalStorage();
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getMissingMigrationIds(expectedMigrationIds, appliedRows) {
  const appliedIds = new Set((appliedRows || []).map((row) => String(row.id)));
  return (expectedMigrationIds || []).filter((id) => !appliedIds.has(String(id)));
}

async function setLocalRequestIdentity(client, userId) {
  const identity = String(userId || '');
  const isUuid = UUID_PATTERN.test(identity);
  await client.query("select set_config('app.user_id', $1, true)", [isUuid ? identity : '']);
  await client.query("select set_config('app.legacy_user_id', $1, true)", [isUuid ? '' : identity]);
}

async function runTransaction(callback, { questionnaireServiceWrite = false } = {}) {
  if (!pool || persistenceMode !== 'postgres') {
    throw new Error('Esta operacion requiere PostgreSQL.');
  }

  const client = await pool.connect();
  try {
    await client.query('begin');
    const userId = rlsContext.getStore()?.userId;
    if (userId) await setLocalRequestIdentity(client, userId);
    if (questionnaireServiceWrite) {
      await client.query("select set_config('app.questionnaire_service_write', 'on', true)");
    }
    const result = await callback(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

async function ensureSchema(executor = pool) {
  await executor.query(`
    create table if not exists unicornio_collections (
      name text primary key,
      data jsonb not null,
      updated_at timestamptz not null default now()
    )
  `);

  await executor.query(`
    create table if not exists unicornio_sequences (
      name text primary key,
      value bigint not null,
      updated_at timestamptz not null default now()
    )
  `);
}

async function seedDemoCollections(executor) {
  const demoState = createDemoState();
  const demoSequences = createDemoSequences();

  for (const name of collectionNames) {
    await executor.query(
      `insert into unicornio_collections (name, data)
       values ($1, $2::jsonb)
       on conflict (name)
       do update set data = excluded.data, updated_at = now()`,
      [name, JSON.stringify(demoState[name] || [])],
    );
  }

  for (const [name, value] of Object.entries(demoSequences)) {
    await executor.query(
      `insert into unicornio_sequences (name, value)
       values ($1, $2)
       on conflict (name)
       do update set value = excluded.value, updated_at = now()`,
      [name, value],
    );
  }
}

function mapDemoAssignmentRole(role) {
  const roles = {
    RESPONSABLE_CENTRO: 'CENTER_MANAGER',
    PROFESOR: 'TEACHER',
    PROFESSIONAL: 'PROFESSIONAL',
    ALUMNO: 'STUDENT',
  };
  return roles[role] || null;
}

async function seedDemoRelational(executor) {
  const demoState = createDemoState();

  for (const item of demoState.academicYears) {
    await executor.query(
      `insert into unicornio_academic_years (legacy_id, name, starts_on, ends_on, status)
       values ($1, $2, $3, $4, $5)
       on conflict (legacy_id) where legacy_id is not null do update set
         name = excluded.name, starts_on = excluded.starts_on,
         ends_on = excluded.ends_on, status = excluded.status`,
      [item.id, item.label, item.startDate, item.endDate, item.isActive ? 'ACTIVE' : 'CLOSED'],
    );
  }

  for (const item of demoState.users) {
    await executor.query(
      `insert into unicornio_users (
         legacy_id, email, name, password_hash, role, status, birth_date, age_range,
         unicorn_gender, created_at, updated_at
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       on conflict (legacy_id) do update set
         email = excluded.email, name = excluded.name, password_hash = excluded.password_hash,
         role = excluded.role, status = excluded.status, birth_date = excluded.birth_date,
         age_range = excluded.age_range, updated_at = excluded.updated_at`,
      [
        item.id, item.email, item.name, item.passwordHash, item.role,
        item.isActive ? 'ACTIVE' : 'DISABLED', item.birthDate || null, item.ageRange || null,
        item.unicornGender || null, item.createdAt, item.updatedAt,
      ],
    );
  }

  for (const item of demoState.centers) {
    await executor.query(
      `insert into unicornio_centers (
         legacy_id, academic_year_id, name, code, type, city, support_contact,
         status, created_at, updated_at
       ) values (
         $1, (select id from unicornio_academic_years where legacy_id = $2),
         $3, $4, 'OTHER', $5, $6, $7, $8, $9
       ) on conflict (legacy_id) do update set
         academic_year_id = excluded.academic_year_id, name = excluded.name,
         code = excluded.code, city = excluded.city, support_contact = excluded.support_contact,
         status = excluded.status, updated_at = excluded.updated_at`,
      [
        item.id, item.academicYearId, item.name, item.code, item.city,
        item.questionnaireSupportContact || null, item.isActive ? 'ACTIVE' : 'INACTIVE',
        item.createdAt, item.updatedAt,
      ],
    );
  }

  for (const item of demoState.groups) {
    await executor.query(
      `insert into unicornio_groups (
         legacy_id, center_id, academic_year_id, name, code, stage, course, shift,
         status, created_at, updated_at
       ) values (
         $1, (select id from unicornio_centers where legacy_id = $2),
         (select id from unicornio_academic_years where legacy_id = $3),
         $4, $5, $6, $7, $8, $9, $10, $11
       ) on conflict (legacy_id) do update set
         center_id = excluded.center_id, academic_year_id = excluded.academic_year_id,
         name = excluded.name, code = excluded.code, stage = excluded.stage,
         course = excluded.course, shift = excluded.shift, status = excluded.status,
         updated_at = excluded.updated_at`,
      [
        item.id, item.centerId, item.academicYearId, item.name, item.code,
        item.stage, item.course, item.shift, item.isActive ? 'ACTIVE' : 'INACTIVE',
        item.createdAt, item.updatedAt,
      ],
    );
  }

  for (const item of demoState.userCenterAssignments) {
    const role = mapDemoAssignmentRole(item.role);
    if (!role) continue;
    await executor.query(
      `insert into unicornio_center_assignments (user_id, center_id, role, is_primary)
       select u.id, c.id, $3, $4
       from unicornio_users u cross join unicornio_centers c
       where u.legacy_id = $1 and c.legacy_id = $2
         and not exists (
           select 1 from unicornio_center_assignments a
           where a.user_id = u.id and a.center_id = c.id and a.role = $3 and a.active_until is null
         )`,
      [item.userId, item.centerId, role, Boolean(item.isPrimary)],
    );
  }

  for (const item of demoState.userGroupAssignments) {
    const role = mapDemoAssignmentRole(item.role);
    if (!role) continue;
    await executor.query(
      `insert into unicornio_group_assignments (user_id, group_id, role, is_primary)
       select u.id, g.id, $3, $4
       from unicornio_users u cross join unicornio_groups g
       where u.legacy_id = $1 and g.legacy_id = $2
         and not exists (
           select 1 from unicornio_group_assignments a
           where a.user_id = u.id and a.group_id = g.id and a.role = $3 and a.active_until is null
         )`,
      [item.userId, item.groupId, role, Boolean(item.isPrimary)],
    );
  }

  for (const item of demoState.users.filter((user) => user.role === 'FAMILY' && user.linkedStudentId)) {
    await executor.query(
      `insert into unicornio_family_links (family_user_id, student_user_id, relationship)
       select family.id, student.id, 'DEMO'
       from unicornio_users family cross join unicornio_users student
       where family.legacy_id = $1 and student.legacy_id = $2
         and not exists (
           select 1 from unicornio_family_links link
           where link.family_user_id = family.id and link.student_user_id = student.id
             and link.active_until is null
         )`,
      [item.id, item.linkedStudentId],
    );
  }
}

async function loadFromPostgres() {
  const collectionsResult = await pool.query('select name, data from unicornio_collections');
  collectionsResult.rows.forEach((row) => {
    if (collectionNames.includes(row.name)) {
      state[row.name] = Array.isArray(row.data) ? row.data : [];
    }
  });

  const sequencesResult = await pool.query('select name, value from unicornio_sequences');
  sequencesResult.rows.forEach((row) => {
    sequences[row.name] = Number(row.value);
  });
}

async function repairLegacyAssignmentCollections() {
  const groupAssignments = state.userGroupAssignments || [];
  const invalidGroupAssignments = groupAssignments.filter(
    (assignment) => assignment.centerId && !assignment.groupId,
  );
  if (invalidGroupAssignments.length === 0) {
    return;
  }

  const centerAssignments = state.userCenterAssignments || [];
  invalidGroupAssignments.forEach((legacy) => {
    const existing = centerAssignments.find(
      (assignment) => assignment.userId === legacy.userId
        && assignment.centerId === legacy.centerId,
    );
    if (!existing) {
      centerAssignments.push({
        ...legacy,
        id: legacy.id,
        updatedAt: new Date().toISOString(),
      });
    }
  });
  state.userCenterAssignments = centerAssignments;
  state.userGroupAssignments = groupAssignments.filter(
    (assignment) => !(assignment.centerId && !assignment.groupId),
  );

  const client = await pool.connect();
  try {
    await client.query('begin');
    for (const name of ['userCenterAssignments', 'userGroupAssignments']) {
      await client.query(
        `update unicornio_collections
         set data = $2::jsonb, updated_at = now()
         where name = $1`,
        [name, JSON.stringify(state[name])],
      );
    }
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

async function repairLegalTextVersionCollection() {
  const repair = repairLegalTextVersions(state.legalTextVersions || []);
  const collectionChanged = repair.removed.length > 0;
  const maximumSequence = getMaximumPrefixedSequence(repair.items, 'legal-text');
  const sequenceChanged = maximumSequence > Number(sequences.legalTextVersions || 0);
  let consentsChanged = false;

  if (collectionChanged) {
    state.legalTextVersions = repair.items;
  }

  if (repair.idReplacements.size > 0) {
    state.consents = (state.consents || []).map((consent) => {
      const replacementId = repair.idReplacements.get(consent.legalTextVersionId);
      if (!replacementId) return consent;

      consentsChanged = true;
      return {
        ...consent,
        legalTextVersionId: replacementId,
        updatedAt: new Date().toISOString(),
      };
    });
  }

  if (sequenceChanged) {
    sequences.legalTextVersions = maximumSequence;
  }

  if (!collectionChanged && !consentsChanged && !sequenceChanged) {
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('begin');

    if (collectionChanged) {
      await client.query(
        `update unicornio_collections
         set data = $2::jsonb, updated_at = now()
         where name = $1`,
        ['legalTextVersions', JSON.stringify(state.legalTextVersions)],
      );
    }

    if (consentsChanged) {
      await client.query(
        `update unicornio_collections
         set data = $2::jsonb, updated_at = now()
         where name = $1`,
        ['consents', JSON.stringify(state.consents)],
      );
    }

    if (sequenceChanged) {
      await client.query(
        `insert into unicornio_sequences (name, value, updated_at)
         values ('legalTextVersions', $1, now())
         on conflict (name)
         do update set value = excluded.value, updated_at = now()`,
        [sequences.legalTextVersions],
      );
    }

    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }

  if (repair.removed.length > 0) {
    console.warn(`Se repararon ${repair.removed.length} versiones legales duplicadas antes de sincronizar PostgreSQL.`);
  }
}

async function replaceConsentMirrorCollection(name, executor = pool) {
  if (name === 'legalTextVersions') {
    await executor.query('delete from unicornio_legal_text_versions');
    for (const item of state.legalTextVersions || []) {
      await executor.query(
        `insert into unicornio_legal_text_versions (
          id, version, title, content, content_hash, is_active,
          effective_from, effective_to, created_at, updated_at
        ) values ($1, $2, $3, $4, encode(digest($4, 'sha256'), 'hex'), $5, $6, $7, $8, $9)
        on conflict (id) do update set
          version = excluded.version,
          title = excluded.title,
          content = excluded.content,
          content_hash = excluded.content_hash,
          is_active = excluded.is_active,
          effective_from = excluded.effective_from,
          effective_to = excluded.effective_to,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at`,
        [
          item.id,
          item.version,
          item.title,
          item.content,
          Boolean(item.isActive),
          item.effectiveFrom || null,
          item.effectiveTo || null,
          item.createdAt,
          item.updatedAt,
        ],
      );
    }
  }

  if (name === 'consents') {
    await executor.query('delete from unicornio_consent_records');
    for (const item of state.consents || []) {
      await executor.query(
        `insert into unicornio_consent_records (
          id, student_id, family_user_id, center_id, legal_text_version_id, campaign_id,
          status, requested_by_user_id, accepted_at, rejected_at, revoked_at, expires_at,
          revocation_reason, created_at, updated_at
        ) values (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
        )`,
        [
          item.id,
          item.studentId,
          item.familyUserId,
          item.centerId,
          item.legalTextVersionId,
          item.campaignId || null,
          item.status,
          item.requestedByUserId,
          item.acceptedAt || null,
          item.rejectedAt || null,
          item.revokedAt || null,
          item.expiresAt || null,
          item.revocationReason || null,
          item.createdAt,
          item.updatedAt,
        ],
      );
    }
  }

  if (name === 'consentAuditLogs') {
    await executor.query('delete from unicornio_consent_audit_logs');
    for (const item of state.consentAuditLogs || []) {
      await executor.query(
        `insert into unicornio_consent_audit_logs (
          id, consent_id, action, performed_by_user_id, previous_status, new_status, metadata, created_at
        ) values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)`,
        [
          item.id,
          item.consentId || null,
          item.action,
          item.performedByUserId || null,
          item.previousStatus || null,
          item.newStatus || null,
          JSON.stringify(item.metadata || null),
          item.createdAt,
        ],
      );
    }
  }
}

async function syncConsentMirrors() {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await replaceConsentMirrorCollection('legalTextVersions', client);
    await replaceConsentMirrorCollection('consents', client);
    await replaceConsentMirrorCollection('consentAuditLogs', client);
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

function enqueueWrite(task, label) {
  if (!persistenceReady) {
    return Promise.resolve();
  }

  writeQueue = writeQueue
    .catch(() => {})
    .then(task)
    .catch((error) => {
      persistenceError = error;
      console.error(`No se pudo persistir ${label}:`, error.message);
    });

  return writeQueue;
}

function persistCollection(name) {
  return enqueueWrite(async () => {
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(
        `insert into unicornio_collections (name, data, updated_at)
         values ($1, $2::jsonb, now())
         on conflict (name)
         do update set data = excluded.data, updated_at = now()`,
        [name, JSON.stringify(state[name] || [])],
      );
      await replaceConsentMirrorCollection(name, client);
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }, `la coleccion ${name}`);
}

function persistSequence(name) {
  return enqueueWrite(() => pool.query(
    `insert into unicornio_sequences (name, value, updated_at)
     values ($1, $2, now())
     on conflict (name)
     do update set value = excluded.value, updated_at = now()`,
    [name, sequences[name]],
  ), `la secuencia ${name}`);
}

const database = {
  state,
  async initialize() {
    if (!env.databaseUrl) {
      throw new Error('DATABASE_URL es obligatorio. La demo tambien requiere PostgreSQL dedicado.');
    }

    const { Pool } = require('pg');
    const ssl = env.databaseSslMode === 'disable'
      ? false
      : {
        rejectUnauthorized: env.databaseSslMode === 'verify-full',
        ...(env.databaseCa ? { ca: env.databaseCa.replace(/\\n/g, '\n') } : {}),
      };

    pool = new Pool({
      connectionString: env.databaseUrl,
      ssl,
      max: env.databasePoolMax,
      connectionTimeoutMillis: env.databaseConnectionTimeoutMs,
      idleTimeoutMillis: env.databaseIdleTimeoutMs,
      statement_timeout: env.databaseStatementTimeoutMs,
      idle_in_transaction_session_timeout: env.databaseIdleTransactionTimeoutMs,
    });

    persistenceMode = 'postgres';
    const { expectedMigrationIds } = require('../migrations');
    await this.checkReadiness(expectedMigrationIds);
    if (env.appProfile === 'demo') {
      await loadFromPostgres();
      await repairLegacyAssignmentCollections();
      await repairLegalTextVersionCollection();
      await syncConsentMirrors();
    }
    persistenceReady = true;
    console.log('Proyecto Unicornio conectado a PostgreSQL.');
  },
  getUsers() {
    return state.users;
  },
  setUsers(users) {
    state.users = users;
    persistCollection('users');
    return state.users;
  },
  getCollection(name) {
    return state[name];
  },
  setCollection(name, items) {
    state[name] = items;
    persistCollection(name);
    return state[name];
  },
  persistCollection,
  persistUsers() {
    return persistCollection('users');
  },
  async flush() {
    await writeQueue;
    if (persistenceError) {
      const error = persistenceError;
      persistenceError = null;
      throw error;
    }
  },
  isPostgres() {
    return persistenceMode === 'postgres';
  },
  getPersistenceMode() {
    return persistenceMode;
  },
  getPool() {
    return pool;
  },
  async checkReadiness(expectedMigrationIds = []) {
    if (!pool || persistenceMode !== 'postgres') {
      throw new Error('PostgreSQL no inicializado.');
    }
    await pool.query('select 1');
    let applied;
    try {
      applied = await pool.query(
        'select id from unicornio_migrations where id = any($1::text[])',
        [expectedMigrationIds],
      );
    } catch (error) {
      if (error?.code === '42P01') {
        throw new Error('El esquema PostgreSQL no esta inicializado. Ejecuta npm run migrate con MIGRATION_DATABASE_URL.');
      }
      throw error;
    }
    const missingMigrationIds = getMissingMigrationIds(expectedMigrationIds, applied.rows);
    if (missingMigrationIds.length > 0) {
      throw new Error(
        `El esquema PostgreSQL no tiene la version esperada. Faltan: ${missingMigrationIds.join(', ')}. `
        + 'Ejecuta npm run migrate con MIGRATION_DATABASE_URL.',
      );
    }
    return true;
  },
  loadTestFixtures(snapshot, sequenceSnapshot) {
    if (env.nodeEnv !== 'test') {
      throw new Error('Las fixtures solo se pueden cargar con NODE_ENV=test.');
    }

    collectionNames.forEach((name) => {
      state[name] = structuredClone(snapshot[name] || []);
      sequences[name] = Number(sequenceSnapshot[name] || 0);
    });
  },
  async query(text, params = []) {
    if (!pool || persistenceMode !== 'postgres') {
      throw new Error('Esta operacion requiere PostgreSQL.');
    }
    const userId = rlsContext.getStore()?.userId;
    if (!userId) return pool.query(text, params);

    const client = await pool.connect();
    try {
      await client.query('begin');
      await setLocalRequestIdentity(client, userId);
      const result = await client.query(text, params);
      await client.query('commit');
      return result;
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  },
  transaction(callback) {
    return runTransaction(callback);
  },
  questionnaireTransaction(callback) {
    return runTransaction(callback, { questionnaireServiceWrite: true });
  },
  runAsUser(userId, callback) {
    if (!userId) throw new Error('El contexto RLS requiere una identidad.');
    return rlsContext.run({ userId: String(userId) }, callback);
  },
  nextUserId() {
    sequences.users += 1;
    persistSequence('users');
    return String(sequences.users);
  },
  nextId(name, prefix) {
    if (!Object.prototype.hasOwnProperty.call(sequences, name)) {
      sequences[name] = 0;
    }

    sequences[name] += 1;
    persistSequence(name);
    return `${prefix}-${sequences[name]}`;
  },
};

module.exports = {
  database,
  createRuntimeState,
  createRuntimeSequences,
  createDemoState,
  createDemoSequences,
  ensureSchema,
  seedDemoCollections,
  seedDemoRelational,
  getMissingMigrationIds,
};
