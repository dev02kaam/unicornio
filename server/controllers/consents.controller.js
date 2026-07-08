const {
  createConsentRequest,
  getConsents,
  getConsentById,
  acceptConsent,
  rejectConsent,
  revokeConsent,
  expireConsent,
  getConsentStatusValue,
  getActiveLegalTextVersion,
  createLegalTextVersion,
  activateLegalTextVersion,
  deactivateLegalTextVersion,
  getLegalTextVersions,
  getConsentAudit,
} = require('../services/consents.service');
const { sendSuccess } = require('../utils/response');
const { AppError } = require('../utils/errors');

function listConsentsController(req, res, next) {
  try {
    const consents = getConsents(req.query || {}, req.user);
    return sendSuccess(res, { consents }, 'Consentimientos listados correctamente.');
  } catch (error) {
    return next(error);
  }
}

function createConsentController(req, res, next) {
  try {
    const consent = createConsentRequest(req.body || {}, req.user);
    return sendSuccess(res, { consent }, 'Solicitud de consentimiento creada correctamente.', 201);
  } catch (error) {
    return next(error);
  }
}

function getConsentByIdController(req, res, next) {
  try {
    const consent = getConsentById(req.params.id, req.user);
    return sendSuccess(res, { consent }, 'Consentimiento encontrado.');
  } catch (error) {
    return next(error);
  }
}

function acceptConsentController(req, res, next) {
  try {
    const consent = acceptConsent(req.params.id, req.user);
    return sendSuccess(res, { consent }, 'Consentimiento aceptado correctamente.');
  } catch (error) {
    return next(error);
  }
}

function rejectConsentController(req, res, next) {
  try {
    const consent = rejectConsent(req.params.id, req.user);
    return sendSuccess(res, { consent }, 'Consentimiento rechazado correctamente.');
  } catch (error) {
    return next(error);
  }
}

function revokeConsentController(req, res, next) {
  try {
    const consent = revokeConsent(req.params.id, req.body?.reason, req.user);
    return sendSuccess(res, { consent }, 'Consentimiento revocado correctamente.');
  } catch (error) {
    return next(error);
  }
}

function expireConsentController(req, res, next) {
  try {
    const consent = expireConsent(req.params.id, req.user);
    return sendSuccess(res, { consent }, 'Consentimiento marcado como caducado.');
  } catch (error) {
    return next(error);
  }
}

function getStudentConsentStatusController(req, res, next) {
  try {
    const status = getConsentStatusValue(req.params.studentId, req.user);
    return sendSuccess(res, { status }, 'Estado de consentimiento consultado correctamente.');
  } catch (error) {
    return next(error);
  }
}

function listLegalTextVersionsController(req, res, next) {
  try {
    const versions = getLegalTextVersions(req.user);
    return sendSuccess(res, { versions }, 'Versiones legales listadas correctamente.');
  } catch (error) {
    return next(error);
  }
}

function getActiveLegalTextVersionController(req, res, next) {
  try {
    const version = getActiveLegalTextVersion();
    if (!version) {
      throw new AppError('No existe una version legal activa.', 404, null, 'NOT_FOUND');
    }

    return sendSuccess(res, { version }, 'Version legal activa encontrada.');
  } catch (error) {
    return next(error);
  }
}

function createLegalTextVersionController(req, res, next) {
  try {
    const version = createLegalTextVersion(req.body || {}, req.user);
    const message = version.isActive
      ? 'Version legal creada y activada correctamente.'
      : 'Version legal creada correctamente.';
    return sendSuccess(res, { version }, message, 201);
  } catch (error) {
    return next(error);
  }
}

function activateLegalTextVersionController(req, res, next) {
  try {
    const result = activateLegalTextVersion(req.params.id, req.user);
    const message = result.changed
      ? 'Version legal activada correctamente.'
      : 'La version legal ya estaba activa.';
    return sendSuccess(res, { version: result.version }, message);
  } catch (error) {
    return next(error);
  }
}

function deactivateLegalTextVersionController(req, res, next) {
  try {
    const result = deactivateLegalTextVersion(req.params.id, req.user);
    const message = result.changed
      ? 'Version legal desactivada correctamente.'
      : 'La version legal ya estaba inactiva.';
    return sendSuccess(res, { version: result.version }, message);
  } catch (error) {
    return next(error);
  }
}

function getConsentAuditController(req, res, next) {
  try {
    const audit = getConsentAudit(req.params.id, req.user);
    return sendSuccess(res, { audit }, 'Auditoria del consentimiento consultada correctamente.');
  } catch (error) {
    return next(error);
  }
}

module.exports = {
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
};
