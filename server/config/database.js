const fs = require('fs/promises');
const path = require('path');
const { createDemoUsers } = require('../data/demoUsers');
const { createDemoAcademicYears } = require('../data/demoAcademicYears');
const { createDemoCenters } = require('../data/demoCenters');
const { createDemoGroups } = require('../data/demoGroups');
const { createDemoLegalTextVersions } = require('../data/demoLegalTextVersions');
const { createDemoConsents, createDemoConsentAuditLogs } = require('../data/demoConsents');
const { env } = require('./env');
const { runMigrations } = require('../migrations');
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

function createInitialState() {
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

function createInitialSequences() {
  return {
    users: 15,
    academicYears: 1,
    centers: 2,
    groups: 4,
    legalTextVersions: 2,
    consents: 5,
    consentAuditLogs: 11,
    userCenterAssignments: 10,
    userGroupAssignments: 6,
  };
}

const state = createInitialState();
const sequences = createInitialSequences();

let pool = null;
let persistenceReady = false;
let writeQueue = Promise.resolve();
let persistenceError = null;
let persistenceMode = 'none';
let localDataFile = null;

async function ensureSchema() {
  await pool.query(`
    create table if not exists unicornio_collections (
      name text primary key,
      data jsonb not null,
      updated_at timestamptz not null default now()
    )
  `);

  await pool.query(`
    create table if not exists unicornio_sequences (
      name text primary key,
      value bigint not null,
      updated_at timestamptz not null default now()
    )
  `);
}

async function seedIfNeeded() {
  for (const name of collectionNames) {
    await pool.query(
      `insert into unicornio_collections (name, data)
       values ($1, $2::jsonb)
       on conflict (name) do nothing`,
      [name, JSON.stringify(state[name] || [])],
    );
  }

  for (const [name, value] of Object.entries(sequences)) {
    await pool.query(
      `insert into unicornio_sequences (name, value)
       values ($1, $2)
       on conflict (name) do nothing`,
      [name, value],
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
          id, version, title, content, is_active, effective_from, effective_to, created_at, updated_at
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        on conflict (id) do update set
          version = excluded.version,
          title = excluded.title,
          content = excluded.content,
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

function hydrateState(snapshot) {
  const collections = snapshot?.collections;
  if (collections && typeof collections === 'object') {
    collectionNames.forEach((name) => {
      if (Array.isArray(collections[name])) {
        state[name] = collections[name];
      }
    });
  }

  const savedSequences = snapshot?.sequences;
  if (savedSequences && typeof savedSequences === 'object') {
    Object.entries(savedSequences).forEach(([name, value]) => {
      if (Number.isFinite(Number(value))) {
        sequences[name] = Number(value);
      }
    });
  }
}

async function loadFromLocalFile() {
  try {
    const contents = await fs.readFile(localDataFile, 'utf8');
    hydrateState(JSON.parse(contents));
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw new Error(`No se pudo cargar el almacenamiento local: ${error.message}`);
    }
  }
}

function buildLocalSnapshot() {
  return {
    version: 1,
    collections: Object.fromEntries(collectionNames.map((name) => [name, state[name] || []])),
    sequences,
  };
}

async function persistLocalSnapshot() {
  const directory = path.dirname(localDataFile);
  const temporaryFile = `${localDataFile}.tmp`;
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(temporaryFile, JSON.stringify(buildLocalSnapshot(), null, 2), 'utf8');
  await fs.rename(temporaryFile, localDataFile);
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
  if (persistenceMode === 'local') {
    return enqueueWrite(persistLocalSnapshot, `el almacenamiento local tras cambiar ${name}`);
  }

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
  if (persistenceMode === 'local') {
    return enqueueWrite(persistLocalSnapshot, `el almacenamiento local tras actualizar la secuencia ${name}`);
  }

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
      localDataFile = path.resolve(process.cwd(), env.dataFile);
      await loadFromLocalFile();
      persistenceMode = 'local';
      persistenceReady = true;
      console.log(`Proyecto Unicornio usando almacenamiento local en ${localDataFile}.`);
      return;
    }

    const { Pool } = require('pg');
    pool = new Pool({
      connectionString: env.databaseUrl,
      ssl: env.databaseSsl ? { rejectUnauthorized: false } : false,
    });

    await ensureSchema();
    await seedIfNeeded();
    await loadFromPostgres();
    await repairLegacyAssignmentCollections();
    await repairLegalTextVersionCollection();
    await runMigrations(pool);
    await syncConsentMirrors();
    persistenceMode = 'postgres';
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
  async query(text, params = []) {
    if (!pool || persistenceMode !== 'postgres') {
      throw new Error('Esta operacion requiere PostgreSQL.');
    }
    return pool.query(text, params);
  },
  async transaction(callback) {
    if (!pool || persistenceMode !== 'postgres') {
      throw new Error('Esta operacion requiere PostgreSQL.');
    }

    const client = await pool.connect();
    try {
      await client.query('begin');
      const result = await callback(client);
      await client.query('commit');
      return result;
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
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

module.exports = { database };
