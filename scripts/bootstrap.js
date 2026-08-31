process.env.NODE_ENV = 'test';
process.env.APP_PROFILE = 'demo';
process.env.APP_ORIGIN = 'http://localhost:3001';
process.env.CORS_ORIGIN = 'http://localhost:3001';
process.env.SESSION_COOKIE_SECURE = 'false';
process.env.QUESTIONNAIRE_DATA_KEY = Buffer.alloc(32, 7).toString('base64');
process.env.QUESTIONNAIRE_DATA_KEY_VERSION = 'test-v1';

const {
  database,
  createDemoState,
  createDemoSequences,
} = require('../server/config/database');

database.loadTestFixtures(createDemoState(), createDemoSequences());
