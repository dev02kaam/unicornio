const { database } = require('../config/database');
const { AppError } = require('../utils/errors');
const { loadDashboardReadCollections } = require('./dashboard-read.repository');

const referenceFields = new Set([
  'id', 'userId', 'studentId', 'familyUserId', 'linkedStudentId', 'schoolId',
  'centerId', 'groupId', 'academicYearId', 'createdByUserId', 'requestedByUserId',
  'performedByUserId', 'recipientUserId', 'ownerProfessionalId', 'targetProfessionalId',
]);

function mapReferences(value, identities, field = '') {
  if (Array.isArray(value)) return value.map((item) => mapReferences(item, identities, field));
  if (value instanceof Date) return value;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, mapReferences(item, identities, key)]));
  }
  return referenceFields.has(field) && typeof value === 'string' ? identities.get(value) || value : value;
}

async function loadQuestionnaireContext(user, executor) {
  const aliases = await executor.query(`
    select public_id::text as public_id, coalesce(legacy_id, public_id::text) as storage_id from unicornio_users
    union all select public_id::text, coalesce(legacy_id, public_id::text) from unicornio_centers
    union all select public_id::text, coalesce(legacy_id, public_id::text) from unicornio_groups
    union all select public_id::text, coalesce(legacy_id, public_id::text) from unicornio_academic_years
  `);
  const toStorage = new Map(aliases.rows.map((row) => [row.public_id, row.storage_id]));
  const toPublic = new Map(aliases.rows.map((row) => [row.storage_id, row.public_id]));
  const publicCollections = await loadDashboardReadCollections(user, executor);
  return { collections: mapReferences(publicCollections, toStorage), toStorage, toPublic };
}

async function persistConsentChanges(changes) {
  const consents = database.getCollection('consents');
  const logs = database.getCollection('consentAuditLogs');
  await database.transaction(async (client) => {
    if (changes.dirty.has('consents')) {
      for (const consent of consents) {
        const previous = changes.previous.consents.find((item) => item.id === consent.id);
        if (JSON.stringify(previous) === JSON.stringify(consent)) continue;
        if (!previous) {
          await client.query(`insert into unicornio_consent_records
            (id, student_id, family_user_id, center_id, legal_text_version_id, campaign_id,
             status, requested_by_user_id, expires_at, created_at, updated_at)
            values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [
            consent.id, consent.studentId, consent.familyUserId, consent.centerId,
            consent.legalTextVersionId, consent.campaignId, consent.status,
            consent.requestedByUserId, consent.expiresAt, consent.createdAt, consent.updatedAt,
          ]);
        } else {
          const result = await client.query(`update unicornio_consent_records
            set status=$2, accepted_at=$3, rejected_at=$4, revoked_at=$5, expires_at=$6,
                revocation_reason=$7, updated_at=$8
            where id=$1 and status=$9 and updated_at=$10`, [
            consent.id, consent.status, consent.acceptedAt, consent.rejectedAt, consent.revokedAt,
            consent.expiresAt, consent.revocationReason, consent.updatedAt, previous.status, previous.updatedAt,
          ]);
          if (result.rowCount !== 1) {
            throw new AppError('El consentimiento ha cambiado. Recarga la página e inténtalo de nuevo.', 409);
          }
        }
      }
    }
    if (changes.dirty.has('consentAuditLogs')) {
      const previousIds = new Set(changes.previous.consentAuditLogs.map((log) => log.id));
      for (const log of logs.filter((item) => !previousIds.has(item.id))) {
        await client.query(`insert into unicornio_consent_audit_logs
          (id, consent_id, action, performed_by_user_id, previous_status, new_status, metadata, created_at)
          values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)`, [
          log.id, log.consentId, log.action, log.performedByUserId, log.previousStatus,
          log.newStatus, JSON.stringify(log.metadata), log.createdAt,
        ]);
      }
    }
  });
}

async function mutateProductionConsent(callback) {
  const changes = database.captureConsentChanges(callback);
  await persistConsentChanges(changes);
  if (changes.error) throw changes.error;
  return changes.result;
}

module.exports = { loadQuestionnaireContext, mapReferences, mutateProductionConsent };
