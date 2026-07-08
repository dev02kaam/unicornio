const { database } = require('../config/database');
const { sanitizeUser } = require('../models/user.model');
const { CONSENT_STATUSES } = require('./constants');

function getUsers() {
  return database.getUsers() || [];
}

function findStudentById(studentId) {
  return getUsers().find((user) => user.id === String(studentId) && String(user.role || '').toUpperCase() === 'STUDENT') || null;
}

function findFamilyForStudent(studentId) {
  return getUsers().find((user) => (
    user.isActive
    && String(user.role || '').toUpperCase() === 'FAMILY'
    && String(user.linkedStudentId || '') === String(studentId)
  )) || null;
}

function isAdmin(user) {
  return String(user?.role || '').toUpperCase() === 'ADMIN';
}

function isSchool(user) {
  return String(user?.role || '').toUpperCase() === 'SCHOOL';
}

function isProfessional(user) {
  return String(user?.role || '').toUpperCase() === 'PROFESSIONAL';
}

function isFamily(user) {
  return String(user?.role || '').toUpperCase() === 'FAMILY';
}

function isStudent(user) {
  return String(user?.role || '').toUpperCase() === 'STUDENT';
}

function canViewConsent(user, consent) {
  if (!user || !consent) {
    return false;
  }

  if (isAdmin(user)) {
    return true;
  }

  if (isFamily(user) && consent.familyUserId === user.id) {
    return true;
  }

  if (isStudent(user) && consent.studentId === user.id) {
    return true;
  }

  const centerId = String(consent.centerId || '');
  const role = String(user?.role || '').toUpperCase();
  if (
    centerId
    && (
      ((role === 'SCHOOL' || role === 'TEACHER' || role === 'PROFESSIONAL') && String(user.schoolId || '') === centerId)
      || user.id === consent.requestedByUserId
    )
  ) {
    return true;
  }

  return false;
}

function canManageConsentRequest(user, studentId, centerId) {
  if (!user || !studentId || !centerId) {
    return false;
  }

  if (isAdmin(user)) {
    return true;
  }

  if (isSchool(user)) {
    return String(user.schoolId || '') === String(centerId);
  }

  return false;
}

function canFamilyActOnConsent(user, consent) {
  if (!isFamily(user) || !consent) {
    return false;
  }

  return consent.familyUserId === user.id && String(user.linkedStudentId || '') === String(consent.studentId);
}

function canViewStudentConsentStatus(user, studentId) {
  if (!user || !studentId) {
    return false;
  }

  if (isAdmin(user)) {
    return true;
  }

  const student = findStudentById(studentId);
  if (!student) {
    return false;
  }

  if (isStudent(user) && user.id === student.id) {
    return true;
  }

  if (isFamily(user) && String(user.linkedStudentId || '') === student.id) {
    return true;
  }

  if ((isSchool(user) || isProfessional(user)) && String(user.schoolId || '') === String(student.schoolId || '')) {
    return true;
  }

  return false;
}

function canManageLegalTextVersions(user) {
  return isAdmin(user);
}

function getConsentStatusLabel(status) {
  return {
    [CONSENT_STATUSES.PENDING]: 'Pendiente',
    [CONSENT_STATUSES.ACCEPTED]: 'Aceptado',
    [CONSENT_STATUSES.REJECTED]: 'Rechazado',
    [CONSENT_STATUSES.REVOKED]: 'Revocado',
    [CONSENT_STATUSES.EXPIRED]: 'Caducado',
  }[status] || status;
}

function safeUser(user) {
  return user ? sanitizeUser(user) : null;
}

module.exports = {
  findStudentById,
  findFamilyForStudent,
  canViewConsent,
  canManageConsentRequest,
  canFamilyActOnConsent,
  canViewStudentConsentStatus,
  canManageLegalTextVersions,
  getConsentStatusLabel,
  safeUser,
};
