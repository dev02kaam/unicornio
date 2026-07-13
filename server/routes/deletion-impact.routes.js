const express = require('express');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { getDeletionImpactController } = require('../controllers/deletion-impact.controller');

const deletionImpactRouter = express.Router();

deletionImpactRouter.use(authMiddleware);
deletionImpactRouter.get('/deletion-impact/:resourceType/:resourceId', getDeletionImpactController);

module.exports = { deletionImpactRouter };
