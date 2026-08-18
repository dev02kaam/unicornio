const express = require('express');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { validateRequest } = require('../middlewares/schema.middleware');
const {
  alertIdParamsSchema,
  alertTransferBodySchema,
  emptyBodySchema,
  campaignIdParamsSchema,
  participantIdParamsSchema,
  attemptIdParamsSchema,
  notificationIdParamsSchema,
  resultParamsSchema,
  campaignCreateBodySchema,
  answerBodySchema,
  alertResolutionBodySchema,
} = require('../schemas/questionnaires.schemas');
const {
  listDefinitionsController,
  createCampaignController,
  listCampaignsController,
  requestCampaignConsentsController,
  openCampaignController,
  closeCampaignController,
  cancelCampaignController,
  getCampaignMonitorController,
  listStudentAssignmentsController,
  startAttemptController,
  saveAnswerController,
  submitAttemptController,
  requestHelpController,
  listAlertsController,
  acknowledgeAlertController,
  resolveAlertController,
  transferAlertController,
  getResultController,
  listNotificationsController,
  markNotificationReadController,
} = require('../controllers/questionnaires.controller');

const questionnairesRouter = express.Router();
questionnairesRouter.use(authMiddleware);

questionnairesRouter.get('/questionnaire-definitions', listDefinitionsController);
questionnairesRouter.get('/questionnaire-campaigns', listCampaignsController);
questionnairesRouter.post('/questionnaire-campaigns', validateRequest({ body: campaignCreateBodySchema }), createCampaignController);
questionnairesRouter.get('/questionnaire-campaigns/:campaignId/monitor', validateRequest({ params: campaignIdParamsSchema }), getCampaignMonitorController);
questionnairesRouter.post('/questionnaire-campaigns/:campaignId/consents', validateRequest({ params: campaignIdParamsSchema, body: emptyBodySchema }), requestCampaignConsentsController);
questionnairesRouter.post('/questionnaire-campaigns/:campaignId/open', validateRequest({ params: campaignIdParamsSchema, body: emptyBodySchema }), openCampaignController);
questionnairesRouter.post('/questionnaire-campaigns/:campaignId/close', validateRequest({ params: campaignIdParamsSchema, body: emptyBodySchema }), closeCampaignController);
questionnairesRouter.post('/questionnaire-campaigns/:campaignId/cancel', validateRequest({ params: campaignIdParamsSchema, body: emptyBodySchema }), cancelCampaignController);
questionnairesRouter.get('/questionnaire-campaigns/:campaignId/alerts', validateRequest({ params: campaignIdParamsSchema }), listAlertsController);
questionnairesRouter.get('/questionnaire-campaigns/:campaignId/results/:studentId', validateRequest({ params: resultParamsSchema }), getResultController);

questionnairesRouter.get('/me/questionnaire-assignments', listStudentAssignmentsController);
questionnairesRouter.post('/questionnaire-participants/:participantId/attempts', validateRequest({ params: participantIdParamsSchema, body: emptyBodySchema }), startAttemptController);
questionnairesRouter.put('/questionnaire-attempts/:attemptId/answers', validateRequest({ params: attemptIdParamsSchema, body: answerBodySchema }), saveAnswerController);
questionnairesRouter.post('/questionnaire-attempts/:attemptId/submit', validateRequest({ params: attemptIdParamsSchema, body: emptyBodySchema }), submitAttemptController);
questionnairesRouter.post('/questionnaire-attempts/:attemptId/help', validateRequest({ params: attemptIdParamsSchema, body: emptyBodySchema }), requestHelpController);

questionnairesRouter.post('/questionnaire-alerts/:alertId/acknowledge', validateRequest({ params: alertIdParamsSchema, body: emptyBodySchema }), acknowledgeAlertController);
questionnairesRouter.post('/questionnaire-alerts/:alertId/resolve', validateRequest({ params: alertIdParamsSchema, body: alertResolutionBodySchema }), resolveAlertController);
questionnairesRouter.post(
  '/questionnaire-alerts/:alertId/transfer',
  validateRequest({ params: alertIdParamsSchema, body: alertTransferBodySchema }),
  transferAlertController,
);

questionnairesRouter.get('/notifications', listNotificationsController);
questionnairesRouter.post('/notifications/:notificationId/read', validateRequest({ params: notificationIdParamsSchema, body: emptyBodySchema }), markNotificationReadController);

module.exports = { questionnairesRouter };
