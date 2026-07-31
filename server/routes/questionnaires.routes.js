const express = require('express');
const { authMiddleware } = require('../middlewares/auth.middleware');
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
  getQuestionnairePreviewController,
} = require('../controllers/questionnaires.controller');

const questionnairePreviewRouter = express.Router();
questionnairePreviewRouter.get('/questionnaire-preview/:ageRange', getQuestionnairePreviewController);

const questionnairesRouter = express.Router();
questionnairesRouter.use(authMiddleware);

questionnairesRouter.get('/questionnaire-definitions', listDefinitionsController);
questionnairesRouter.get('/questionnaire-campaigns', listCampaignsController);
questionnairesRouter.post('/questionnaire-campaigns', createCampaignController);
questionnairesRouter.get('/questionnaire-campaigns/:campaignId/monitor', getCampaignMonitorController);
questionnairesRouter.post('/questionnaire-campaigns/:campaignId/consents', requestCampaignConsentsController);
questionnairesRouter.post('/questionnaire-campaigns/:campaignId/open', openCampaignController);
questionnairesRouter.post('/questionnaire-campaigns/:campaignId/close', closeCampaignController);
questionnairesRouter.post('/questionnaire-campaigns/:campaignId/cancel', cancelCampaignController);
questionnairesRouter.get('/questionnaire-campaigns/:campaignId/alerts', listAlertsController);
questionnairesRouter.get('/questionnaire-campaigns/:campaignId/results/:studentId', getResultController);

questionnairesRouter.get('/me/questionnaire-assignments', listStudentAssignmentsController);
questionnairesRouter.post('/questionnaire-participants/:participantId/attempts', startAttemptController);
questionnairesRouter.put('/questionnaire-attempts/:attemptId/answers', saveAnswerController);
questionnairesRouter.post('/questionnaire-attempts/:attemptId/submit', submitAttemptController);
questionnairesRouter.post('/questionnaire-attempts/:attemptId/help', requestHelpController);

questionnairesRouter.post('/questionnaire-alerts/:alertId/acknowledge', acknowledgeAlertController);
questionnairesRouter.post('/questionnaire-alerts/:alertId/resolve', resolveAlertController);
questionnairesRouter.post('/questionnaire-alerts/:alertId/transfer', transferAlertController);

questionnairesRouter.get('/notifications', listNotificationsController);
questionnairesRouter.post('/notifications/:notificationId/read', markNotificationReadController);

module.exports = { questionnairePreviewRouter, questionnairesRouter };
