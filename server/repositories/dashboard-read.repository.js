const { randomUUID } = require('node:crypto');
const { database } = require('../config/database');
const { canViewConsent } = require('../utils/consents.helpers');

// These reads bridge the synchronous organization services to the relational
// production schema. Each request owns its data; nothing is cached globally.
const queries = {
  users: `select public_id as id, name, email, role, status = 'ACTIVE' as "isActive",
    birth_date::text as "birthDate", age_range as "ageRange",
    unicorn_gender as "unicornGender", created_at as "createdAt", updated_at as "updatedAt"
    from unicornio_users`,
  academicYears: `select public_id as id, name as label, starts_on::text as "startDate",
    ends_on::text as "endDate", status = 'ACTIVE' as "isCurrent",
    status <> 'CLOSED' as "isActive" from unicornio_academic_years`,
  centers: `select c.public_id as id, c.name, c.code, c.type, c.city,
    y.public_id as "academicYearId", c.support_contact as "questionnaireSupportContact",
    c.status = 'ACTIVE' as "isActive", c.created_at as "createdAt", c.updated_at as "updatedAt"
    from unicornio_centers c left join unicornio_academic_years y on y.id = c.academic_year_id`,
  groups: `select g.public_id as id, c.public_id as "centerId", y.public_id as "academicYearId",
    g.name, g.code, g.stage, g.course, g.shift, g.status = 'ACTIVE' as "isActive",
    g.created_at as "createdAt", g.updated_at as "updatedAt"
    from unicornio_groups g join unicornio_centers c on c.id = g.center_id
    left join unicornio_academic_years y on y.id = g.academic_year_id`,
  userCenterAssignments: `select a.id, u.public_id as "userId", c.public_id as "centerId",
    case a.role when 'CENTER_MANAGER' then 'RESPONSABLE_CENTRO'
      when 'TEACHER' then 'PROFESOR' when 'STUDENT' then 'ALUMNO' else a.role end as role,
    a.is_primary as "isPrimary", a.active_from <= now()
      and (a.active_until is null or a.active_until > now()) as "isActive",
    a.created_at as "createdAt"
    from unicornio_center_assignments a join unicornio_users u on u.id = a.user_id
    join unicornio_centers c on c.id = a.center_id order by a.is_primary desc, a.created_at`,
  userGroupAssignments: `select a.id, u.public_id as "userId", g.public_id as "groupId",
    case a.role when 'TEACHER' then 'PROFESOR' when 'STUDENT' then 'ALUMNO' else a.role end as role,
    a.is_primary as "isPrimary", a.active_from <= now()
      and (a.active_until is null or a.active_until > now()) as "isActive",
    a.created_at as "createdAt"
    from unicornio_group_assignments a join unicornio_users u on u.id = a.user_id
    join unicornio_groups g on g.id = a.group_id order by a.is_primary desc, a.created_at`,
  familyLinks: `select f.public_id as "familyUserId", s.public_id as "studentId"
    from unicornio_family_links l join unicornio_users f on f.id = l.family_user_id
    join unicornio_users s on s.id = l.student_user_id
    where l.active_from <= now() and (l.active_until is null or l.active_until > now())
    order by l.created_at`,
  legalTextVersions: `select id, version, title, content, is_active as "isActive",
    effective_from::text as "effectiveFrom", effective_to::text as "effectiveTo",
    created_at as "createdAt", updated_at as "updatedAt" from unicornio_legal_text_versions`,
  consents: `select r.public_id::text as id, s.public_id as "studentId", f.public_id as "familyUserId",
    c.public_id as "centerId", r.legal_version_id as "legalTextVersionId", r.campaign_id as "campaignId",
    r.status, actor.public_id as "requestedByUserId",
    case when r.status = 'ACCEPTED' then r.decided_at end as "acceptedAt",
    case when r.status = 'REJECTED' then r.decided_at end as "rejectedAt",
    case when r.status = 'REVOKED' then r.decided_at end as "revokedAt",
    r.expires_at as "expiresAt", null::text as "revocationReason",
    r.created_at as "createdAt", r.updated_at as "updatedAt"
    from unicornio_consents r join unicornio_users s on s.id = r.student_user_id
    join unicornio_users f on f.id = r.family_user_id
    join unicornio_users actor on actor.id = r.requested_by_user_id
    join unicornio_centers c on c.id = r.center_id`,
  // Existing campaigns still reference these records. Translate their legacy
  // foreign keys without reading or writing the old JSON collections.
  legacyConsents: `select r.id, s.public_id as "studentId", f.public_id as "familyUserId",
    c.public_id as "centerId", r.legal_text_version_id as "legalTextVersionId", r.campaign_id as "campaignId",
    r.status, actor.public_id as "requestedByUserId", r.accepted_at as "acceptedAt",
    r.rejected_at as "rejectedAt", r.revoked_at as "revokedAt", r.expires_at as "expiresAt",
    r.revocation_reason as "revocationReason", r.created_at as "createdAt", r.updated_at as "updatedAt"
    from unicornio_consent_records r
    join unicornio_users s on r.student_id in (s.legacy_id, s.public_id::text)
    join unicornio_users f on r.family_user_id in (f.legacy_id, f.public_id::text)
    join unicornio_centers c on r.center_id in (c.legacy_id, c.public_id::text)
    left join unicornio_users actor on r.requested_by_user_id in (actor.legacy_id, actor.public_id::text)
    where not exists (select 1 from unicornio_consents current_consent
      where current_consent.student_user_id = s.id and current_consent.family_user_id = f.id
        and current_consent.center_id = c.id and current_consent.legal_version_id = r.legal_text_version_id
        and current_consent.campaign_id is not distinct from r.campaign_id)`,
  consentAuditLogs: `select a.id, a.consent_id as "consentId", a.action,
    u.public_id as "performedByUserId", a.previous_status as "previousStatus",
    a.new_status as "newStatus", a.metadata, a.created_at as "createdAt"
    from unicornio_consent_audit_logs a
    left join unicornio_users u on a.performed_by_user_id in (u.legacy_id, u.public_id::text)`,
};

function normalizeRows(rows) {
  return rows.map((row) => Object.fromEntries(Object.entries(row)
    .map(([key, value]) => [key, value instanceof Date ? value.toISOString() : value])));
}

async function loadDashboardReadCollections(currentUser, executor = database) {
  const collections = {};
  // Use one transaction/connection, including the authenticated RLS identity.
  for (const [name, sql] of Object.entries(queries)) {
    collections[name] = normalizeRows((await executor.query(sql)).rows);
  }
  for (const user of collections.users) {
    user.schoolId = collections.userCenterAssignments
      .find((a) => a.userId === user.id && a.isActive)?.centerId || null;
    user.groupId = collections.userGroupAssignments
      .find((a) => a.userId === user.id && a.isActive)?.groupId || null;
    user.linkedStudentId = collections.familyLinks
      .find((link) => link.familyUserId === user.id)?.studentId || null;
  }
  const actor = collections.users.find((user) => user.id === currentUser.id) || currentUser;
  collections.consents.push(...collections.legacyConsents);
  // Legacy consent records have no RLS. Apply the existing per-student scope
  // even when the database role owns those tables.
  database.runWithReadCollections(collections, () => {
    collections.consents = collections.consents.filter((consent) => canViewConsent(actor, consent));
  });
  const consentIds = new Set(collections.consents.map((consent) => consent.id));
  collections.consentAuditLogs = collections.consentAuditLogs.filter((log) => consentIds.has(log.consentId));
  delete collections.familyLinks;
  delete collections.legacyConsents;
  return collections;
}

async function recordConsentView(consent, user, reason = null) {
  if (!consent) return;
  await database.query(
    `insert into unicornio_consent_audit_logs
      (id, consent_id, action, performed_by_user_id, previous_status, new_status, metadata, created_at)
     values ($1, $2, 'CONSENT_VIEWED', $3, $4, $4, $5::jsonb, now())`,
    [randomUUID(), consent.id, user.id, consent.status, JSON.stringify({
      studentId: consent.studentId, familyUserId: consent.familyUserId, centerId: consent.centerId, reason,
    })],
  );
}

module.exports = { loadDashboardReadCollections, recordConsentView };
