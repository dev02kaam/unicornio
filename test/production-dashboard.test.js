const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const { database } = require('../server/config/database');
const { createAuthMiddleware } = require('../server/middlewares/auth.middleware');
const { meController } = require('../server/controllers/auth.controller');
const { getUserAssignmentsController, listCentersController } = require('../server/controllers/organization.controller');
const { listUsersController, getUserByIdController } = require('../server/controllers/users.controller');
const { listConsentsController, getConsentByIdController } = require('../server/controllers/consents.controller');
const { requireRole } = require('../server/middlewares/role.middleware');
const { errorMiddleware } = require('../server/middlewares/error.middleware');
const { loadDashboardReadCollections } = require('../server/repositories/dashboard-read.repository');

const adminId = '00000000-0000-4000-8000-000000000001';
const studentId = '00000000-0000-4000-8000-000000000002';
const familyId = '00000000-0000-4000-8000-000000000003';

function fixtures() {
  return {
    unicornio_users: [
      { id: adminId, name: 'Admin', role: 'ADMIN', isActive: true },
      { id: studentId, name: 'Alumno', role: 'STUDENT', isActive: true },
      { id: familyId, name: 'Familia', role: 'FAMILY', isActive: true },
    ],
    unicornio_centers: [{ id: 'public-center', name: 'Centro', isActive: true }],
    unicornio_groups: [{ id: 'public-group', centerId: 'public-center', name: 'Clase', isActive: true }],
    unicornio_center_assignments: [{ userId: studentId, centerId: 'public-center', isActive: true, isPrimary: true }],
    unicornio_group_assignments: [{ userId: studentId, groupId: 'public-group', isActive: true, isPrimary: true }],
    unicornio_family_links: [{ familyUserId: familyId, studentId }],
    unicornio_consent_records: [
      { id: 'consent-1', studentId, familyUserId: familyId, centerId: 'public-center', status: 'PENDING' },
      { id: 'foreign-consent', studentId: 'other-student', familyUserId: 'other-family', centerId: 'other-center' },
    ],
  };
}

function createExecutor(data = fixtures()) {
  return {
    async query(sql) {
      assert.doesNotMatch(sql, /password_hash|unicornio_collections|\b(update|insert|delete)\b/i);
      const table = sql.match(/\bfrom (unicornio_\w+)/i)?.[1];
      assert.ok(table, 'Every read must query a relational table');
      return { rows: structuredClone(data[table] || []) };
    },
  };
}

function createProductionApp(t, role = 'ADMIN') {
  const user = fixtures().unicornio_users.find((candidate) => candidate.role === role);
  t.mock.method(database, 'transaction', async (callback) => callback(createExecutor()));
  const authenticate = createAuthMiddleware({
    config: { appProfile: 'production' },
    repository: { async findUserByInternalId() {
      return { ...user, internalId: '10000000-0000-4000-8000-000000000001', sessionVersion: 1 };
    } },
  });
  const app = express();
  app.use((req, _res, next) => {
    req.session = { userId: '10000000-0000-4000-8000-000000000001', sessionVersion: 1 };
    next();
  });
  app.use(authenticate);
  app.get('/api/auth/me', meController);
  app.get('/api/users', requireRole(['ADMIN']), listUsersController);
  app.get('/api/users/:userId/assignments', getUserAssignmentsController);
  app.get('/api/users/:id', getUserByIdController);
  app.get('/api/centers', listCentersController);
  app.get('/api/consents', listConsentsController);
  app.get('/api/consents/:id', getConsentByIdController);
  app.use(errorMiddleware);
  return app;
}

test('production carga el panel con UUID publicos aunque las colecciones demo esten vacias', async (t) => {
  const original = database.state.users;
  database.state.users = [];
  t.after(() => { database.state.users = original; });
  const app = createProductionApp(t);
  const assignments = await request(app).get(`/api/users/${adminId}/assignments`).expect(200);
  assert.equal(assignments.body.data.user.id, adminId);
  assert.deepEqual(assignments.body.data.centers, []);
  const users = await request(app).get('/api/users').expect(200);
  assert.equal(users.body.data.users.length, 3);
  assert.equal(users.body.data.users[1].schoolId, 'public-center');
  const centers = await request(app).get('/api/centers').expect(200);
  assert.equal(centers.body.data.centers[0].groupsCount, 1);
  assert.deepEqual(database.state.users, []);
});

test('production conserva el contexto familiar y sus asignaciones con ids publicos', async (t) => {
  const app = createProductionApp(t, 'FAMILY');
  const profile = await request(app).get('/api/auth/me').expect(200);
  assert.equal(profile.body.data.user.context.linkedStudent.id, studentId);
  assert.equal(profile.body.data.user.context.center.id, 'public-center');
  const assignments = await request(app).get(`/api/users/${studentId}/assignments`).expect(200);
  assert.equal(assignments.body.data.groups[0].group.name, 'Clase');
  await request(app).get('/api/users').expect(403);
  await request(app).get(`/api/users/${adminId}`).expect(404);
  await request(app).get(`/api/users/${adminId}/assignments`).expect(403);
});

test('production no expone consentimientos legacy de otra familia', async (t) => {
  const response = await request(createProductionApp(t, 'FAMILY')).get('/api/consents').expect(200);
  assert.deepEqual(response.body.data.consents.map((consent) => consent.id), ['consent-1']);
});

test('consultar un consentimiento audita con INSERT sin reescribir las colecciones', async (t) => {
  const app = createProductionApp(t, 'FAMILY');
  const audit = t.mock.method(database, 'query', async (sql, params) => {
    assert.match(sql, /insert into unicornio_consent_audit_logs/i);
    assert.equal(params[1], 'consent-1');
    assert.equal(params[2], familyId);
    return { rowCount: 1 };
  });
  await request(app).get('/api/consents/consent-1').expect(200);
  assert.equal(audit.mock.callCount(), 1);
  await request(app).get('/api/consents/foreign-consent').expect(404);
  assert.equal(audit.mock.callCount(), 1);
});

test('un fallo de lectura devuelve 500 sin convertir una sesion valida en 401', async (t) => {
  const app = createProductionApp(t);
  t.mock.method(database, 'transaction', async () => { throw new Error('read failed'); });
  await request(app).get(`/api/users/${adminId}/assignments`).expect(500);
});

test('las lecturas simultaneas mantienen su propio contexto y bloquean escrituras legacy', async () => {
  const student = { id: studentId, role: 'STUDENT' };
  const collections = await loadDashboardReadCollections(student, createExecutor());
  const otherCollections = { users: [{ id: 'another-user' }] };
  const original = database.getUsers();
  await Promise.all([
    database.runWithReadCollections(collections, async () => {
      await new Promise((resolve) => setImmediate(resolve));
      assert.equal(database.getUsers()[0].id, adminId);
      assert.deepEqual(database.getCollection('consents').map((consent) => consent.id), ['consent-1']);
      assert.throws(() => database.setUsers([]), /vista de lectura/);
      assert.throws(() => database.persistUsers(), /colecciones legacy/);
    }),
    database.runWithReadCollections(otherCollections, async () => {
      await new Promise((resolve) => setImmediate(resolve));
      assert.equal(database.getUsers()[0].id, 'another-user');
    }),
  ]);
  assert.equal(database.getUsers(), original);
});
