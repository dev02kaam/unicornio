const express = require('express');
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
consentsRouter.post('/legal-text-versions/:id/activate', requireRole(['ADMIN']), activateLegalTextVersionController);
consentsRouter.post('/legal-text-versions/:id/deactivate', requireRole(['ADMIN']), deactivateLegalTextVersionController);

consentsRouter.get('/students/:studentId/consent-status', getStudentConsentStatusController);

consentsRouter.get('/consents', listConsentsController);
consentsRouter.post('/consents', validateConsentRequest, createConsentController);
consentsRouter.get('/consents/:id', getConsentByIdController);
consentsRouter.post('/consents/:id/accept', acceptConsentController);
consentsRouter.post('/consents/:id/reject', rejectConsentController);
consentsRouter.post('/consents/:id/revoke', validateConsentRevoke, revokeConsentController);
consentsRouter.post('/consents/:id/expire', requireRole(['ADMIN']), expireConsentController);
consentsRouter.get('/consents/:id/audit', getConsentAuditController);

module.exports = { consentsRouter };
