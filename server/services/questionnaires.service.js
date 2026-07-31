const crypto = require('crypto');
const { database } = require('../config/database');
const { env } = require('../config/env');
const { AppError } = require('../utils/errors');
const {
  findGroupById,
  getGroupUsers,
  getUserGroupAssignments,
} = require('../utils/organization.helpers');
const {
  findStudentById,
  findFamilyForStudent,
} = require('../utils/consents.helpers');
const {
  createConsentRequest,
  getActiveLegalTextVersion,
} = require('./consents.service');
const { findUserById } = require('./users.service');
const { depressiveMoodVersions } = require('../data/questionnaires/depressiveMood');
const {
  encryptQuestionnairePayload,
  decryptQuestionnairePayload,
} = require('./questionnaire-crypto.service');
const { evaluateQuestionnaire } = require('./questionnaire-scoring.service');

const COMPLETION_MESSAGES = Object.freeze({
  SUPPORT_1: 'Gracias por contarnos cómo te has sentido. Tus respuestas se han guardado y una persona profesional podrá revisarlas contigo.',
  SUPPORT_2: 'Has terminado. Hablar de cómo te sientes es una forma de cuidarte; si algo te preocupa, puedes pedir ayuda en cualquier momento.',
  SUPPORT_3: 'Gracias por compartirlo con sinceridad. No tienes que gestionar lo que sientes sin apoyo; hay personas preparadas para acompañarte.',
});

const COMPLETION_MESSAGE_KEYS = Object.keys(COMPLETION_MESSAGES);

function getQuestionnairePreview(ageRange) {
  if (!env.questionnairePreviewEnabled) {
    throw new AppError(
      'El modo de prueba funcional no está disponible en este entorno.',
      404,
      null,
      'QUESTIONNAIRE_PREVIEW_DISABLED',
    );
  }

  const normalizedRange = String(ageRange || '').trim();
  const definition = depressiveMoodVersions.find(
    (item) => `${item.ageMin}-${item.ageMax}` === normalizedRange,
  );
  if (!definition) {
    throw new AppError(
      'Selecciona el cuestionario de 9–12 o de 13–16 años.',
      400,
      null,
      'QUESTIONNAIRE_PREVIEW_RANGE_INVALID',
    );
  }

  return {
    id: definition.id,
    title: definition.title,
    shortTitle: definition.shortTitle,
    ageMin: definition.ageMin,
    ageMax: definition.ageMax,
    ageRange: normalizedRange,
    instructions: definition.instructions,
    responseScale: definition.responseScale.map(({ value, label }) => ({ value, label })),
    questions: definition.questions.map((question) => ({ ...question })),
    status: 'FUNCTIONAL_PREVIEW',
  };
}

function newId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function nowIso() {
  return new Date().toISOString();
}

function ensureQuestionnairePilotAvailable() {
  if (!env.questionnairePilotEnabled) {
    throw new AppError(
      'El piloto de cuestionarios está desactivado. Activa QUESTIONNAIRE_PILOT_ENABLED solo en un entorno supervisado.',
      503,
      null,
      'QUESTIONNAIRE_PILOT_DISABLED',
    );
  }

  if (!database.isPostgres()) {
    throw new AppError(
      'El piloto de cuestionarios requiere PostgreSQL.',
      503,
      null,
      'QUESTIONNAIRE_POSTGRES_REQUIRED',
    );
  }

  if (Buffer.from(env.questionnaireDataKey || '', 'base64').length !== 32) {
    throw new AppError(
      'Falta una QUESTIONNAIRE_DATA_KEY válida para proteger las respuestas.',
      503,
      null,
      'QUESTIONNAIRE_KEY_REQUIRED',
    );
  }
}

function assertRole(user, roles) {
  const allowed = Array.isArray(roles) ? roles : [roles];
  if (!user || !allowed.includes(String(user.role || '').toUpperCase())) {
    throw new AppError('No autorizado para esta operación.', 403, null, 'FORBIDDEN');
  }
}

function assertProfessionalGroupAccess(user, groupId) {
  assertRole(user, 'PROFESSIONAL');
  const hasDirectAssignment = getUserGroupAssignments(user.id)
    .some((assignment) => assignment.groupId === String(groupId));
  if (!hasDirectAssignment) {
    throw new AppError('El profesional no está asignado a este grupo.', 403, null, 'FORBIDDEN');
  }
}

function calculateAge(birthDate, atDate = new Date()) {
  const birth = new Date(`${birthDate}T00:00:00.000Z`);
  if (Number.isNaN(birth.getTime())) {
    return null;
  }

  const at = new Date(atDate);
  let age = at.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday = (
    at.getUTCMonth() < birth.getUTCMonth()
    || (at.getUTCMonth() === birth.getUTCMonth() && at.getUTCDate() < birth.getUTCDate())
  );
  if (beforeBirthday) {
    age -= 1;
  }
  return age;
}

function calculateDefinitionHash(definition) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify({
      responseScale: definition.responseScale,
      questions: definition.questions,
      scoringRules: definition.scoringRules,
    }))
    .digest('hex');
}

function mapDefinitionRow(row, { includeScoring = true } = {}) {
  if (!row) {
    return null;
  }

  const definition = {
    id: row.id,
    familyKey: row.family_key,
    version: row.version,
    title: row.title,
    shortTitle: row.short_title,
    ageMin: row.age_min,
    ageMax: row.age_max,
    instructions: row.instructions,
    responseScale: row.response_scale,
    questions: row.questions,
    sourceDocument: row.source_document,
    sourceHash: row.source_hash,
    status: row.status,
    publishedAt: row.published_at,
  };

  if (includeScoring) {
    definition.scoringRules = row.scoring_rules;
  }
  return definition;
}

function mapCampaignRow(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    familyKey: row.family_key,
    centerId: row.center_id,
    groupId: row.group_id,
    createdByUserId: row.created_by_user_id,
    legalTextVersionId: row.legal_text_version_id,
    title: row.title,
    status: row.status,
    plannedFor: row.planned_for,
    liveStartedAt: row.live_started_at,
    liveExpiresAt: row.live_expires_at,
    closedAt: row.closed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function publicCampaign(campaign) {
  const group = findGroupById(campaign.groupId);
  return {
    ...campaign,
    group: group ? {
      id: group.id,
      name: group.name,
      centerId: group.centerId,
      course: group.course,
    } : null,
  };
}

async function initializeQuestionnaireModule() {
  if (!database.isPostgres()) {
    return;
  }

  for (const definition of depressiveMoodVersions) {
    const sourceHash = calculateDefinitionHash(definition);
    await database.query(
      `insert into unicornio_questionnaire_versions (
        id, family_key, version, title, short_title, age_min, age_max, instructions,
        response_scale, questions, scoring_rules, source_document, source_hash, status, published_at
      ) values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11::jsonb, $12, $13, $14, now()
      )
      on conflict (id) do update set
        title = excluded.title,
        short_title = excluded.short_title,
        instructions = excluded.instructions,
        response_scale = excluded.response_scale,
        questions = excluded.questions,
        scoring_rules = excluded.scoring_rules,
        source_hash = excluded.source_hash,
        status = excluded.status`,
      [
        definition.id,
        definition.familyKey,
        definition.version,
        definition.title,
        definition.shortTitle,
        definition.ageMin,
        definition.ageMax,
        definition.instructions,
        JSON.stringify(definition.responseScale),
        JSON.stringify(definition.questions),
        JSON.stringify(definition.scoringRules),
        definition.sourceDocument,
        sourceHash,
        definition.status,
      ],
    );
  }
}

async function listQuestionnaireDefinitions(currentUser) {
  ensureQuestionnairePilotAvailable();
  assertRole(currentUser, ['PROFESSIONAL', 'ADMIN', 'SCHOOL']);
  const result = await database.query(
    `select * from unicornio_questionnaire_versions
     where status = 'EXPERIMENTAL'
     order by family_key, age_min`,
  );
  return result.rows.map((row) => mapDefinitionRow(row, { includeScoring: false }));
}

async function getDefinitionById(definitionId, executor = database) {
  const result = await executor.query(
    'select * from unicornio_questionnaire_versions where id = $1',
    [definitionId],
  );
  const definition = mapDefinitionRow(result.rows[0]);
  if (!definition) {
    throw new AppError('Versión de cuestionario no encontrada.', 404, null, 'NOT_FOUND');
  }
  return definition;
}

async function getCampaignById(campaignId, executor = database) {
  const result = await executor.query(
    'select * from unicornio_questionnaire_campaigns where id = $1',
    [campaignId],
  );
  const campaign = mapCampaignRow(result.rows[0]);
  if (!campaign) {
    throw new AppError('Campaña no encontrada.', 404, null, 'NOT_FOUND');
  }
  return campaign;
}

function assertCampaignOwner(campaign, currentUser) {
  assertRole(currentUser, 'PROFESSIONAL');
  if (campaign.createdByUserId !== currentUser.id) {
    throw new AppError('Solo el profesional responsable puede gestionar esta campaña.', 403, null, 'FORBIDDEN');
  }
  assertProfessionalGroupAccess(currentUser, campaign.groupId);
}

async function createCampaign(data, currentUser) {
  ensureQuestionnairePilotAvailable();
  const groupId = String(data.groupId || '').trim();
  const group = findGroupById(groupId);
  if (!group || !group.isActive) {
    throw new AppError('Grupo no encontrado o inactivo.', 404, null, 'NOT_FOUND');
  }
  assertProfessionalGroupAccess(currentUser, groupId);

  const title = String(data.title || 'Sesión de estado de ánimo').trim();
  const plannedFor = data.plannedFor ? new Date(data.plannedFor) : new Date();
  if (!title || Number.isNaN(plannedFor.getTime())) {
    throw new AppError('Indica un título y una fecha válidos.', 400, null, 'BAD_REQUEST');
  }

  const id = newId('campaign');
  const now = nowIso();
  const result = await database.query(
    `insert into unicornio_questionnaire_campaigns (
      id, family_key, center_id, group_id, created_by_user_id, title, status,
      planned_for, created_at, updated_at
    ) values ($1, 'depressive-mood', $2, $3, $4, $5, 'DRAFT', $6, $7, $7)
    returning *`,
    [id, group.centerId, group.id, currentUser.id, title, plannedFor.toISOString(), now],
  );

  await writeAudit(currentUser.id, 'CAMPAIGN_CREATED', 'CAMPAIGN', id, {
    groupId: group.id,
    centerId: group.centerId,
  });
  return publicCampaign(mapCampaignRow(result.rows[0]));
}

async function listCampaigns(currentUser) {
  ensureQuestionnairePilotAvailable();
  assertRole(currentUser, ['PROFESSIONAL', 'ADMIN', 'SCHOOL']);
  const role = String(currentUser.role || '').toUpperCase();
  let result;

  if (role === 'PROFESSIONAL') {
    result = await database.query(
      `select * from unicornio_questionnaire_campaigns
       where created_by_user_id = $1 order by created_at desc`,
      [currentUser.id],
    );
  } else if (role === 'SCHOOL') {
    result = await database.query(
      `select * from unicornio_questionnaire_campaigns
       where center_id = $1 order by created_at desc`,
      [currentUser.schoolId],
    );
  } else {
    result = await database.query(
      'select * from unicornio_questionnaire_campaigns order by created_at desc',
    );
  }

  return result.rows.map((row) => publicCampaign(mapCampaignRow(row)));
}

function selectDefinitionForStudent(student, atDate) {
  const age = calculateAge(student.birthDate, atDate);
  const definition = depressiveMoodVersions.find(
    (item) => age !== null && age >= item.ageMin && age <= item.ageMax,
  ) || null;
  return { age, definition };
}

async function requestCampaignConsents(campaignId, currentUser) {
  ensureQuestionnairePilotAvailable();
  const campaign = await getCampaignById(campaignId);
  assertCampaignOwner(campaign, currentUser);
  if (!['DRAFT', 'CONSENT_PENDING', 'READY'].includes(campaign.status)) {
    throw new AppError('No se pueden solicitar consentimientos en el estado actual.', 409, null, 'CONFLICT');
  }

  const legalTextVersion = getActiveLegalTextVersion();
  if (!legalTextVersion) {
    throw new AppError('No existe una versión legal activa.', 409, null, 'NO_ACTIVE_LEGAL_TEXT');
  }

  const groupStudents = getGroupUsers(campaign.groupId)
    .map((entry) => entry.user)
    .filter((user) => user.isActive && String(user.role || '').toUpperCase() === 'STUDENT');
  if (groupStudents.length === 0) {
    throw new AppError('El grupo no tiene alumnos activos.', 409, null, 'EMPTY_GROUP');
  }

  const participantRows = [];
  for (const student of groupStudents) {
    const family = findFamilyForStudent(student.id);
    const { age, definition } = selectDefinitionForStudent(student, campaign.plannedFor || new Date());
    const row = {
      id: newId('participant'),
      studentId: student.id,
      familyUserId: family?.id || null,
      questionnaireVersionId: definition?.id || null,
      consentId: null,
      status: 'AWAITING_CONSENT',
      ineligibleReason: null,
    };

    if (!definition) {
      row.status = 'INELIGIBLE';
      row.ineligibleReason = age === null ? 'MISSING_BIRTH_DATE' : 'AGE_OUT_OF_RANGE';
    } else if (!family) {
      row.status = 'INELIGIBLE';
      row.ineligibleReason = 'NO_LINKED_FAMILY';
    } else {
      const consent = createConsentRequest({
        studentId: student.id,
        familyUserId: family.id,
        legalTextVersionId: legalTextVersion.id,
        centerId: campaign.centerId,
        campaignId: campaign.id,
      }, currentUser, { allowProfessionalCampaign: true });
      row.consentId = consent.id;
      row.status = consent.status === 'ACCEPTED' ? 'AVAILABLE' : 'AWAITING_CONSENT';
    }
    participantRows.push(row);
  }

  await database.flush();
  const now = nowIso();
  await database.transaction(async (client) => {
    for (const participant of participantRows) {
      await client.query(
        `insert into unicornio_questionnaire_participants (
          id, campaign_id, student_id, family_user_id, consent_id,
          questionnaire_version_id, status, ineligible_reason, created_at, updated_at
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
        on conflict (campaign_id, student_id) do update set
          family_user_id = excluded.family_user_id,
          consent_id = excluded.consent_id,
          questionnaire_version_id = excluded.questionnaire_version_id,
          status = case
            when unicornio_questionnaire_participants.status in ('IN_PROGRESS', 'SUBMITTED', 'HELP_REQUESTED')
              then unicornio_questionnaire_participants.status
            else excluded.status
          end,
          ineligible_reason = excluded.ineligible_reason,
          updated_at = excluded.updated_at`,
        [
          participant.id,
          campaign.id,
          participant.studentId,
          participant.familyUserId,
          participant.consentId,
          participant.questionnaireVersionId,
          participant.status,
          participant.ineligibleReason,
          now,
        ],
      );
    }

    const hasAvailable = participantRows.some((item) => item.status === 'AVAILABLE');
    await client.query(
      `update unicornio_questionnaire_campaigns
       set legal_text_version_id = $2, status = $3, updated_at = $4
       where id = $1`,
      [campaign.id, legalTextVersion.id, hasAvailable ? 'READY' : 'CONSENT_PENDING', now],
    );
  });

  await writeAudit(currentUser.id, 'CAMPAIGN_CONSENTS_REQUESTED', 'CAMPAIGN', campaign.id, {
    requested: participantRows.filter((item) => item.consentId).length,
    ineligible: participantRows.filter((item) => item.status === 'INELIGIBLE').length,
  });
  return getCampaignMonitor(campaign.id, currentUser);
}

async function syncParticipantFromConsent(consent) {
  if (!database.isPostgres() || !consent?.campaignId) {
    return null;
  }

  const status = {
    ACCEPTED: 'AVAILABLE',
    PENDING: 'AWAITING_CONSENT',
    REJECTED: 'CANCELLED',
    REVOKED: 'CANCELLED',
    EXPIRED: 'CANCELLED',
  }[consent.status] || 'AWAITING_CONSENT';

  await database.query(
    `update unicornio_questionnaire_participants
     set status = case
       when status in ('SUBMITTED', 'HELP_REQUESTED') then status
       else $2
     end,
     updated_at = now()
     where campaign_id = $1 and student_id = $3`,
    [consent.campaignId, status, consent.studentId],
  );

  await database.query(
    `update unicornio_questionnaire_campaigns c
     set status = case
       when c.status in ('DRAFT', 'CONSENT_PENDING', 'READY') and exists (
         select 1 from unicornio_questionnaire_participants p
         where p.campaign_id = c.id and p.status = 'AVAILABLE'
       ) then 'READY'
       when c.status in ('DRAFT', 'CONSENT_PENDING', 'READY') then 'CONSENT_PENDING'
       else c.status
     end,
     updated_at = now()
     where c.id = $1`,
    [consent.campaignId],
  );
  return status;
}

async function refreshParticipantEligibilityAtSession(campaign, atDate) {
  const participants = await database.query(
    `select p.id, p.student_id, p.status, p.ineligible_reason, c.status as consent_status
     from unicornio_questionnaire_participants p
     left join unicornio_consent_records c on c.id = p.consent_id
     where p.campaign_id = $1`,
    [campaign.id],
  );

  await database.transaction(async (client) => {
    for (const participant of participants.rows) {
      if (['SUBMITTED', 'HELP_REQUESTED'].includes(participant.status)) {
        continue;
      }
      const student = findUserById(participant.student_id);
      const { age, definition } = selectDefinitionForStudent(student || {}, atDate);
      if (!definition) {
        await client.query(
          `update unicornio_questionnaire_participants
           set questionnaire_version_id = null, status = 'INELIGIBLE',
               ineligible_reason = $2, updated_at = now()
           where id = $1`,
          [
            participant.id,
            age === null ? 'MISSING_BIRTH_DATE' : 'AGE_OUT_OF_RANGE',
          ],
        );
        continue;
      }

      const consentStatus = participant.consent_status;
      const status = consentStatus === 'ACCEPTED'
        ? 'AVAILABLE'
        : ['REJECTED', 'REVOKED', 'EXPIRED'].includes(consentStatus)
          ? 'CANCELLED'
          : participant.ineligible_reason === 'NO_LINKED_FAMILY'
            ? 'INELIGIBLE'
            : 'AWAITING_CONSENT';
      await client.query(
        `update unicornio_questionnaire_participants
         set questionnaire_version_id = $2, status = $3,
             ineligible_reason = $4, updated_at = now()
         where id = $1`,
        [
          participant.id,
          definition.id,
          status,
          status === 'INELIGIBLE' ? participant.ineligible_reason : null,
        ],
      );
    }
  });
}

async function openCampaign(campaignId, currentUser) {
  ensureQuestionnairePilotAvailable();
  const campaign = await getCampaignById(campaignId);
  assertCampaignOwner(campaign, currentUser);
  if (campaign.status === 'LIVE') {
    return publicCampaign(campaign);
  }
  if (!['READY', 'CONSENT_PENDING'].includes(campaign.status)) {
    throw new AppError('La campaña no está preparada para abrirse.', 409, null, 'CONFLICT');
  }

  const startedAt = new Date();
  await refreshParticipantEligibilityAtSession(campaign, startedAt);
  const available = await database.query(
    `select count(*)::integer as count
     from unicornio_questionnaire_participants
     where campaign_id = $1 and status = 'AVAILABLE'`,
    [campaign.id],
  );
  if (available.rows[0].count < 1) {
    throw new AppError('Todavía no hay alumnos con consentimiento aceptado.', 409, null, 'NO_ELIGIBLE_PARTICIPANTS');
  }

  const expiresAt = new Date(startedAt.getTime() + env.questionnaireSessionMaxMinutes * 60_000);
  const result = await database.query(
    `update unicornio_questionnaire_campaigns
     set status = 'LIVE', live_started_at = $2, live_expires_at = $3, updated_at = $2
     where id = $1 returning *`,
    [campaign.id, startedAt.toISOString(), expiresAt.toISOString()],
  );
  await writeAudit(currentUser.id, 'CAMPAIGN_OPENED', 'CAMPAIGN', campaign.id, {
    liveExpiresAt: expiresAt.toISOString(),
  });
  return publicCampaign(mapCampaignRow(result.rows[0]));
}

async function closeCampaign(campaignId, currentUser) {
  ensureQuestionnairePilotAvailable();
  const campaign = await getCampaignById(campaignId);
  assertCampaignOwner(campaign, currentUser);
  if (campaign.status === 'CLOSED') {
    return publicCampaign(campaign);
  }
  if (!['LIVE', 'READY', 'CONSENT_PENDING'].includes(campaign.status)) {
    throw new AppError('La campaña ya está cerrada o cancelada.', 409, null, 'CONFLICT');
  }

  const now = nowIso();
  const result = await database.transaction(async (client) => {
    const updated = await client.query(
      `update unicornio_questionnaire_campaigns
       set status = 'CLOSED', closed_at = $2, updated_at = $2
       where id = $1 returning *`,
      [campaign.id, now],
    );
    await client.query(
      `update unicornio_questionnaire_participants
       set status = 'CANCELLED', updated_at = $2
       where campaign_id = $1 and status in ('AVAILABLE', 'IN_PROGRESS')`,
      [campaign.id, now],
    );
    return updated.rows[0];
  });
  await writeAudit(currentUser.id, 'CAMPAIGN_CLOSED', 'CAMPAIGN', campaign.id);
  return publicCampaign(mapCampaignRow(result));
}

async function cancelCampaign(campaignId, currentUser) {
  ensureQuestionnairePilotAvailable();
  const campaign = await getCampaignById(campaignId);
  assertCampaignOwner(campaign, currentUser);
  if (campaign.status === 'CANCELLED') {
    return publicCampaign(campaign);
  }
  if (!['DRAFT', 'CONSENT_PENDING', 'READY'].includes(campaign.status)) {
    throw new AppError(
      'Una sesión abierta debe cerrarse, no cancelarse.',
      409,
      null,
      'CONFLICT',
    );
  }

  const now = nowIso();
  const result = await database.transaction(async (client) => {
    const updated = await client.query(
      `update unicornio_questionnaire_campaigns
       set status = 'CANCELLED', closed_at = $2, updated_at = $2
       where id = $1 returning *`,
      [campaign.id, now],
    );
    await client.query(
      `update unicornio_questionnaire_participants
       set status = 'CANCELLED', updated_at = $2
       where campaign_id = $1 and status not in ('SUBMITTED', 'HELP_REQUESTED')`,
      [campaign.id, now],
    );
    return updated.rows[0];
  });
  await writeAudit(currentUser.id, 'CAMPAIGN_CANCELLED', 'CAMPAIGN', campaign.id);
  return publicCampaign(mapCampaignRow(result));
}

async function getCampaignMonitor(campaignId, currentUser) {
  ensureQuestionnairePilotAvailable();
  const campaign = await getCampaignById(campaignId);
  assertCampaignOwner(campaign, currentUser);

  const participantsResult = await database.query(
    `select p.*, c.status as consent_status
     from unicornio_questionnaire_participants p
     left join unicornio_consent_records c on c.id = p.consent_id
     where p.campaign_id = $1
     order by p.created_at`,
    [campaign.id],
  );
  const participants = participantsResult.rows.map((row) => {
    const student = findUserById(row.student_id);
    return {
      id: row.id,
      student: student ? { id: student.id, name: student.name } : { id: row.student_id, name: 'Alumno no disponible' },
      familyUserId: row.family_user_id,
      consentId: row.consent_id,
      consentStatus: row.consent_status || null,
      questionnaireVersionId: row.questionnaire_version_id,
      status: row.status,
      ineligibleReason: row.ineligible_reason,
      updatedAt: row.updated_at,
    };
  });

  const counts = participants.reduce((summary, participant) => {
    summary[participant.status] = (summary[participant.status] || 0) + 1;
    return summary;
  }, {});
  return {
    campaign: publicCampaign(campaign),
    participants,
    counts,
  };
}

async function listStudentAssignments(currentUser) {
  ensureQuestionnairePilotAvailable();
  assertRole(currentUser, 'STUDENT');
  const result = await database.query(
    `select p.*, c.title as campaign_title, c.status as campaign_status,
            c.live_started_at, c.live_expires_at, c.group_id,
            v.short_title, v.age_min, v.age_max
     from unicornio_questionnaire_participants p
     join unicornio_questionnaire_campaigns c on c.id = p.campaign_id
     left join unicornio_questionnaire_versions v on v.id = p.questionnaire_version_id
     where p.student_id = $1
     order by c.created_at desc`,
    [currentUser.id],
  );

  return result.rows.map((row) => ({
    id: row.id,
    campaignId: row.campaign_id,
    title: row.campaign_title,
    questionnaireTitle: row.short_title,
    campaignStatus: row.campaign_status,
    status: row.status,
    liveStartedAt: row.live_started_at,
    liveExpiresAt: row.live_expires_at,
    ageRange: row.age_min ? `${row.age_min}-${row.age_max}` : null,
  }));
}

async function getAttemptForStudent(attemptId, currentUser, executor = database) {
  const result = await executor.query(
    `select a.*, p.student_id, p.campaign_id, p.questionnaire_version_id,
            p.family_user_id, p.status as participant_status,
            c.created_by_user_id, c.status as campaign_status, c.live_expires_at
     from unicornio_questionnaire_attempts a
     join unicornio_questionnaire_participants p on p.id = a.participant_id
     join unicornio_questionnaire_campaigns c on c.id = p.campaign_id
     where a.id = $1`,
    [attemptId],
  );
  const attempt = result.rows[0];
  if (!attempt) {
    throw new AppError('Intento no encontrado.', 404, null, 'NOT_FOUND');
  }
  if (String(attempt.student_id) !== String(currentUser.id)) {
    throw new AppError('No autorizado para este intento.', 403, null, 'FORBIDDEN');
  }
  return attempt;
}

async function startAttempt(participantId, currentUser) {
  ensureQuestionnairePilotAvailable();
  assertRole(currentUser, 'STUDENT');

  const result = await database.transaction(async (client) => {
    const participantResult = await client.query(
      `select p.*, c.status as campaign_status, c.live_expires_at
       from unicornio_questionnaire_participants p
       join unicornio_questionnaire_campaigns c on c.id = p.campaign_id
       where p.id = $1 for update`,
      [participantId],
    );
    const participant = participantResult.rows[0];
    if (!participant || participant.student_id !== currentUser.id) {
      throw new AppError('Asignación no encontrada.', 404, null, 'NOT_FOUND');
    }
    if (participant.campaign_status !== 'LIVE') {
      throw new AppError('La sesión todavía no está abierta.', 409, null, 'CAMPAIGN_NOT_LIVE');
    }
    if (participant.live_expires_at && new Date(participant.live_expires_at) <= new Date()) {
      throw new AppError('La sesión ha finalizado.', 409, null, 'CAMPAIGN_EXPIRED');
    }
    if (!['AVAILABLE', 'IN_PROGRESS'].includes(participant.status)) {
      throw new AppError('Este cuestionario no está disponible.', 409, null, 'PARTICIPANT_NOT_AVAILABLE');
    }

    const existing = await client.query(
      `select * from unicornio_questionnaire_attempts
       where participant_id = $1 order by attempt_number desc limit 1`,
      [participant.id],
    );
    let attempt = existing.rows[0];
    if (!attempt) {
      const now = nowIso();
      const inserted = await client.query(
        `insert into unicornio_questionnaire_attempts (
          id, participant_id, attempt_number, status, started_at, created_at, updated_at
        ) values ($1, $2, 1, 'IN_PROGRESS', $3, $3, $3) returning *`,
        [newId('attempt'), participant.id, now],
      );
      attempt = inserted.rows[0];
      await client.query(
        `update unicornio_questionnaire_participants
         set status = 'IN_PROGRESS', updated_at = $2 where id = $1`,
        [participant.id, now],
      );
    } else if (attempt.status !== 'IN_PROGRESS') {
      throw new AppError('Este intento ya no se puede continuar.', 409, null, 'ATTEMPT_LOCKED');
    }

    const definition = await getDefinitionById(participant.questionnaire_version_id, client);
    const savedAnswers = await client.query(
      `select question_number, encrypted_payload
       from unicornio_questionnaire_answers where attempt_id = $1 order by question_number`,
      [attempt.id],
    );
    return {
      attempt: {
        id: attempt.id,
        participantId: participant.id,
        status: attempt.status,
        startedAt: attempt.started_at,
      },
      definition: {
        ...definition,
        scoringRules: undefined,
      },
      answers: savedAnswers.rows.map((row) => ({
        questionNumber: row.question_number,
        value: decryptQuestionnairePayload(row.encrypted_payload).value,
      })),
    };
  });

  await writeAudit(currentUser.id, 'ATTEMPT_STARTED', 'ATTEMPT', result.attempt.id);
  return result;
}

async function upsertAlert({
  campaignId,
  participantId,
  attemptId,
  type,
  severity,
  context,
  professionalUserId,
  familyUserId = null,
  executor = null,
}) {
  const now = nowIso();
  const execute = async (client) => {
    const alertId = newId('alert');
    const alertResult = await client.query(
      `insert into unicornio_questionnaire_alerts (
        id, campaign_id, participant_id, attempt_id, type, severity, status,
        encrypted_context, encryption_key_version, created_at, updated_at
      ) values ($1, $2, $3, $4, $5, $6, 'OPEN', $7, $8, $9, $9)
      on conflict (attempt_id, type) do update set
        severity = case
          when excluded.severity = 'RED' then 'RED'
          when unicornio_questionnaire_alerts.severity = 'RED' then 'RED'
          when excluded.severity = 'ORANGE' then 'ORANGE'
          else unicornio_questionnaire_alerts.severity
        end,
        encrypted_context = excluded.encrypted_context,
        encryption_key_version = excluded.encryption_key_version,
        updated_at = excluded.updated_at
      returning *`,
      [
        alertId,
        campaignId,
        participantId,
        attemptId,
        type,
        severity,
        encryptQuestionnairePayload(context),
        env.questionnaireDataKeyVersion,
        now,
      ],
    );
    const alert = alertResult.rows[0];

    await client.query(
      `insert into unicornio_notifications (
        id, recipient_user_id, alert_id, kind, title, body, href, created_at
      ) values ($1, $2, $3, 'PROFESSIONAL_ALERT', $4, $5, $6, $7)
      on conflict (alert_id, recipient_user_id, kind) do nothing`,
      [
        newId('notification'),
        professionalUserId,
        alert.id,
        type === 'MANUAL_HELP' ? 'Un alumno ha pedido ayuda' : 'Revisión prioritaria',
        type === 'MANUAL_HELP'
          ? 'Un alumno ha detenido el cuestionario y solicita acompañamiento ahora.'
          : 'Una respuesta o puntuación requiere revisión profesional.',
        `/questionnaires.html?campaignId=${encodeURIComponent(campaignId)}&alertId=${encodeURIComponent(alert.id)}`,
        now,
      ],
    );

    if (type === 'MANUAL_HELP' && familyUserId) {
      await client.query(
        `insert into unicornio_notifications (
          id, recipient_user_id, alert_id, kind, title, body, href, created_at
        ) values ($1, $2, $3, 'FAMILY_HELP_NOTICE', $4, $5, '/notifications.html', $6)
        on conflict (alert_id, recipient_user_id, kind) do nothing`,
        [
          newId('notification'),
          familyUserId,
          alert.id,
          'Solicitud de ayuda recibida',
          'El alumno vinculado ha solicitado ayuda desde Proyecto Unicornio. Contacta con el centro o con el profesional responsable. Este aviso no incluye respuestas ni puntuaciones.',
          now,
        ],
      );
    }
    return alert;
  };

  if (executor) {
    return execute(executor);
  }
  return database.transaction(execute);
}

async function saveAnswer(attemptId, data, currentUser) {
  ensureQuestionnairePilotAvailable();
  assertRole(currentUser, 'STUDENT');
  const attempt = await getAttemptForStudent(attemptId, currentUser);
  if (attempt.status !== 'IN_PROGRESS') {
    throw new AppError('El intento está bloqueado.', 409, null, 'ATTEMPT_LOCKED');
  }
  if (attempt.participant_status !== 'IN_PROGRESS') {
    throw new AppError(
      'La participación ya no está habilitada.',
      409,
      null,
      'PARTICIPANT_BLOCKED',
    );
  }
  if (attempt.campaign_status !== 'LIVE' || (attempt.live_expires_at && new Date(attempt.live_expires_at) <= new Date())) {
    throw new AppError('La sesión ya no está disponible.', 409, null, 'CAMPAIGN_NOT_LIVE');
  }

  const definition = await getDefinitionById(attempt.questionnaire_version_id);
  const questionNumber = Number(data.questionNumber);
  const question = definition.questions.find((item) => item.number === questionNumber);
  const option = definition.responseScale.find(
    (item) => item.value === String(data.value || '').toUpperCase(),
  );
  if (!question || !option) {
    throw new AppError('La pregunta o respuesta no es válida.', 400, null, 'BAD_REQUEST');
  }

  const now = nowIso();
  const sentinelSeverities = definition.scoringRules.sentinelRules
    .filter((rule) => rule.questionNumbers.includes(questionNumber) && option.points >= rule.minimumPoints)
    .map((rule) => rule.severity);
  const severity = sentinelSeverities.includes('RED')
    ? 'RED'
    : sentinelSeverities.includes('ORANGE') ? 'ORANGE' : null;
  await database.transaction(async (client) => {
    await client.query(
      `insert into unicornio_questionnaire_answers (
        id, attempt_id, question_number, encrypted_payload, encryption_key_version, answered_at
      ) values ($1, $2, $3, $4, $5, $6)
      on conflict (attempt_id, question_number) do update set
        encrypted_payload = excluded.encrypted_payload,
        encryption_key_version = excluded.encryption_key_version,
        answered_at = excluded.answered_at`,
      [
        newId('answer'),
        attempt.id,
        questionNumber,
        encryptQuestionnairePayload({ value: option.value, points: option.points }),
        env.questionnaireDataKeyVersion,
        now,
      ],
    );

    if (severity) {
      await upsertAlert({
        campaignId: attempt.campaign_id,
        participantId: attempt.participant_id,
        attemptId: attempt.id,
        type: 'AUTOMATED_SENTINEL',
        severity,
        context: { questionNumber, points: option.points, rule: 'SENTINEL_ITEM' },
        professionalUserId: attempt.created_by_user_id,
        executor: client,
      });
    }
  });

  return { questionNumber, savedAt: now };
}

async function submitAttempt(attemptId, currentUser) {
  ensureQuestionnairePilotAvailable();
  assertRole(currentUser, 'STUDENT');
  const attempt = await getAttemptForStudent(attemptId, currentUser);
  if (attempt.status === 'SUBMITTED') {
    const savedMessageKey = attempt.completion_message_key;
    return {
      status: 'SUBMITTED',
      completionMessageKey: savedMessageKey,
      message: COMPLETION_MESSAGES[savedMessageKey] || COMPLETION_MESSAGES.SUPPORT_1,
    };
  }
  if (attempt.status !== 'IN_PROGRESS') {
    throw new AppError('El intento ya fue enviado o está bloqueado.', 409, null, 'ATTEMPT_LOCKED');
  }

  if (attempt.participant_status !== 'IN_PROGRESS') {
    throw new AppError(
      'La participación ya no está habilitada.',
      409,
      null,
      'PARTICIPANT_BLOCKED',
    );
  }

  const definition = await getDefinitionById(attempt.questionnaire_version_id);
  const answersResult = await database.query(
    `select question_number, encrypted_payload
     from unicornio_questionnaire_answers where attempt_id = $1 order by question_number`,
    [attempt.id],
  );
  const answers = answersResult.rows.map((row) => ({
    questionNumber: row.question_number,
    value: decryptQuestionnairePayload(row.encrypted_payload).value,
  }));

  let evaluation;
  try {
    evaluation = evaluateQuestionnaire(definition, answers);
  } catch (error) {
    throw new AppError(error.message, 400, null, 'INCOMPLETE_QUESTIONNAIRE');
  }

  const previousCompletions = await database.query(
    `select count(*)::integer as count
     from unicornio_questionnaire_attempts a
     join unicornio_questionnaire_participants p on p.id = a.participant_id
     where p.student_id = $1 and a.status = 'SUBMITTED'`,
    [currentUser.id],
  );
  const messageKey = COMPLETION_MESSAGE_KEYS[previousCompletions.rows[0].count % COMPLETION_MESSAGE_KEYS.length];
  const now = nowIso();

  await database.transaction(async (client) => {
    await client.query(
      `insert into unicornio_questionnaire_results (
        id, attempt_id, total_score, band_key, encrypted_payload, encryption_key_version,
        created_at, updated_at
      ) values ($1, $2, $3, $4, $5, $6, $7, $7)
      on conflict (attempt_id) do nothing`,
      [
        newId('result'),
        attempt.id,
        evaluation.totalScore,
        evaluation.band.key,
        encryptQuestionnairePayload({
          band: evaluation.band,
          triggeredRules: evaluation.triggeredRules,
          pendingClinicalRules: evaluation.pendingClinicalRules,
        }),
        env.questionnaireDataKeyVersion,
        now,
      ],
    );
    await client.query(
      `update unicornio_questionnaire_attempts
       set status = 'SUBMITTED', submitted_at = $2, completion_message_key = $3, updated_at = $2
       where id = $1`,
      [attempt.id, now, messageKey],
    );
    await client.query(
      `update unicornio_questionnaire_participants
       set status = 'SUBMITTED', updated_at = $2 where id = $1`,
      [attempt.participant_id, now],
    );

    if (evaluation.alertSeverity) {
      await upsertAlert({
        campaignId: attempt.campaign_id,
        participantId: attempt.participant_id,
        attemptId: attempt.id,
        type: 'AUTOMATED_RESULT',
        severity: evaluation.alertSeverity,
        context: {
          totalScore: evaluation.totalScore,
          band: evaluation.band,
          triggeredRules: evaluation.triggeredRules,
        },
        professionalUserId: attempt.created_by_user_id,
        executor: client,
      });
    }
  });

  await writeAudit(currentUser.id, 'ATTEMPT_SUBMITTED', 'ATTEMPT', attempt.id);
  return {
    status: 'SUBMITTED',
    completionMessageKey: messageKey,
    message: COMPLETION_MESSAGES[messageKey],
  };
}

async function requestHelp(attemptId, currentUser) {
  ensureQuestionnairePilotAvailable();
  assertRole(currentUser, 'STUDENT');
  const attempt = await getAttemptForStudent(attemptId, currentUser);
  if (attempt.status === 'HELP_REQUESTED') {
    await upsertAlert({
      campaignId: attempt.campaign_id,
      participantId: attempt.participant_id,
      attemptId: attempt.id,
      type: 'MANUAL_HELP',
      severity: 'ORANGE',
      context: {
        requestedAt: attempt.help_requested_at || nowIso(),
        partialAnswersPreserved: true,
      },
      professionalUserId: attempt.created_by_user_id,
      familyUserId: attempt.family_user_id,
    });
    return {
      status: 'HELP_REQUESTED',
      message: 'Tu solicitud ya está registrada. Quédate aquí; una persona responsable ha recibido el aviso.',
    };
  }
  if (attempt.status !== 'IN_PROGRESS') {
    throw new AppError('Este intento ya no admite una solicitud desde el cuestionario.', 409, null, 'ATTEMPT_LOCKED');
  }

  const now = nowIso();
  await database.transaction(async (client) => {
    await client.query(
      `update unicornio_questionnaire_attempts
       set status = 'HELP_REQUESTED', help_requested_at = $2, updated_at = $2 where id = $1`,
      [attempt.id, now],
    );
    await client.query(
      `update unicornio_questionnaire_participants
       set status = 'HELP_REQUESTED', updated_at = $2 where id = $1`,
      [attempt.participant_id, now],
    );
    await upsertAlert({
      campaignId: attempt.campaign_id,
      participantId: attempt.participant_id,
      attemptId: attempt.id,
      type: 'MANUAL_HELP',
      severity: 'ORANGE',
      context: { requestedAt: now, partialAnswersPreserved: true },
      professionalUserId: attempt.created_by_user_id,
      familyUserId: attempt.family_user_id,
      executor: client,
    });
  });
  await writeAudit(currentUser.id, 'HELP_REQUESTED', 'ATTEMPT', attempt.id);
  return {
    status: 'HELP_REQUESTED',
    message: 'No pasa nada. Has sido muy valiente al pedir ayuda. Ahora el profesional se hará cargo de escucharte y acompañarte.',
  };
}

async function listCampaignAlerts(campaignId, currentUser) {
  ensureQuestionnairePilotAvailable();
  const campaign = await getCampaignById(campaignId);
  assertCampaignOwner(campaign, currentUser);
  const result = await database.query(
    `select a.*, p.student_id
     from unicornio_questionnaire_alerts a
     join unicornio_questionnaire_participants p on p.id = a.participant_id
     where a.campaign_id = $1 order by
       case a.severity when 'RED' then 1 when 'ORANGE' then 2 else 3 end,
       a.created_at desc`,
    [campaign.id],
  );
  return result.rows.map((row) => {
    const student = findUserById(row.student_id);
    return {
      id: row.id,
      type: row.type,
      severity: row.severity,
      status: row.status,
      student: student ? { id: student.id, name: student.name } : { id: row.student_id, name: 'Alumno no disponible' },
      acknowledgedAt: row.acknowledged_at,
      resolvedAt: row.resolved_at,
      createdAt: row.created_at,
    };
  });
}

async function acknowledgeAlert(alertId, currentUser) {
  ensureQuestionnairePilotAvailable();
  assertRole(currentUser, 'PROFESSIONAL');
  const result = await database.query(
    `update unicornio_questionnaire_alerts a
     set status = case when a.status = 'OPEN' then 'ACKNOWLEDGED' else a.status end,
         acknowledged_by_user_id = coalesce(a.acknowledged_by_user_id, $2),
         acknowledged_at = coalesce(a.acknowledged_at, now()),
         updated_at = now()
     from unicornio_questionnaire_campaigns c
     where a.id = $1 and c.id = a.campaign_id and c.created_by_user_id = $2
     returning a.*`,
    [alertId, currentUser.id],
  );
  if (!result.rows[0]) {
    throw new AppError('Alerta no encontrada o no autorizada.', 404, null, 'NOT_FOUND');
  }
  await writeAudit(currentUser.id, 'ALERT_ACKNOWLEDGED', 'ALERT', alertId);
  return result.rows[0];
}

async function resolveAlert(alertId, note, currentUser) {
  ensureQuestionnairePilotAvailable();
  assertRole(currentUser, 'PROFESSIONAL');
  const resolutionNote = String(note || '').trim();
  if (!resolutionNote) {
    throw new AppError('Describe brevemente la actuación realizada.', 400, null, 'BAD_REQUEST');
  }
  const result = await database.query(
    `update unicornio_questionnaire_alerts a
     set status = 'RESOLVED', resolved_by_user_id = $2, resolved_at = now(),
         resolution_note = $3, updated_at = now()
     from unicornio_questionnaire_campaigns c
     where a.id = $1 and c.id = a.campaign_id and c.created_by_user_id = $2
     returning a.*`,
    [alertId, currentUser.id, resolutionNote],
  );
  if (!result.rows[0]) {
    throw new AppError('Alerta no encontrada o no autorizada.', 404, null, 'NOT_FOUND');
  }
  await writeAudit(currentUser.id, 'ALERT_RESOLVED', 'ALERT', alertId);
  return result.rows[0];
}

async function transferAlert(alertId, note, currentUser) {
  ensureQuestionnairePilotAvailable();
  assertRole(currentUser, 'PROFESSIONAL');
  const transferNote = String(note || '').trim();
  if (!transferNote) {
    throw new AppError(
      'Indica a quién se transfiere la alerta y el siguiente paso acordado.',
      400,
      null,
      'BAD_REQUEST',
    );
  }
  const result = await database.query(
    `update unicornio_questionnaire_alerts a
     set status = 'TRANSFERRED', transferred_by_user_id = $2, transferred_at = now(),
         transfer_note = $3, updated_at = now()
     from unicornio_questionnaire_campaigns c
     where a.id = $1 and c.id = a.campaign_id and c.created_by_user_id = $2
     returning a.*`,
    [alertId, currentUser.id, transferNote],
  );
  if (!result.rows[0]) {
    throw new AppError('Alerta no encontrada o no autorizada.', 404, null, 'NOT_FOUND');
  }
  await writeAudit(currentUser.id, 'ALERT_TRANSFERRED', 'ALERT', alertId, {
    note: transferNote,
  });
  return result.rows[0];
}

async function getStudentResult(campaignId, studentId, currentUser) {
  ensureQuestionnairePilotAvailable();
  const campaign = await getCampaignById(campaignId);
  assertCampaignOwner(campaign, currentUser);
  const result = await database.query(
    `select r.*, a.id as attempt_id, p.student_id, p.questionnaire_version_id
     from unicornio_questionnaire_results r
     join unicornio_questionnaire_attempts a on a.id = r.attempt_id
     join unicornio_questionnaire_participants p on p.id = a.participant_id
     where p.campaign_id = $1 and p.student_id = $2`,
    [campaign.id, studentId],
  );
  const row = result.rows[0];
  if (!row) {
    throw new AppError('El alumno todavía no tiene un resultado.', 404, null, 'NOT_FOUND');
  }

  const definition = await getDefinitionById(row.questionnaire_version_id);
  const answerRows = await database.query(
    `select question_number, encrypted_payload
     from unicornio_questionnaire_answers where attempt_id = $1 order by question_number`,
    [row.attempt_id],
  );
  const answers = answerRows.rows.map((answerRow) => {
    const value = decryptQuestionnairePayload(answerRow.encrypted_payload);
    const question = definition.questions.find((item) => item.number === answerRow.question_number);
    const option = definition.responseScale.find((item) => item.value === value.value);
    return {
      questionNumber: answerRow.question_number,
      question: question?.text || '',
      value: value.value,
      label: option?.label || value.value,
      points: option?.points ?? value.points,
    };
  });
  const clinical = decryptQuestionnairePayload(row.encrypted_payload);
  await database.query(
    `update unicornio_questionnaire_results
     set reviewed_by_user_id = $2, reviewed_at = coalesce(reviewed_at, now()), updated_at = now()
     where id = $1`,
    [row.id, currentUser.id],
  );
  await writeAudit(currentUser.id, 'RESULT_VIEWED', 'RESULT', row.id, {
    campaignId,
    studentId,
  });
  const student = findUserById(studentId);
  return {
    id: row.id,
    student: student ? { id: student.id, name: student.name } : { id: studentId, name: 'Alumno no disponible' },
    totalScore: row.total_score,
    band: clinical.band,
    triggeredRules: clinical.triggeredRules,
    pendingClinicalRules: clinical.pendingClinicalRules,
    answers,
    reviewedAt: row.reviewed_at || nowIso(),
    disclaimer: 'Resultado orientativo de cribado experimental. No constituye un diagnóstico.',
  };
}

async function listNotifications(currentUser) {
  ensureQuestionnairePilotAvailable();
  const result = await database.query(
    `select id, kind, title, body, href, is_read, read_at, created_at
     from unicornio_notifications
     where recipient_user_id = $1
     order by created_at desc limit 100`,
    [currentUser.id],
  );
  return result.rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    href: row.href,
    isRead: row.is_read,
    readAt: row.read_at,
    createdAt: row.created_at,
  }));
}

async function markNotificationRead(notificationId, currentUser) {
  ensureQuestionnairePilotAvailable();
  const result = await database.query(
    `update unicornio_notifications
     set is_read = true, read_at = coalesce(read_at, now())
     where id = $1 and recipient_user_id = $2
     returning id, is_read, read_at`,
    [notificationId, currentUser.id],
  );
  if (!result.rows[0]) {
    throw new AppError('Notificación no encontrada.', 404, null, 'NOT_FOUND');
  }
  return {
    id: result.rows[0].id,
    isRead: result.rows[0].is_read,
    readAt: result.rows[0].read_at,
  };
}

async function writeAudit(actorUserId, action, entityType, entityId, metadata = null) {
  if (!database.isPostgres()) {
    return;
  }
  await database.query(
    `insert into unicornio_questionnaire_audit_logs (
      id, actor_user_id, action, entity_type, entity_id, metadata, created_at
    ) values ($1, $2, $3, $4, $5, $6::jsonb, now())`,
    [
      newId('qaudit'),
      actorUserId || null,
      action,
      entityType,
      entityId,
      JSON.stringify(metadata || null),
    ],
  );
}

module.exports = {
  COMPLETION_MESSAGES,
  calculateAge,
  calculateDefinitionHash,
  getQuestionnairePreview,
  ensureQuestionnairePilotAvailable,
  initializeQuestionnaireModule,
  listQuestionnaireDefinitions,
  createCampaign,
  listCampaigns,
  requestCampaignConsents,
  syncParticipantFromConsent,
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
};
