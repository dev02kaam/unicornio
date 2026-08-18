const express = require('express');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/role.middleware');
const { validateRequest } = require('../middlewares/schema.middleware');
const {
  invitationCreateBodySchema,
  invitationTokenParamsSchema,
  invitationAcceptBodySchema,
} = require('../schemas/invitations.schemas');
const {
  createInvitationController,
  acceptInvitationController,
} = require('../controllers/invitations.controller');
const {
  invitationAcceptLimiter,
  invitationIssueLimiter,
} = require('../middlewares/rateLimit.middleware');

const invitationsRouter = express.Router();

invitationsRouter.post(
  '/',
  invitationIssueLimiter,
  authMiddleware,
  requireRole(['ADMIN', 'SCHOOL']),
  validateRequest({ body: invitationCreateBodySchema }),
  createInvitationController,
);
invitationsRouter.post(
  '/:token/accept',
  invitationAcceptLimiter,
  validateRequest({ params: invitationTokenParamsSchema, body: invitationAcceptBodySchema }),
  acceptInvitationController,
);

module.exports = { invitationsRouter };
