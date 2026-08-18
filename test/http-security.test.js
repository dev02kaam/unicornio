const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { createApp } = require('../server/create-app');

test('createApp permite probar la API sin abrir un puerto', async () => {
  assert.equal(typeof createApp, 'function');
  const response = await request(createApp()).get('/livez').expect(200);
  assert.equal(response.body.success, true);
});

test('readiness comprueba dependencias sin exponer el fallo interno', async () => {
  const unavailable = createApp({
    readinessCheck: async () => {
      throw new Error('postgresql://usuario:secreto@db-interna/unicornio');
    },
  });
  const response = await request(unavailable).get('/readyz').expect(503);

  assert.equal(response.body.success, false);
  assert.equal(response.body.error.code, 'NOT_READY');
  assert.doesNotMatch(JSON.stringify(response.body), /usuario|secreto|db-interna/);
});

test('OpenAPI se deriva de los contratos estrictos de entrada', async () => {
  const response = await request(createApp()).get('/api/openapi.json').expect(200);
  assert.equal(response.body.openapi, '3.1.0');
  assert.equal(response.body.components.schemas.Login.additionalProperties, false);
  assert.ok(response.body.paths['/questionnaire-alerts/{alertId}/transfer']);
});

test('cada respuesta expone un request id UUID y no acepta identificadores arbitrarios', async () => {
  const response = await request(createApp())
    .get('/livez')
    .set('X-Request-ID', 'attacker-chosen-id')
    .expect(200);

  assert.match(
    response.headers['x-request-id'],
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
});

test('login rechaza propiedades desconocidas', async () => {
  const agent = request.agent(createApp());
  const csrfResponse = await agent.get('/api/auth/csrf').expect(200);
  const response = await agent
    .post('/api/auth/login')
    .set('Origin', 'http://localhost:3001')
    .set('Sec-Fetch-Site', 'same-origin')
    .set('X-CSRF-Token', csrfResponse.body.data.csrfToken)
    .send({
      email: 'admin@unicornio.local',
      password: 'Demo1234!',
      role: 'ADMIN',
    })
    .expect(400);

  assert.equal(response.body.error.code, 'BAD_REQUEST');
});

test('la API rechaza JSON mayor de 64 KiB', async () => {
  const response = await request(createApp())
    .post('/api/auth/login')
    .set('Content-Type', 'application/json')
    .send(JSON.stringify({
      email: 'admin@unicornio.local',
      password: `Demo1234!${'x'.repeat(70 * 1024)}`,
    }))
    .expect(413);

  assert.equal(response.body.error.code, 'PAYLOAD_TOO_LARGE');
});

test('login crea una sesion opaca y no devuelve JWT', async () => {
  const agent = request.agent(createApp());
  const csrfResponse = await agent.get('/api/auth/csrf').expect(200);
  const csrfToken = csrfResponse.body.data.csrfToken;

  const loginResponse = await agent
    .post('/api/auth/login')
    .set('Origin', 'http://localhost:3001')
    .set('Sec-Fetch-Site', 'same-origin')
    .set('X-CSRF-Token', csrfToken)
    .send({ email: 'admin@unicornio.local', password: 'Demo1234!' })
    .expect(200);

  assert.equal(loginResponse.body.data.token, undefined);
  assert.match(loginResponse.headers['set-cookie'].join(';'), /unicornio_session=.*HttpOnly/i);

  const sessionResponse = await agent.get('/api/auth/session').expect(200);
  assert.equal(sessionResponse.body.data.user.email, 'admin@unicornio.local');
});

test('CSRF y Origin bloquean mutaciones y logout destruye la sesion', async () => {
  const agent = request.agent(createApp());
  const firstCsrf = await agent.get('/api/auth/csrf').expect(200);

  await agent
    .post('/api/auth/login')
    .set('Origin', 'http://localhost:3001')
    .set('Sec-Fetch-Site', 'same-origin')
    .set('X-CSRF-Token', firstCsrf.body.data.csrfToken)
    .send({ email: 'admin@unicornio.local', password: 'Demo1234!' })
    .expect(200);

  await agent
    .post('/api/auth/logout')
    .set('Origin', 'http://localhost:3001')
    .set('Sec-Fetch-Site', 'same-origin')
    .expect(403);

  const rotatedCsrf = await agent.get('/api/auth/csrf').expect(200);
  await agent
    .post('/api/auth/logout')
    .set('Origin', 'https://evil.example.test')
    .set('Sec-Fetch-Site', 'cross-site')
    .set('X-CSRF-Token', rotatedCsrf.body.data.csrfToken)
    .expect(403);

  await agent
    .post('/api/auth/logout')
    .set('Origin', 'http://localhost:3001')
    .set('Sec-Fetch-Site', 'same-origin')
    .set('X-CSRF-Token', rotatedCsrf.body.data.csrfToken)
    .expect(200);

  await agent.get('/api/auth/session').expect(401);
});

async function loginAgent(app) {
  const agent = request.agent(app);
  const csrf = await agent.get('/api/auth/csrf').expect(200);
  const login = await agent
    .post('/api/auth/login')
    .set('Origin', 'http://localhost:3001')
    .set('Sec-Fetch-Site', 'same-origin')
    .set('X-CSRF-Token', csrf.body.data.csrfToken)
    .send({ email: 'familia4@unicornio.local', password: 'Demo1234!' })
    .expect(200);
  return { agent, csrfToken: login.body.data.csrfToken };
}

test('el perfil propio rechaza centro, grupo, rol y propiedades desconocidas', async () => {
  const session = await loginAgent(createApp());
  const response = await session.agent
    .patch('/api/users/me/profile')
    .set('Origin', 'http://localhost:3001')
    .set('Sec-Fetch-Site', 'same-origin')
    .set('X-CSRF-Token', session.csrfToken)
    .send({ name: 'Familia', schoolId: 'center-2' })
    .expect(400);

  assert.equal(response.body.error.code, 'BAD_REQUEST');
});

test('cambiar la contrasena revoca todas las sesiones del usuario', async () => {
  const app = createApp();
  const first = await loginAgent(app);
  const second = await loginAgent(app);

  await first.agent
    .post('/api/auth/change-password')
    .set('Origin', 'http://localhost:3001')
    .set('Sec-Fetch-Site', 'same-origin')
    .set('X-CSRF-Token', first.csrfToken)
    .send({ currentPassword: 'Demo1234!', newPassword: 'NuevaFraseSegura-2026' })
    .expect(200);

  await first.agent.get('/api/auth/session').expect(401);
  await second.agent.get('/api/auth/session').expect(401);
});
