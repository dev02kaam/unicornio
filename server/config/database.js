const fs = require('fs/promises');
const path = require('path');
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

  return enqueueWrite(() => pool.query(
    `insert into unicornio_collections (name, data, updated_at)
     values ($1, $2::jsonb, now())
     on conflict (name)
     do update set data = excluded.data, updated_at = now()`,
    [name, JSON.stringify(state[name] || [])],
  ), `la coleccion ${name}`);
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
