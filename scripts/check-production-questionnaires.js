const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');

async function main() {
  const source = new URL(process.env.QUESTIONNAIRE_TEST_DATABASE_URL || '');
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(source.hostname));
  assert.match(source.pathname, /test/i);
  const suffix = randomUUID().replaceAll('-', '');
  const testName = `unicornio_flow_${suffix}`;
  const roleName = `unicornio_app_${suffix}`;
  const admin = new Pool({ connectionString: source.href, ssl: false });
  let setup;
  let database;
  try {
    await admin.query(`create database ${testName}`);
    await admin.query(`create role ${roleName} login password 'isolated-test-password' nobypassrls`);
    source.pathname = `/${testName}`;
    setup = new Pool({ connectionString: source.href, ssl: false });
    const applicationUrl = new URL(source);
    applicationUrl.username = roleName;
    applicationUrl.password = 'isolated-test-password';

    process.env.APP_PROFILE = 'demo';
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = applicationUrl.href;
    process.env.DATABASE_SSL_MODE = 'disable';
    process.env.QUESTIONNAIRE_PILOT_ENABLED = 'true';
    // Production behavior against a local test connection; no production
    // configuration or credentials are used by this subprocess.
    const config = require('../server/config/env');
    config.env = { ...config.env, appProfile: 'production' };
    ({ database } = require('../server/config/database'));
    const { runMigrations } = require('../server/migrations');
    const { ensureSchema, seedDemoCollections, seedDemoRelational, createDemoState } = require('../server/config/database');
    await runMigrations(setup);
    await ensureSchema(setup);
    await seedDemoCollections(setup);
    await seedDemoRelational(setup);
    await setup.query("update unicornio_users set birth_date = (current_date - interval '13 years')::date where legacy_id = '3'");
    const legal = createDemoState().legalTextVersions.find((version) => version.isActive);
    await setup.query(`insert into unicornio_legal_text_versions
      (id,version,title,content,content_hash,is_active,created_at,updated_at)
      values ($1,$2,$3,$4,encode(digest($4,'sha256'),'hex'),true,now(),now())`,
    [legal.id, legal.version, legal.title, legal.content]);
    await setup.query(`grant usage on schema public to ${roleName}`);
    await setup.query(`grant select,insert,update,delete on all tables in schema public to ${roleName}`);
    await setup.query(`grant usage,select on all sequences in schema public to ${roleName}`);
    await database.initialize();
    const { StaticKeyProvider } = require('../server/services/key-provider.service');
    const { configureQuestionnaireKeyProvider } = require('../server/services/questionnaire-crypto.service');
    configureQuestionnaireKeyProvider(new StaticKeyProvider({ currentVersion: 'test-v1', keys: { 'test-v1': Buffer.alloc(32, 7) } }));
    await require('../server/services/questionnaires.service').initializeQuestionnaireModule();

    const express = require('express');
    const request = require('supertest');
    const app = express();
    app.use(express.json());
    const identities = new Map();
    async function refreshIdentities() {
      const users = (await setup.query('select id, public_id, legacy_id, session_version from unicornio_users')).rows;
      users.forEach((user) => identities.set(user.legacy_id || user.public_id, user));
    }
    await refreshIdentities();
    app.use((req, _res, next) => {
      const actor = identities.get(req.get('X-Test-Actor'));
      req.session = { userId: actor?.id, sessionVersion: actor?.session_version };
      next();
    });
    app.use('/api/users', require('../server/routes/users.routes').usersRouter);
    app.use('/api', require('../server/routes/consents.routes').consentsRouter);
    app.use('/api', require('../server/routes/questionnaires.routes').questionnairesRouter);
    app.use(require('../server/middlewares/error.middleware').errorMiddleware);
    async function call(actor, method, path, body, status = 200) {
      const response = await request(app)[method](`/api${path}`).set('X-Test-Actor', actor).send(body);
      assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(response.body)}`);
      return response.body.data;
    }
    const initialCollections = (await setup.query('select name,data from unicornio_collections order by name')).rows;
    async function exercise({ professional, student, family, group }) {
      const catalog = await call(professional, 'get', '/questionnaire-definitions');
      assert.equal(catalog.definitions.length, 14);
      const selected = catalog.definitions.find((item) => item.familyKey === 'depressive-mood' && item.ageMin <= 13 && item.ageMax >= 13);
      assert.ok(selected);
      const created = await call(professional, 'post', '/questionnaire-campaigns', {
        title: 'Prueba de producción aislada', groupId: group, questionnaireVersionIds: [selected.id],
      }, 201);
      const campaignId = created.campaign.id;
      assert.equal(created.campaign.createdByUserId, identities.get(professional).public_id);
      assert.equal(created.campaign.group.id, group);
      assert.ok((await call(professional, 'get', '/questionnaire-campaigns')).campaigns.some((c) => c.id === campaignId));
      await call('11', 'get', `/questionnaire-campaigns/${campaignId}/monitor`, undefined, 404);
      const monitor = await call(professional, 'get', `/questionnaire-campaigns/${campaignId}/monitor`);
      const participant = monitor.participants.find((p) => p.student.id === identities.get(student).public_id);
      assert.ok(participant);
      await call('13', 'post', `/consents/${participant.consentId}/accept`, {}, 404);
      await call(family, 'post', `/consents/${participant.consentId}/accept`, {});
      await call(family, 'post', `/consents/${participant.consentId}/accept`, {});
      await call(professional, 'post', `/questionnaire-campaigns/${campaignId}/open`, {});
      const assignments = await call(student, 'get', '/me/questionnaire-assignments');
      assert.ok(assignments.assignments.some((a) => a.campaignId === campaignId));
      await call('12', 'post', `/questionnaire-participants/${participant.id}/attempts`, {}, 404);
      const started = await call(student, 'post', `/questionnaire-participants/${participant.id}/attempts`, {}, 201);
      const attemptId = started.attempt.id;
      await call(student, 'put', `/questionnaire-attempts/${attemptId}/answers`, { questionNumber: 1, value: 'NEVER' });
      const resumed = await call(student, 'post', `/questionnaire-participants/${participant.id}/attempts`, {}, 201);
      assert.equal(resumed.answers.length, 1);
      await call(student, 'post', `/questionnaire-attempts/${attemptId}/submit`, {});
      const reviewed = await call(professional, 'get', `/questionnaire-campaigns/${campaignId}/results/${identities.get(student).public_id}`);
      assert.equal(reviewed.result.student.id, identities.get(student).public_id);
      assert.equal(reviewed.result.results[0].answers.length, 1);
      await call('11', 'get', `/questionnaire-campaigns/${campaignId}/results/${identities.get(student).public_id}`, undefined, 404);
    }
    const group = (await setup.query("select public_id from unicornio_groups where legacy_id='group-1'")).rows[0].public_id;
    await exercise({ professional: '6', student: '3', family: '5', group });
    // Accounts provisioned after migration have no legacy ID. Their new
    // campaigns must also populate UUID foreign keys required by RLS.
    const newUsers = {};
    for (const role of ['PROFESSIONAL', 'STUDENT', 'FAMILY']) {
      newUsers[role] = (await setup.query(`insert into unicornio_users
        (email,name,role,birth_date) values ($1,$2,$3,(current_date - interval '13 years')::date)
        returning id,public_id`, [`${role.toLowerCase()}@new-test.local`, `Nuevo ${role}`, role])).rows[0];
    }
    const centerId = (await setup.query("select id from unicornio_centers where legacy_id='center-1'")).rows[0].id;
    const newGroup = (await setup.query(`insert into unicornio_groups (center_id,name)
      values ($1,'Grupo sin identificador antiguo') returning id,public_id`, [centerId])).rows[0];
    for (const role of ['PROFESSIONAL', 'STUDENT']) {
      await setup.query(`insert into unicornio_center_assignments (user_id,center_id,role,is_primary)
        values ($1,$2,$3,true)`, [newUsers[role].id, centerId, role]);
      await setup.query(`insert into unicornio_group_assignments (user_id,group_id,role,is_primary)
        values ($1,$2,$3,true)`, [newUsers[role].id, newGroup.id, role]);
    }
    await setup.query('insert into unicornio_family_links (family_user_id,student_user_id) values ($1,$2)',
      [newUsers.FAMILY.id, newUsers.STUDENT.id]);
    await refreshIdentities();
    await exercise({
      professional: newUsers.PROFESSIONAL.public_id, student: newUsers.STUDENT.public_id,
      family: newUsers.FAMILY.public_id, group: newGroup.public_id,
    });
    assert.deepEqual((await setup.query('select name,data from unicornio_collections order by name')).rows, initialCollections);
    assert.deepEqual(database.state.users, []);
    console.log('Production questionnaire flow passed with public UUIDs, legacy data, encryption and a non-owner RLS role.');
  } finally {
    await database?.getPool()?.end();
    await setup?.end();
    await admin.query(`drop database if exists ${testName} with (force)`);
    await admin.query(`drop role if exists ${roleName}`);
    await admin.end();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
