const express = require('express');
const { database } = require('../config/database');
const { env } = require('../config/env');
const { expectedMigrationIds } = require('../migrations');
const { getQuestionnaireKeyProvider } = require('../services/questionnaire-crypto.service');

async function defaultReadinessCheck() {
  await database.checkReadiness(expectedMigrationIds);
  if (env.appProfile === 'production' || env.questionnairePilotEnabled) {
    const provider = getQuestionnaireKeyProvider();
    if (!provider.isReady()) throw new Error('Proveedor de claves no disponible.');
  }
}

function createHealthRouter({ readinessCheck = defaultReadinessCheck } = {}) {
  const healthRouter = express.Router();

  healthRouter.get('/livez', (_req, res) => {
    res.json({ success: true, data: { status: 'alive' } });
  });

  healthRouter.get('/readyz', async (req, res) => {
    try {
      await readinessCheck();
      return res.json({ success: true, data: { status: 'ready' } });
    } catch (error) {
      req.log?.warn({ err: { type: error.name } }, 'readiness check failed');
      return res.status(503).json({
        success: false,
        error: { code: 'NOT_READY', message: 'El servicio no esta preparado.' },
      });
    }
  });

  return healthRouter;
}

module.exports = { createHealthRouter, defaultReadinessCheck };
