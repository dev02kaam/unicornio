const dotenv = require('dotenv');

dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';

const env = {
  port: Number(process.env.PORT || 3000),
  nodeEnv,
  jwtSecret: process.env.JWT_SECRET || 'change_me_in_production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  databaseUrl: process.env.DATABASE_URL || '',
  databaseSsl: process.env.DATABASE_SSL !== 'false',
  dataFile: process.env.DATA_FILE || 'server/data/runtime-state.json',
  questionnairePilotEnabled: process.env.QUESTIONNAIRE_PILOT_ENABLED === 'true',
  questionnaireDataKey: process.env.QUESTIONNAIRE_DATA_KEY || '',
  questionnaireDataKeyVersion: process.env.QUESTIONNAIRE_DATA_KEY_VERSION || 'v1',
  questionnaireSessionMaxMinutes: Number(process.env.QUESTIONNAIRE_SESSION_MAX_MINUTES || 120),
  questionnairePreviewEnabled: nodeEnv !== 'production'
    && process.env.QUESTIONNAIRE_PREVIEW_ENABLED !== 'false',
};

module.exports = { env };
