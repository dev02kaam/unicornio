const { database } = require('../config/database');
const { AppError } = require('../utils/errors');
const {
  createConsentModel,
  createLegalTextVersionModel,
  createConsentAuditLogModel,
} = require('../models/consent.model');
const {
  findUserById,
} = require('./users.service');
const {
  hasCenterAccess,
  findCenterById,
} = require('../utils/organization.helpers');
const {
  CONSENT_STATUSES,
  CONSENT_AUDIT_ACTIONS,
} = require('../utils/constants');
const {
  findStudentById,
  findFamilyForStudent,
  canViewConsent,
  canManageConsentRequest,
  canFamilyActOnConsent,
  canViewStudentConsentStatus,
  canManageLegalTextVersions,
  getConsentStatusLabel,
  safeUser,
} = require('../utils/consents.helpers');

function getConsentCollection() {
  return database.getCollection('consents') || [];
}

function getLegalTextVersionCollection() {
  return database.getCollection('legalTextVersions') || [];
}

function getConsentAuditCollection() {
  return database.getCollection('consentAuditLogs') || [];
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeOptionalText(value) {
  if (value === undefined) {
    return undefined;
  }

  const text = normalizeText(value);
  return text.length > 0 ? text : null;
}

function nowIso() {
  return new Date().toISOString();
}

function findLegalTextVersionById(id) {
  return getLegalTextVersionCollection().find((item) => item.id === String(id)) || null;
}

function findConsentById(id) {
  return getConsentCollection().find((item) => item.id === String(id)) || null;
}

function buildLegalTextVersionSummary(version) {
  if (!version) {
    return null;
  }

  return createLegalTextVersionModel(version);
}

function buildConsentAuditSummary(log) {
  const performedByUser = log?.performedByUserId ? findUserById(log.performedByUserId) : null;

  return {
    ...log,
    performedByUser: safeUser(performedByUser),
  };
}

function buildConsentSummary(consent) {
  if (!consent) {
    return null;
  }

  return {
    ...createConsentModel(consent),
    statusLabel: getConsentStatusLabel(consent.status),
    student: safeUser(findUserById(consent.studentId)),
    familyUser: safeUser(findUserById(consent.familyUserId)),
    requestedByUser: safeUser(findUserById(consent.requestedByUserId)),
    center: findCenterById(consent.centerId),
    legalTextVersion: buildLegalTextVersionSummary(findLegalTextVersionById(consent.legalTextVersionId)),
  };
}

function getCurrentConsentVersion(consent) {
  return findLegalTextVersionById(consent?.legalTextVersionId);
}

function createConsentAuditLog(data) {
  const logs = getConsentAuditCollection();
  const log = createConsentAuditLogModel({
    id: data.id || database.nextId('consentAuditLogs', 'cal'),
    consentId: data.consentId ?? null,
    action: data.action,
    performedByUserId: data.performedByUserId ?? null,
    previousStatus: data.previousStatus ?? null,
    newStatus: data.newStatus ?? null,
    metadata: data.metadata ?? null,
    createdAt: data.createdAt || nowIso(),
  });

  logs.push(log);
  database.setCollection('consentAuditLogs', logs);
  return buildConsentAuditSummary(log);
}

function getActiveLegalTextVersion() {
  const activeVersions = getLegalTextVersionCollection().filter((item) => item.isActive);
  return activeVersions.sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')))[0] || null;
}

function getLegalTextVersions(currentUser) {
  const versions = getLegalTextVersionCollection().slice();

  if (!canManageLegalTextVersions(currentUser)) {
    return versions.filter((version) => version.isActive).map(buildLegalTextVersionSummary);
  }

  return versions
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    .map(buildLegalTextVersionSummary);
}

function expireConsentsForLegalVersionIds(legalVersionIds, performedByUser) {
  const ids = new Set((legalVersionIds || []).map(String));
  if (!ids.size) {
    return [];
  }

  const consents = getConsentCollection();
  const expired = [];

  consents.forEach((consent) => {
    if (!ids.has(String(consent.legalTextVersionId))) {
      return;
    }

    if (![CONSENT_STATUSES.PENDING, CONSENT_STATUSES.ACCEPTED].includes(consent.status)) {
      return;
    }

    const previousStatus = consent.status;
    consent.status = CONSENT_STATUSES.EXPIRED;
    consent.expiresAt = nowIso();
    consent.updatedAt = consent.expiresAt;
    expired.push(consent);

    createConsentAuditLog({
      consentId: consent.id,
      action: CONSENT_AUDIT_ACTIONS.CONSENT_EXPIRED,
      performedByUserId: performedByUser?.id || null,
      previousStatus,
      newStatus: CONSENT_STATUSES.EXPIRED,
      metadata: {
        reason: 'LEGAL_VERSION_CHANGED',
        legalTextVersionId: consent.legalTextVersionId,
      },
      createdAt: consent.updatedAt,
    });
  });

  if (expired.length > 0) {
    database.persistCollection('consents');
  }

  return expired.map(buildConsentSummary);
}

function createLegalTextVersion(data, currentUser) {
  if (!canManageLegalTextVersions(currentUser)) {
    throw new AppError('No tienes permiso para gestionar textos legales.', 403, null, 'FORBIDDEN');
  }

  const version = normalizeText(data.version);
  const title = normalizeText(data.title);
  const content = normalizeText(data.content);
  const effectiveFrom = normalizeOptionalText(data.effectiveFrom) || nowIso().slice(0, 10);
  const effectiveTo = normalizeOptionalText(data.effectiveTo) || null;
  const isActive = data.isActive !== false;

  if (!version) {
    throw new AppError('La version es obligatoria.', 400, null, 'BAD_REQUEST');
  }

  if (!title) {
    throw new AppError('El titulo es obligatorio.', 400, null, 'BAD_REQUEST');
  }

  if (!content) {
    throw new AppError('El contenido es obligatorio.', 400, null, 'BAD_REQUEST');
  }

  const existingVersion = getLegalTextVersionCollection().find((item) => String(item.version || '').trim() === version);
  if (existingVersion) {
    throw new AppError('Ya existe una version con ese identificador.', 409, null, 'CONFLICT');
  }

  const now = nowIso();
  const versions = getLegalTextVersionCollection();
  const previousActiveVersions = versions.filter((item) => item.isActive);

  if (isActive) {
    previousActiveVersions.forEach((item) => {
      item.isActive = false;
      item.effectiveTo = item.effectiveTo || now.slice(0, 10);
      item.updatedAt = now;
    });
  }

  const legalTextVersion = createLegalTextVersionModel({
    id: database.nextId('legalTextVersions', 'legal-text'),
    version,
    title,
    content,
    isActive,
    effectiveFrom,
    effectiveTo,
    createdAt: now,
    updatedAt: now,
  });

  versions.push(legalTextVersion);
  database.setCollection('legalTextVersions', versions);

  createConsentAuditLog({
    consentId: null,
    action: CONSENT_AUDIT_ACTIONS.LEGAL_VERSION_CREATED,
    performedByUserId: currentUser.id,
    previousStatus: null,
    newStatus: null,
    metadata: {
      legalTextVersionId: legalTextVersion.id,
      version: legalTextVersion.version,
      isActive: legalTextVersion.isActive,
    },
    createdAt: now,
  });

  if (isActive && previousActiveVersions.length > 0) {
    expireConsentsForLegalVersionIds(previousActiveVersions.map((item) => item.id), currentUser);
  }

  return buildLegalTextVersionSummary(legalTextVersion);
}

function updateLegalTextVersionState(versionId, isActive, currentUser) {
  if (!canManageLegalTextVersions(currentUser)) {
    throw new AppError('No tienes permiso para gestionar textos legales.', 403, null, 'FORBIDDEN');
  }

  const legalTextVersion = findLegalTextVersionById(versionId);
  if (!legalTextVersion) {
    throw new AppError('La version legal no existe.', 404, null, 'NOT_FOUND');
  }

  const nextState = Boolean(isActive);
  if (Boolean(legalTextVersion.isActive) === nextState) {
    return {
      version: buildLegalTextVersionSummary(legalTextVersion),
      changed: false,
    };
  }

  const now = nowIso();
  const versions = getLegalTextVersionCollection();
  const previousActiveVersions = nextState
    ? versions.filter((item) => item.isActive && item.id !== legalTextVersion.id)
    : [];

  legalTextVersion.isActive = nextState;
  legalTextVersion.updatedAt = now;

  if (nextState) {
    legalTextVersion.effectiveFrom = legalTextVersion.effectiveFrom || now.slice(0, 10);
    legalTextVersion.effectiveTo = null;

    previousActiveVersions.forEach((item) => {
      item.isActive = false;
      item.effectiveTo = item.effectiveTo || now.slice(0, 10);
      item.updatedAt = now;
    });

    if (previousActiveVersions.length > 0) {
      expireConsentsForLegalVersionIds(previousActiveVersions.map((item) => item.id), currentUser);
    }
  } else {
    legalTextVersion.effectiveTo = legalTextVersion.effectiveTo || now.slice(0, 10);
    expireConsentsForLegalVersionIds([legalTextVersion.id], currentUser);
  }

  database.setCollection('legalTextVersions', versions);

  createConsentAuditLog({
    consentId: null,
    action: CONSENT_AUDIT_ACTIONS.LEGAL_VERSION_UPDATED,
    performedByUserId: currentUser.id,
    previousStatus: nextState ? 'INACTIVE' : 'ACTIVE',
    newStatus: nextState ? 'ACTIVE' : 'INACTIVE',
    metadata: {
      legalTextVersionId: legalTextVersion.id,
      version: legalTextVersion.version,
      isActive: legalTextVersion.isActive,
      operation: nextState ? 'ACTIVATE' : 'DEACTIVATE',
      previousActiveVersionIds: previousActiveVersions.map((item) => item.id),
    },
    createdAt: now,
  });

  return {
    version: buildLegalTextVersionSummary(legalTextVersion),
    changed: true,
    previousActiveVersionIds: previousActiveVersions.map((item) => item.id),
  };
}

function activateLegalTextVersion(versionId, currentUser) {
  return updateLegalTextVersionState(versionId, true, currentUser);
}

function deactivateLegalTextVersion(versionId, currentUser) {
  return updateLegalTextVersionState(versionId, false, currentUser);
}

function assertConsentCandidate(studentId, familyUserId, legalTextVersionId) {
  const student = findStudentById(studentId);
  if (!student) {
    throw new AppError('El estudiante no existe o no es valido.', 404, null, 'NOT_FOUND');
  }

  if (!student.isActive) {
    throw new AppError('El estudiante esta inactivo.', 400, null, 'BAD_REQUEST');
  }

  const familyUser = findUserById(familyUserId);
  if (!familyUser || !familyUser.isActive || String(familyUser.role || '').toUpperCase() !== 'FAMILY') {
    throw new AppError('La familia no es valida.', 404, null, 'NOT_FOUND');
  }

  if (String(familyUser.linkedStudentId || '') !== student.id) {
    throw new AppError('Este estudiante no esta vinculado a la cuenta familiar indicada.', 403, null, 'FORBIDDEN');
  }

  const legalTextVersion = findLegalTextVersionById(legalTextVersionId);
  if (!legalTextVersion) {
    throw new AppError('La version legal no existe.', 404, null, 'NOT_FOUND');
  }

  if (!legalTextVersion.isActive) {
    throw new AppError('La version legal no esta activa.', 409, null, 'CONFLICT');
  }

  return { student, familyUser, legalTextVersion };
}

function getExistingConsentForTuple(studentId, familyUserId, centerId, legalTextVersionId, campaignId = null) {
  return getConsentCollection().find((consent) => (
    consent.studentId === String(studentId)
    && consent.familyUserId === String(familyUserId)
    && consent.centerId === String(centerId)
    && consent.legalTextVersionId === String(legalTextVersionId)
    && String(consent.campaignId || '') === String(campaignId || '')
  )) || null;
}

function createConsentRequest(data, currentUser, { allowProfessionalCampaign = false } = {}) {
  const studentId = String(data.studentId || '').trim();
  const familyUserId = String(data.familyUserId || '').trim();
  const legalTextVersionId = String(data.legalTextVersionId || '').trim();
  const student = findStudentById(studentId);

  if (!student) {
    throw new AppError('El estudiante no existe o no es valido.', 404, null, 'NOT_FOUND');
  }

  const professionalCampaignAllowed = (
    allowProfessionalCampaign
    && String(currentUser?.role || '').toUpperCase() === 'PROFESSIONAL'
    && data.campaignId
  );
  if (!professionalCampaignAllowed && !canManageConsentRequest(currentUser, studentId, data.centerId || student.schoolId || null)) {
    throw new AppError('No tienes permiso para crear esta solicitud de consentimiento.', 403, null, 'FORBIDDEN');
  }

  const { student: validatedStudent, familyUser, legalTextVersion } = assertConsentCandidate(studentId, familyUserId, legalTextVersionId);
  const centerId = String(data.centerId || validatedStudent.schoolId || '').trim();

  if (!centerId) {
    throw new AppError('El estudiante no tiene un centro asignado.', 400, null, 'BAD_REQUEST');
  }

  if (String(validatedStudent.schoolId || '') !== centerId) {
    throw new AppError('El centro no coincide con el del estudiante.', 400, null, 'BAD_REQUEST');
  }

  if (String(currentUser.role || '').toUpperCase() === 'SCHOOL' && String(currentUser.schoolId || '') !== centerId) {
    throw new AppError('No tienes permiso para crear solicitudes en este centro.', 403, null, 'FORBIDDEN');
  }

  const campaignId = data.campaignId ? String(data.campaignId) : null;
  const existingConsent = getExistingConsentForTuple(
    student.id,
    familyUser.id,
    centerId,
    legalTextVersion.id,
    campaignId,
  );
  if (existingConsent && [CONSENT_STATUSES.PENDING, CONSENT_STATUSES.ACCEPTED].includes(existingConsent.status)) {
    if (campaignId) {
      return buildConsentSummary(existingConsent);
    }
    throw new AppError('Ya existe un consentimiento activo o pendiente para este estudiante y esta version.', 409, null, 'CONFLICT');
  }

  const now = nowIso();
  const consent = createConsentModel({
    id: database.nextId('consents', 'consent'),
    studentId: validatedStudent.id,
    familyUserId: familyUser.id,
    centerId,
    legalTextVersionId: legalTextVersion.id,
    campaignId,
    status: CONSENT_STATUSES.PENDING,
    requestedByUserId: currentUser.id,
    acceptedAt: null,
    rejectedAt: null,
    revokedAt: null,
    expiresAt: legalTextVersion.effectiveTo || null,
    revocationReason: null,
    createdAt: now,
    updatedAt: now,
  });

  const consents = getConsentCollection();
  consents.push(consent);
  database.setCollection('consents', consents);

  createConsentAuditLog({
    consentId: consent.id,
    action: CONSENT_AUDIT_ACTIONS.CONSENT_CREATED,
    performedByUserId: currentUser.id,
    previousStatus: null,
    newStatus: CONSENT_STATUSES.PENDING,
    metadata: {
      studentId: validatedStudent.id,
      familyUserId: familyUser.id,
      centerId,
      legalTextVersionId: legalTextVersion.id,
      campaignId,
    },
    createdAt: now,
  });

  return buildConsentSummary(consent);
}

function getAccessibleConsentsForUser(currentUser) {
  const consents = getConsentCollection();
  if (!currentUser) {
    return [];
  }

  if (String(currentUser.role || '').toUpperCase() === 'ADMIN') {
    return consents;
  }

  if (String(currentUser.role || '').toUpperCase() === 'FAMILY') {
    return consents.filter((consent) => consent.familyUserId === currentUser.id);
  }

  if (String(currentUser.role || '').toUpperCase() === 'STUDENT') {
    return consents.filter((consent) => consent.studentId === currentUser.id);
  }

  const accessibleCenterId = String(currentUser.schoolId || '').trim();
  if (!accessibleCenterId) {
    return [];
  }

  return consents.filter((consent) => consent.centerId === accessibleCenterId || hasCenterAccess(currentUser, consent.centerId));
}

function filterConsents(consents, filters = {}) {
  return consents.filter((consent) => {
    if (filters.studentId && consent.studentId !== String(filters.studentId)) {
      return false;
    }
    if (filters.familyUserId && consent.familyUserId !== String(filters.familyUserId)) {
      return false;
    }
    if (filters.centerId && consent.centerId !== String(filters.centerId)) {
      return false;
    }
    if (filters.status && consent.status !== String(filters.status).toUpperCase()) {
      return false;
    }
    if (filters.legalTextVersionId && consent.legalTextVersionId !== String(filters.legalTextVersionId)) {
      return false;
    }
    if (filters.campaignId && String(consent.campaignId || '') !== String(filters.campaignId)) {
      return false;
    }
    return true;
  });
}

function getConsents(filters, currentUser) {
  const accessibleConsents = getAccessibleConsentsForUser(currentUser);
  return filterConsents(accessibleConsents, filters)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    .map(buildConsentSummary);
}

function assertConsentPermission(consent, user) {
  if (!canViewConsent(user, consent)) {
    throw new AppError('No tienes permiso para actuar sobre este consentimiento.', 403, null, 'FORBIDDEN');
  }
}

function assertFamilyActionPermission(consent, user) {
  if (!canFamilyActOnConsent(user, consent)) {
    throw new AppError('No tienes permiso para actuar sobre este consentimiento.', 403, null, 'FORBIDDEN');
  }
}

function ensureConsentEditable(consent) {
  const version = getCurrentConsentVersion(consent);
  if (!version || !version.isActive) {
    consent.status = CONSENT_STATUSES.EXPIRED;
    consent.expiresAt = nowIso();
    consent.updatedAt = consent.expiresAt;
    database.persistCollection('consents');
    return false;
  }

  return true;
}

function acceptConsent(consentId, currentUser) {
  const consent = findConsentById(consentId);
  if (!consent) {
    throw new AppError('Consentimiento no encontrado.', 404, null, 'NOT_FOUND');
  }

  assertFamilyActionPermission(consent, currentUser);

  if (consent.status === CONSENT_STATUSES.ACCEPTED) {
    return buildConsentSummary(consent);
  }
  if (consent.status !== CONSENT_STATUSES.PENDING) {
    throw new AppError('Solo se puede aceptar un consentimiento pendiente.', 409, null, 'CONFLICT');
  }

  if (!ensureConsentEditable(consent)) {
    createConsentAuditLog({
      consentId: consent.id,
      action: CONSENT_AUDIT_ACTIONS.CONSENT_EXPIRED,
      performedByUserId: currentUser.id,
      previousStatus: CONSENT_STATUSES.PENDING,
      newStatus: CONSENT_STATUSES.EXPIRED,
      metadata: {
        reason: 'LEGAL_VERSION_INACTIVE',
        legalTextVersionId: consent.legalTextVersionId,
      },
      createdAt: consent.updatedAt,
    });
    throw new AppError('La version legal ya no esta activa.', 409, null, 'CONFLICT');
  }

  const previousStatus = consent.status;
  const now = nowIso();
  consent.status = CONSENT_STATUSES.ACCEPTED;
  consent.acceptedAt = now;
  consent.rejectedAt = null;
  consent.revokedAt = null;
  consent.revocationReason = null;
  consent.expiresAt = getCurrentConsentVersion(consent)?.effectiveTo || null;
  consent.updatedAt = now;
  database.persistCollection('consents');

  createConsentAuditLog({
    consentId: consent.id,
    action: CONSENT_AUDIT_ACTIONS.CONSENT_ACCEPTED,
    performedByUserId: currentUser.id,
    previousStatus,
    newStatus: consent.status,
    metadata: {
      legalTextVersionId: consent.legalTextVersionId,
    },
    createdAt: now,
  });

  return buildConsentSummary(consent);
}

function rejectConsent(consentId, currentUser) {
  const consent = findConsentById(consentId);
  if (!consent) {
    throw new AppError('Consentimiento no encontrado.', 404, null, 'NOT_FOUND');
  }

  assertFamilyActionPermission(consent, currentUser);

  if (consent.status === CONSENT_STATUSES.REJECTED) {
    return buildConsentSummary(consent);
  }
  if (consent.status !== CONSENT_STATUSES.PENDING) {
    throw new AppError('Solo se puede rechazar un consentimiento pendiente.', 409, null, 'CONFLICT');
  }

  if (!ensureConsentEditable(consent)) {
    createConsentAuditLog({
      consentId: consent.id,
      action: CONSENT_AUDIT_ACTIONS.CONSENT_EXPIRED,
      performedByUserId: currentUser.id,
      previousStatus: CONSENT_STATUSES.PENDING,
      newStatus: CONSENT_STATUSES.EXPIRED,
      metadata: {
        reason: 'LEGAL_VERSION_INACTIVE',
        legalTextVersionId: consent.legalTextVersionId,
      },
      createdAt: consent.updatedAt,
    });
    throw new AppError('La version legal ya no esta activa.', 409, null, 'CONFLICT');
  }

  const previousStatus = consent.status;
  const now = nowIso();
  consent.status = CONSENT_STATUSES.REJECTED;
  consent.rejectedAt = now;
  consent.acceptedAt = null;
  consent.revokedAt = null;
  consent.revocationReason = null;
  consent.expiresAt = null;
  consent.updatedAt = now;
  database.persistCollection('consents');

  createConsentAuditLog({
    consentId: consent.id,
    action: CONSENT_AUDIT_ACTIONS.CONSENT_REJECTED,
    performedByUserId: currentUser.id,
    previousStatus,
    newStatus: consent.status,
    metadata: {
      legalTextVersionId: consent.legalTextVersionId,
    },
    createdAt: now,
  });

  return buildConsentSummary(consent);
}

function revokeConsent(consentId, reason, currentUser) {
  const consent = findConsentById(consentId);
  if (!consent) {
    throw new AppError('Consentimiento no encontrado.', 404, null, 'NOT_FOUND');
  }

  assertFamilyActionPermission(consent, currentUser);

  if (consent.status === CONSENT_STATUSES.REVOKED) {
    return buildConsentSummary(consent);
  }
  if (consent.status !== CONSENT_STATUSES.ACCEPTED) {
    throw new AppError('Solo se puede revocar un consentimiento aceptado.', 409, null, 'CONFLICT');
  }

  const revocationReason = normalizeText(reason);
  if (!revocationReason) {
    throw new AppError('Debes indicar un motivo para revocar el consentimiento.', 400, null, 'BAD_REQUEST');
  }

  const previousStatus = consent.status;
  const now = nowIso();
  consent.status = CONSENT_STATUSES.REVOKED;
  consent.revokedAt = now;
  consent.rejectedAt = null;
  consent.acceptedAt = consent.acceptedAt || null;
  consent.revocationReason = revocationReason;
  consent.expiresAt = null;
  consent.updatedAt = now;
  database.persistCollection('consents');

  createConsentAuditLog({
    consentId: consent.id,
    action: CONSENT_AUDIT_ACTIONS.CONSENT_REVOKED,
    performedByUserId: currentUser.id,
    previousStatus,
    newStatus: consent.status,
    metadata: {
      reason: revocationReason,
      legalTextVersionId: consent.legalTextVersionId,
    },
    createdAt: now,
  });

  return buildConsentSummary(consent);
}

function expireConsent(consentId, currentUser = null, metadata = {}) {
  const consent = findConsentById(consentId);
  if (!consent) {
    throw new AppError('Consentimiento no encontrado.', 404, null, 'NOT_FOUND');
  }

  if (currentUser && !canManageLegalTextVersions(currentUser) && !canManageConsentRequest(currentUser, consent.studentId, consent.centerId)) {
    throw new AppError('No tienes permiso para caducar este consentimiento.', 403, null, 'FORBIDDEN');
  }

  const previousStatus = consent.status;
  const now = nowIso();
  consent.status = CONSENT_STATUSES.EXPIRED;
  consent.expiresAt = now;
  consent.updatedAt = now;
  database.persistCollection('consents');

  createConsentAuditLog({
    consentId: consent.id,
    action: CONSENT_AUDIT_ACTIONS.CONSENT_EXPIRED,
    performedByUserId: currentUser?.id || null,
    previousStatus,
    newStatus: consent.status,
    metadata,
    createdAt: now,
  });

  return buildConsentSummary(consent);
}

function hasValidConsent(studentId) {
  const student = findStudentById(studentId);
  if (!student) {
    return { hasValidConsent: false, reason: 'STUDENT_NOT_FOUND' };
  }

  if (!student.isActive) {
    return { hasValidConsent: false, reason: 'STUDENT_INACTIVE' };
  }

  const familyUser = findFamilyForStudent(student.id);
  const studentConsents = getConsentCollection().filter((consent) => consent.studentId === student.id);
  if (!familyUser || studentConsents.length === 0) {
    return { hasValidConsent: false, reason: 'NO_CONSENT_FOUND' };
  }

  const activeVersion = getActiveLegalTextVersion();
  if (!activeVersion) {
    return { hasValidConsent: false, reason: 'CONSENT_EXPIRED' };
  }

  const consentForActiveVersion = studentConsents
    .filter((consent) => consent.familyUserId === familyUser.id && consent.legalTextVersionId === activeVersion.id)
    .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')))[0] || null;

  if (consentForActiveVersion) {
    if (consentForActiveVersion.status === CONSENT_STATUSES.ACCEPTED) {
      return {
        hasValidConsent: true,
        consentId: consentForActiveVersion.id,
        status: consentForActiveVersion.status,
        legalTextVersionId: consentForActiveVersion.legalTextVersionId,
        acceptedAt: consentForActiveVersion.acceptedAt,
      };
    }

    if (consentForActiveVersion.status === CONSENT_STATUSES.PENDING) {
      return { hasValidConsent: false, reason: 'NO_ACCEPTED_CONSENT' };
    }

    return {
      hasValidConsent: false,
      reason: `CONSENT_${consentForActiveVersion.status}`,
    };
  }

  const acceptedOlderConsent = studentConsents.find((consent) => consent.status === CONSENT_STATUSES.ACCEPTED);
  if (acceptedOlderConsent) {
    return {
      hasValidConsent: false,
      reason: 'CONSENT_EXPIRED',
    };
  }

  const latestConsent = studentConsents
    .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')))[0];

  if (!latestConsent) {
    return { hasValidConsent: false, reason: 'NO_CONSENT_FOUND' };
  }

  switch (latestConsent.status) {
    case CONSENT_STATUSES.PENDING:
      return { hasValidConsent: false, reason: 'NO_ACCEPTED_CONSENT' };
    case CONSENT_STATUSES.REJECTED:
      return { hasValidConsent: false, reason: 'CONSENT_REJECTED' };
    case CONSENT_STATUSES.REVOKED:
      return { hasValidConsent: false, reason: 'CONSENT_REVOKED' };
    case CONSENT_STATUSES.EXPIRED:
      return { hasValidConsent: false, reason: 'CONSENT_EXPIRED' };
    default:
      return { hasValidConsent: false, reason: 'NO_CONSENT_FOUND' };
  }
}

function getConsentStatusValue(studentId, currentUser, { audit = true } = {}) {
  if (!canViewStudentConsentStatus(currentUser, studentId)) {
    throw new AppError('No tienes permiso para consultar este estudiante.', 403, null, 'FORBIDDEN');
  }

  const student = findStudentById(studentId);
  if (!student) {
    throw new AppError('Estudiante no encontrado.', 404, null, 'NOT_FOUND');
  }

  const familyUser = findFamilyForStudent(student.id);
  const activeLegalTextVersion = getActiveLegalTextVersion();
  const consents = getConsentCollection()
    .filter((consent) => consent.studentId === student.id)
    .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
  const latestConsent = consents[0] || null;
  const validity = hasValidConsent(student.id);

  if (latestConsent && audit) {
    createConsentAuditLog({
      consentId: latestConsent.id,
      action: CONSENT_AUDIT_ACTIONS.CONSENT_VIEWED,
      performedByUserId: currentUser.id,
      previousStatus: latestConsent.status,
      newStatus: latestConsent.status,
      metadata: {
        studentId: student.id,
        reason: 'STUDENT_STATUS_VIEW',
      },
      createdAt: nowIso(),
    });
  }

  return {
    student: safeUser(student),
    familyUser: safeUser(familyUser),
    activeLegalTextVersion: buildLegalTextVersionSummary(activeLegalTextVersion),
    consent: buildConsentSummary(latestConsent),
    ...validity,
  };
}

function getConsentById(consentId, currentUser, { audit = true } = {}) {
  const consent = findConsentById(consentId);
  if (!consent) {
    throw new AppError('Consentimiento no encontrado.', 404, null, 'NOT_FOUND');
  }

  assertConsentPermission(consent, currentUser);

  if (audit) createConsentAuditLog({
    consentId: consent.id,
    action: CONSENT_AUDIT_ACTIONS.CONSENT_VIEWED,
    performedByUserId: currentUser.id,
    previousStatus: consent.status,
    newStatus: consent.status,
    metadata: {
      studentId: consent.studentId,
      familyUserId: consent.familyUserId,
      centerId: consent.centerId,
    },
    createdAt: nowIso(),
  });

  return buildConsentSummary(consent);
}

function getConsentAudit(consentId, currentUser) {
  const consent = findConsentById(consentId);
  if (!consent) {
    throw new AppError('Consentimiento no encontrado.', 404, null, 'NOT_FOUND');
  }

  if (!canManageLegalTextVersions(currentUser) && !canViewConsent(currentUser, consent)) {
    throw new AppError('No tienes permiso para consultar la auditoria.', 403, null, 'FORBIDDEN');
  }

  return getConsentAuditCollection()
    .filter((log) => String(log.consentId || '') === consent.id)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    .map(buildConsentAuditSummary);
}

module.exports = {
  createConsentRequest,
  getConsents,
  getConsentById,
  acceptConsent,
  rejectConsent,
  revokeConsent,
  expireConsent,
  hasValidConsent,
  getConsentStatusValue,
  getActiveLegalTextVersion,
  createLegalTextVersion,
  activateLegalTextVersion,
  deactivateLegalTextVersion,
  getLegalTextVersions,
  createConsentAuditLog,
  getConsentAudit,
  buildConsentSummary,
  buildLegalTextVersionSummary,
  buildConsentAuditSummary,
};
