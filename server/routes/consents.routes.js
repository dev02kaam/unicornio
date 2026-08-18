const express = require('express');
const { validateRequest } = require('../middlewares/schema.middleware');
const { paramsSchema, emptyBodySchema } = require('../schemas/common.schemas');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/role.middleware');
const {
  validateConsentRequest,
  validateConsentRevoke,
  validateLegalTextVersionCreate,
} = require('../middlewares/validation.middleware');
const {
  listConsentsController,
  createConsentController,
  getConsentByIdController,
  acceptConsentController,
  rejectConsentController,
  revokeConsentController,
  expireConsentController,
  getStudentConsentStatusController,
  listLegalTextVersionsController,
  getActiveLegalTextVersionController,
  createLegalTextVersionController,
  activateLegalTextVersionController,
  deactivateLegalTextVersionController,
  getConsentAuditController,
} = require('../controllers/consents.controller');

const consentsRouter = express.Router();

consentsRouter.use(authMiddleware);

consentsRouter.get('/legal-text-versions/active', getActiveLegalTextVersionController);
consentsRouter.get('/legal-text-versions', listLegalTextVersionsController);
consentsRouter.post('/legal-text-versions', requireRole(['ADMIN']), validateLegalTextVersionCreate, createLegalTextVersionController);
consentsRouter.post('/legal-text-versions/:id/activate', requireRole(['ADMIN']), validateRequest({ params: paramsSchema('id'), body: emptyBodySchema }), activateLegalTextVersionController);
consentsRouter.post('/legal-text-versions/:id/deactivate', requireRole(['ADMIN']), validateRequest({ params: paramsSchema('id'), body: emptyBodySchema }), deactivateLegalTextVersionController);

consentsRouter.get('/students/:studentId/consent-status', validateRequest({ params: paramsSchema('studentId') }), getStudentConsentStatusController);

consentsRouter.get('/consents', listConsentsController);
consentsRouter.post('/consents', validateConsentRequest, createConsentController);
consentsRouter.get('/consents/:id', validateRequest({ params: paramsSchema('id') }), getConsentByIdController);
consentsRouter.post('/consents/:id/accept', validateRequest({ params: paramsSchema('id'), body: emptyBodySchema }), acceptConsentController);
consentsRouter.post('/consents/:id/reject', validateRequest({ params: paramsSchema('id'), body: emptyBodySchema }), rejectConsentController);
consentsRouter.post('/consents/:id/revoke', validateRequest({ params: paramsSchema('id') }), validateConsentRevoke, revokeConsentController);
consentsRouter.post('/consents/:id/expire', requireRole(['ADMIN']), validateRequest({ params: paramsSchema('id'), body: emptyBodySchema }), expireConsentController);
consentsRouter.get('/consents/:id/audit', validateRequest({ params: paramsSchema('id') }), getConsentAuditController);

module.exports = { consentsRouter };
