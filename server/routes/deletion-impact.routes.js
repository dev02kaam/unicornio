const express = require('express');
const { z } = require('zod');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { validateRequest } = require('../middlewares/schema.middleware');
const { opaqueIdSchema } = require('../schemas/common.schemas');
const { getDeletionImpactController } = require('../controllers/deletion-impact.controller');

const deletionImpactRouter = express.Router();

deletionImpactRouter.use(authMiddleware);
deletionImpactRouter.get(
  '/deletion-impact/:resourceType/:resourceId',
  validateRequest({
    params: z.object({
      resourceType: z.enum(['user', 'center', 'group']),
      resourceId: opaqueIdSchema,
    }).strict(),
  }),
  getDeletionImpactController,
);

module.exports = { deletionImpactRouter };
