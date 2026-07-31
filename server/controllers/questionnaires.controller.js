const { sendSuccess } = require('../utils/response');
const {
  listQuestionnaireDefinitions,
  createCampaign,
  listCampaigns,
  requestCampaignConsents,
  openCampaign,
  closeCampaign,
  cancelCampaign,
  getCampaignMonitor,
  listStudentAssignments,
  startAttempt,
  saveAnswer,
  submitAttempt,
  requestHelp,
  listCampaignAlerts,
  acknowledgeAlert,
  resolveAlert,
  transferAlert,
  getStudentResult,
  listNotifications,
  markNotificationRead,
  getQuestionnairePreview,
} = require('../services/questionnaires.service');

async function getQuestionnairePreviewController(req, res, next) {
  try {
    const definition = getQuestionnairePreview(req.params.ageRange);
    return sendSuccess(
      res,
      { definition },
      'Modo de prueba funcional cargado.',
    );
  } catch (error) {
    return next(error);
  }
}

async function listDefinitionsController(req, res, next) {
  try {
    const definitions = await listQuestionnaireDefinitions(req.user);
    return sendSuccess(res, { definitions }, 'Cuestionarios cargados.');
  } catch (error) {
    return next(error);
  }
}

async function createCampaignController(req, res, next) {
  try {
    const campaign = await createCampaign(req.body || {}, req.user);
    return sendSuccess(res, { campaign }, 'Campaña creada.', 201);
  } catch (error) {
    return next(error);
  }
}

async function listCampaignsController(req, res, next) {
  try {
    const campaigns = await listCampaigns(req.user);
    return sendSuccess(res, { campaigns }, 'Campañas cargadas.');
  } catch (error) {
    return next(error);
  }
}

async function requestCampaignConsentsController(req, res, next) {
  try {
    const monitor = await requestCampaignConsents(req.params.campaignId, req.user);
    return sendSuccess(res, monitor, 'Consentimientos solicitados.');
  } catch (error) {
    return next(error);
  }
}

async function openCampaignController(req, res, next) {
  try {
    const campaign = await openCampaign(req.params.campaignId, req.user);
    return sendSuccess(res, { campaign }, 'Sesión abierta.');
  } catch (error) {
    return next(error);
  }
}

async function closeCampaignController(req, res, next) {
  try {
    const campaign = await closeCampaign(req.params.campaignId, req.user);
    return sendSuccess(res, { campaign }, 'Sesión cerrada.');
  } catch (error) {
    return next(error);
  }
}

async function cancelCampaignController(req, res, next) {
  try {
    const campaign = await cancelCampaign(req.params.campaignId, req.user);
    return sendSuccess(res, { campaign }, 'Campaña cancelada.');
  } catch (error) {
    return next(error);
  }
}

async function getCampaignMonitorController(req, res, next) {
  try {
    const monitor = await getCampaignMonitor(req.params.campaignId, req.user);
    return sendSuccess(res, monitor, 'Monitor cargado.');
  } catch (error) {
    return next(error);
  }
}

async function listStudentAssignmentsController(req, res, next) {
  try {
    const assignments = await listStudentAssignments(req.user);
    return sendSuccess(res, { assignments }, 'Cuestionarios del alumno cargados.');
  } catch (error) {
    return next(error);
  }
}

async function startAttemptController(req, res, next) {
  try {
    const attempt = await startAttempt(req.params.participantId, req.user);
    return sendSuccess(res, attempt, 'Cuestionario iniciado.', 201);
  } catch (error) {
    return next(error);
  }
}

async function saveAnswerController(req, res, next) {
  try {
    const answer = await saveAnswer(req.params.attemptId, req.body || {}, req.user);
    return sendSuccess(res, { answer }, 'Respuesta guardada.');
  } catch (error) {
    return next(error);
  }
}

async function submitAttemptController(req, res, next) {
  try {
    const result = await submitAttempt(req.params.attemptId, req.user);
    return sendSuccess(res, result, 'Cuestionario enviado.');
  } catch (error) {
    return next(error);
  }
}

async function requestHelpController(req, res, next) {
  try {
    const help = await requestHelp(req.params.attemptId, req.user);
    return sendSuccess(res, help, 'Solicitud de ayuda registrada.');
  } catch (error) {
    return next(error);
  }
}

async function listAlertsController(req, res, next) {
  try {
    const alerts = await listCampaignAlerts(req.params.campaignId, req.user);
    return sendSuccess(res, { alerts }, 'Alertas cargadas.');
  } catch (error) {
    return next(error);
  }
}

async function acknowledgeAlertController(req, res, next) {
  try {
    const alert = await acknowledgeAlert(req.params.alertId, req.user);
    return sendSuccess(res, { alert }, 'Recepción confirmada.');
  } catch (error) {
    return next(error);
  }
}

async function resolveAlertController(req, res, next) {
  try {
    const alert = await resolveAlert(req.params.alertId, req.body?.note, req.user);
    return sendSuccess(res, { alert }, 'Alerta resuelta.');
  } catch (error) {
    return next(error);
  }
}

async function transferAlertController(req, res, next) {
  try {
    const alert = await transferAlert(req.params.alertId, req.body?.note, req.user);
    return sendSuccess(res, { alert }, 'Alerta transferida.');
  } catch (error) {
    return next(error);
  }
}

async function getResultController(req, res, next) {
  try {
    const result = await getStudentResult(
      req.params.campaignId,
      req.params.studentId,
      req.user,
    );
    return sendSuccess(res, { result }, 'Resultado cargado.');
  } catch (error) {
    return next(error);
  }
}

async function listNotificationsController(req, res, next) {
  try {
    const notifications = await listNotifications(req.user);
    return sendSuccess(res, { notifications }, 'Notificaciones cargadas.');
  } catch (error) {
    return next(error);
  }
}

async function markNotificationReadController(req, res, next) {
  try {
    const notification = await markNotificationRead(req.params.notificationId, req.user);
    return sendSuccess(res, { notification }, 'Notificación leída.');
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getQuestionnairePreviewController,
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
};
