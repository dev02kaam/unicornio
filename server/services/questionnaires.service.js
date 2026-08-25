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
  findFamilyForStudent,
} = require('../utils/consents.helpers');
const {
  createConsentRequest,
  getActiveLegalTextVersion,
} = require('./consents.service');
const { findUserById } = require('./users.service');
const {
  questionnaireFamilies,
  questionnaireVersions,
  getQuestionnaireFamily,
} = require('../data/questionnaires/catalog');
const {
  encryptQuestionnairePayload,
  decryptQuestionnairePayload,
  getQuestionnaireKeyProvider,
} = require('./questionnaire-crypto.service');
const {
  evaluateQuestionnaireSubmission,
  matchesSentinelRule,
} = require('./questionnaire-scoring.service');

const COMPLETION_MESSAGES = Object.freeze({
  SUPPORT_1: 'Gracias por contarnos cómo te has sentido. Tus respuestas se han guardado y una persona profesional podrá revisarlas contigo.',
  SUPPORT_2: 'Has terminado. Hablar de cómo te sientes es una forma de cuidarte; si algo te preocupa, puedes pedir ayuda en cualquier momento.',
  SUPPORT_3: 'Gracias por compartirlo con sinceridad. No tienes que gestionar lo que sientes sin apoyo; hay personas preparadas para acompañarte.',
  PARTIAL: 'Las respuestas que llevabas se han enviado. No pasa nada por haber terminado antes; una persona profesional podrá revisarlas contigo.',
});

const COMPLETION_MESSAGE_KEYS = Object.keys(COMPLETION_MESSAGES)
  .filter((key) => key.startsWith('SUPPORT_'));

const CAMPAIGN_SELECTION_COLUMNS = `
  coalesce((
    select array_agg(cf.family_key order by cf.position)
    from unicornio_questionnaire_campaign_families cf
    where cf.campaign_id = c.id
  ), array[c.family_key]) as family_keys,
  coalesce((
    select array_agg(cv.questionnaire_version_id order by cv.position)
    from unicornio_questionnaire_campaign_versions cv
    where cv.campaign_id = c.id
  ), (
    select array_agg(v.id order by cf.position, v.age_min, v.age_max, v.id)
    from unicornio_questionnaire_campaign_families cf
    join unicornio_questionnaire_versions v on v.family_key = cf.family_key
    where cf.campaign_id = c.id and v.status = 'EXPERIMENTAL'
  ), array[]::text[]) as questionnaire_version_ids
`;

function newId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function nowIso() {
  return new Date().toISOString();
}

function questionnaireAad(table, recordId, field, campaignId, studentId) {
  return { table, recordId, field, campaignId, studentId };
}

function answerAad(attemptId, questionNumber, campaignId, studentId) {
  return questionnaireAad(
    'unicornio_questionnaire_answers',
    `${attemptId}:question:${questionNumber}`,
    'encrypted_payload',
    campaignId,
    studentId,
  );
}

function resultAad(attemptId, campaignId, studentId) {
  return questionnaireAad(
    'unicornio_questionnaire_results',
    `${attemptId}:result`,
    'encrypted_payload',
    campaignId,
    studentId,
  );
}

function alertAad(attemptId, type, campaignId, studentId, field = 'encrypted_context') {
  return questionnaireAad(
    'unicornio_questionnaire_alerts',
    `${attemptId}:${type}`,
    field,
    campaignId,
    studentId,
  );
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

  try {
    getQuestionnaireKeyProvider();
  } catch (_error) {
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

  const family = getQuestionnaireFamily(row.family_key);
  definition.family = family ? { ...family } : null;

  if (includeScoring) {
    definition.scoringRules = row.scoring_rules;
  }
  return definition;
}

function mapCampaignRow(row) {
  if (!row) {
    return null;
  }
  const familyKeys = Array.isArray(row.family_keys)
    ? row.family_keys
    : row.family_key ? [row.family_key] : [];
  const questionnaireVersionIds = Array.isArray(row.questionnaire_version_ids)
    ? row.questionnaire_version_ids
    : [];
  return {
    id: row.id,
    familyKey: row.family_key,
    familyKeys,
    questionnaireVersionIds,
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
  const selectedVersionIds = new Set(campaign.questionnaireVersionIds || []);
  return {
    ...campaign,
    questionnaires: campaign.familyKeys
      .map((familyKey) => getQuestionnaireFamily(familyKey))
      .filter(Boolean)
      .map((family) => ({
        ...family,
        versions: questionnaireVersions
          .filter((definition) => (
            definition.familyKey === family.key
            && selectedVersionIds.has(definition.id)
          ))
          .map((definition) => ({
            id: definition.id,
            title: definition.title,
            shortTitle: definition.shortTitle,
            ageMin: definition.ageMin,
            ageMax: definition.ageMax,
          })),
      })),
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

  for (const definition of questionnaireVersions) {
    const sourceHash = calculateDefinitionHash(definition);
    await database.query(
      `insert into unicornio_questionnaire_versions (
        id, family_key, version, title, short_title, age_min, age_max, instructions,
        response_scale, questions, scoring_rules, source_document, source_hash, status, published_at
      ) values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11::jsonb, $12, $13, $14, now()
      )
      on conflict (id) do update set
        family_key = excluded.family_key,
        version = excluded.version,
        title = excluded.title,
        short_title = excluded.short_title,
        age_min = excluded.age_min,
        age_max = excluded.age_max,
        instructions = excluded.instructions,
        response_scale = excluded.response_scale,
        questions = excluded.questions,
        scoring_rules = excluded.scoring_rules,
        source_document = excluded.source_document,
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
  return {
    families: questionnaireFamilies.map((family) => ({ ...family })),
    definitions: result.rows.map((row) => mapDefinitionRow(row, { includeScoring: false })),
  };
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
    `select c.*, ${CAMPAIGN_SELECTION_COLUMNS}
     from unicornio_questionnaire_campaigns c
     where c.id = $1`,
    [campaignId],
  );
  const campaign = mapCampaignRow(result.rows[0]);
  if (!campaign) {
    throw new AppError('Campaña no encontrada.', 404, null, 'NOT_FOUND');
  }
  return campaign;
}

function assertScopedCampaignOwner(campaign, currentUser) {
  const hasAssignment = getUserGroupAssignments(currentUser?.id)
    .some((assignment) => assignment.groupId === String(campaign.groupId));
  if (
    String(currentUser?.role || '').toUpperCase() !== 'PROFESSIONAL'
    || campaign.createdByUserId !== currentUser.id
    || !hasAssignment
  ) {
    throw new AppError('Campaña no encontrada.', 404, null, 'NOT_FOUND');
  }
}

async function assertScopedCampaignAccess(campaign, currentUser) {
  const hasAssignment = getUserGroupAssignments(currentUser?.id)
    .some((assignment) => assignment.groupId === String(campaign.groupId));
  if (
    String(currentUser?.role || '').toUpperCase() !== 'PROFESSIONAL'
    || !hasAssignment
  ) {
    throw new AppError('Campaña no encontrada.', 404, null, 'NOT_FOUND');
  }
  if (String(campaign.createdByUserId) === String(currentUser.id)) {
    return;
  }

  const transferred = await database.query(
    `select 1
     from unicornio_questionnaire_alerts a
     where a.campaign_id = $1
       and a.owner_professional_legacy_id = $2
     limit 1`,
    [campaign.id, currentUser.id],
  );
  if (transferred.rowCount === 0) {
    throw new AppError('Campaña no encontrada.', 404, null, 'NOT_FOUND');
  }
}

async function createCampaign(data, currentUser) {
  ensureQuestionnairePilotAvailable();
  const groupId = String(data.groupId || '').trim();
  const group = findGroupById(groupId);
  if (!group || !group.isActive) {
    throw new AppError('Grupo no encontrado o inactivo.', 404, null, 'NOT_FOUND');
  }
  assertProfessionalGroupAccess(currentUser, groupId);

  const requestedQuestionnaireVersionIds = [...new Set(
    (Array.isArray(data.questionnaireVersionIds) ? data.questionnaireVersionIds : [])
      .map((definitionId) => String(definitionId).trim()),
  )];
  const definitionById = new Map(
    questionnaireVersions.map((definition) => [definition.id, definition]),
  );
  const requestedDefinitions = requestedQuestionnaireVersionIds
    .map((definitionId) => definitionById.get(definitionId));
  if (
    requestedQuestionnaireVersionIds.length === 0
    || requestedDefinitions.some((definition) => !definition)
  ) {
    throw new AppError('Selecciona al menos una franja de edad válida.', 400, null, 'BAD_REQUEST');
  }
  const requestedFamilyKeys = [...new Set(
    requestedDefinitions.map((definition) => definition.familyKey),
  )];

  const title = String(data.title || 'Evaluación de bienestar').trim();
  const plannedFor = data.plannedFor ? new Date(data.plannedFor) : new Date();
  if (!title || Number.isNaN(plannedFor.getTime())) {
    throw new AppError('Indica un título y una fecha válidos.', 400, null, 'BAD_REQUEST');
  }
  if (!getActiveLegalTextVersion()) {
    throw new AppError('No existe una versión legal activa.', 409, null, 'NO_ACTIVE_LEGAL_TEXT');
  }
  const hasActiveStudents = getGroupUsers(group.id).some(
    (entry) => entry.user?.isActive && String(entry.user.role || '').toUpperCase() === 'STUDENT',
  );
  if (!hasActiveStudents) {
    throw new AppError('El grupo no tiene alumnos activos.', 409, null, 'EMPTY_GROUP');
  }

  const id = newId('campaign');
  const now = nowIso();
  await database.transaction(async (client) => {
    await client.query(
      `insert into unicornio_questionnaire_campaigns (
        id, family_key, center_id, group_id, created_by_user_id, title, status,
        planned_for, created_at, updated_at
      ) values ($1, $2, $3, $4, $5, $6, 'DRAFT', $7, $8, $8)`,
      [
        id,
        requestedFamilyKeys[0],
        group.centerId,
        group.id,
        currentUser.id,
        title,
        plannedFor.toISOString(),
        now,
      ],
    );
    for (const [position, familyKey] of requestedFamilyKeys.entries()) {
      await client.query(
        `insert into unicornio_questionnaire_campaign_families (
          campaign_id, family_key, position, created_at
        ) values ($1, $2, $3, $4)`,
        [id, familyKey, position, now],
      );
    }
    for (const [position, definitionId] of requestedQuestionnaireVersionIds.entries()) {
      await client.query(
        `insert into unicornio_questionnaire_campaign_versions (
          campaign_id, questionnaire_version_id, position, created_at
        ) values ($1, $2, $3, $4)`,
        [id, definitionId, position, now],
      );
    }
  });

  await writeAudit(currentUser.id, 'CAMPAIGN_CREATED', 'CAMPAIGN', id, {
    groupId: group.id,
    centerId: group.centerId,
    familyKeys: requestedFamilyKeys,
    questionnaireVersionIds: requestedQuestionnaireVersionIds,
  });
  const monitor = await requestCampaignConsents(id, currentUser);
  return monitor.campaign;
}

async function listCampaigns(currentUser) {
  ensureQuestionnairePilotAvailable();
  assertRole(currentUser, ['PROFESSIONAL', 'ADMIN', 'SCHOOL']);
  const role = String(currentUser.role || '').toUpperCase();
  let result;

  if (role === 'PROFESSIONAL') {
    result = await database.query(
      `select c.*, ${CAMPAIGN_SELECTION_COLUMNS}
       from unicornio_questionnaire_campaigns c
       where c.created_by_user_id = $1
          or exists (
            select 1
            from unicornio_questionnaire_alerts a
            where a.campaign_id = c.id
              and a.owner_professional_legacy_id = $1
          )
       order by c.created_at desc`,
      [currentUser.id],
    );
  } else if (role === 'SCHOOL') {
    result = await database.query(
      `select c.*, ${CAMPAIGN_SELECTION_COLUMNS}
       from unicornio_questionnaire_campaigns c
       where c.center_id = $1 order by c.created_at desc`,
      [currentUser.schoolId],
    );
  } else {
    result = await database.query(
      `select c.*, ${CAMPAIGN_SELECTION_COLUMNS}
       from unicornio_questionnaire_campaigns c order by c.created_at desc`,
    );
  }

  return result.rows.map((row) => publicCampaign(mapCampaignRow(row)));
}

function selectDefinitionForStudent(student, familyKey, atDate, questionnaireVersionIds = []) {
  const age = calculateAge(student.birthDate, atDate);
  const allowedVersionIds = new Set(questionnaireVersionIds);
  const definition = questionnaireVersions.find(
    (item) => item.familyKey === familyKey
      && (allowedVersionIds.size === 0 || allowedVersionIds.has(item.id))
      && age !== null
      && age >= item.ageMin
      && age <= item.ageMax,
  ) || null;
  return { age, definition };
}

async function requestCampaignConsents(campaignId, currentUser) {
  ensureQuestionnairePilotAvailable();
  const campaign = await getCampaignById(campaignId);
  assertScopedCampaignOwner(campaign, currentUser);
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
    const selections = campaign.familyKeys.map((familyKey) => ({
      familyKey,
      ...selectDefinitionForStudent(
        student,
        familyKey,
        campaign.plannedFor || new Date(),
        campaign.questionnaireVersionIds,
      ),
    }));
    const family = findFamilyForStudent(student.id);
    const hasEligibleQuestionnaire = selections.some((selection) => selection.definition);
    const consent = family && hasEligibleQuestionnaire ? createConsentRequest({
        studentId: student.id,
        familyUserId: family.id,
        legalTextVersionId: legalTextVersion.id,
        centerId: campaign.centerId,
        campaignId: campaign.id,
      }, currentUser, { allowProfessionalCampaign: true }) : null;

    for (const { familyKey, age, definition } of selections) {
      const row = {
        id: newId('participant'),
        familyKey,
        studentId: student.id,
        familyUserId: family?.id || null,
        questionnaireVersionId: definition?.id || null,
        consentId: consent?.id || null,
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
        row.status = consent.status === 'ACCEPTED' ? 'AVAILABLE' : 'AWAITING_CONSENT';
      }
      participantRows.push(row);
    }
  }

  await database.flush();
  const now = nowIso();
  await database.transaction(async (client) => {
    for (const participant of participantRows) {
      await client.query(
        `insert into unicornio_questionnaire_participants (
          id, campaign_id, family_key, student_id, family_user_id, consent_id,
          questionnaire_version_id, status, ineligible_reason, created_at, updated_at
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
        on conflict (campaign_id, student_id, family_key) do update set
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
          participant.familyKey,
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
    requested: new Set(participantRows.map((item) => item.consentId).filter(Boolean)).size,
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
       when ineligible_reason is not null or questionnaire_version_id is null then 'INELIGIBLE'
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
    `select p.id, p.family_key, p.student_id, p.status, p.ineligible_reason,
            c.status as consent_status
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
      const { age, definition } = selectDefinitionForStudent(
        student || {},
        participant.family_key,
        atDate,
        campaign.questionnaireVersionIds,
      );
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
  assertScopedCampaignOwner(campaign, currentUser);
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
  return publicCampaign({
    ...mapCampaignRow(result.rows[0]),
    familyKeys: campaign.familyKeys,
    questionnaireVersionIds: campaign.questionnaireVersionIds,
  });
}

async function closeCampaign(campaignId, currentUser) {
  ensureQuestionnairePilotAvailable();
  const campaign = await getCampaignById(campaignId);
  assertScopedCampaignOwner(campaign, currentUser);
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
  return publicCampaign({
    ...mapCampaignRow(result),
    familyKeys: campaign.familyKeys,
    questionnaireVersionIds: campaign.questionnaireVersionIds,
  });
}

async function cancelCampaign(campaignId, currentUser) {
  ensureQuestionnairePilotAvailable();
  const campaign = await getCampaignById(campaignId);
  assertScopedCampaignOwner(campaign, currentUser);
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
  return publicCampaign({
    ...mapCampaignRow(result),
    familyKeys: campaign.familyKeys,
    questionnaireVersionIds: campaign.questionnaireVersionIds,
  });
}

async function getCampaignMonitor(campaignId, currentUser) {
  ensureQuestionnairePilotAvailable();
  const campaign = await getCampaignById(campaignId);
  await assertScopedCampaignAccess(campaign, currentUser);

  const participantsResult = await database.query(
    `select p.*, c.status as consent_status,
            v.short_title, v.age_min, v.age_max
     from unicornio_questionnaire_participants p
     left join unicornio_consent_records c on c.id = p.consent_id
     left join unicornio_questionnaire_versions v on v.id = p.questionnaire_version_id
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
      familyKey: row.family_key,
      questionnaireVersionId: row.questionnaire_version_id,
      questionnaire: {
        familyKey: row.family_key,
        title: row.short_title || getQuestionnaireFamily(row.family_key)?.shortLabel || 'Cuestionario',
        ageRange: row.age_min ? `${row.age_min}-${row.age_max}` : null,
      },
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
            v.family_key, v.short_title, v.age_min, v.age_max
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
    familyKey: row.family_key,
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
        value: decryptQuestionnairePayload(
          row.encrypted_payload,
          answerAad(attempt.id, row.question_number, participant.campaign_id, participant.student_id),
        ).value,
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
  studentId,
  familyUserId = null,
  executor = null,
}) {
  const now = nowIso();
  const execute = async (client) => {
    const alertId = newId('alert');
    const encryptedContext = encryptQuestionnairePayload(
      context,
      alertAad(attemptId, type, campaignId, studentId),
    );
    const alertResult = await client.query(
      `insert into unicornio_questionnaire_alerts (
        id, campaign_id, participant_id, attempt_id, type, severity, status,
        encrypted_context, encryption_key_version, owner_professional_legacy_id,
        created_at, updated_at
      ) values ($1, $2, $3, $4, $5, $6, 'OPEN', $7, $8, $9, $10, $10)
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
        encryptedContext,
        JSON.parse(encryptedContext).keyVersion,
        professionalUserId,
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
  return database.questionnaireTransaction(execute);
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
    .filter((rule) => (
      rule.questionNumbers.includes(questionNumber)
      && matchesSentinelRule(rule, Number(option.points))
    ))
    .map((rule) => rule.severity);
  const severity = sentinelSeverities.includes('RED')
    ? 'RED'
    : sentinelSeverities.includes('ORANGE') ? 'ORANGE' : null;
  const encryptedAnswer = encryptQuestionnairePayload(
    { value: option.value, points: option.points },
    answerAad(attempt.id, questionNumber, attempt.campaign_id, attempt.student_id),
  );
  await database.questionnaireTransaction(async (client) => {
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
        encryptedAnswer,
        JSON.parse(encryptedAnswer).keyVersion,
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
        studentId: attempt.student_id,
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
      isComplete: savedMessageKey !== 'PARTIAL',
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
    value: decryptQuestionnairePayload(
      row.encrypted_payload,
      answerAad(attempt.id, row.question_number, attempt.campaign_id, attempt.student_id),
    ).value,
  }));

  const evaluation = evaluateQuestionnaireSubmission(definition, answers);
  const isComplete = evaluation.completion.status === 'COMPLETE';
  let messageKey = 'PARTIAL';
  if (isComplete) {
    const previousCompletions = await database.query(
      `select count(*)::integer as count
       from unicornio_questionnaire_attempts a
       join unicornio_questionnaire_participants p on p.id = a.participant_id
       where p.student_id = $1 and a.status = 'SUBMITTED'`,
      [currentUser.id],
    );
    messageKey = COMPLETION_MESSAGE_KEYS[
      previousCompletions.rows[0].count % COMPLETION_MESSAGE_KEYS.length
    ];
  }
  const now = nowIso();

  const encryptedResult = encryptQuestionnairePayload({
    totalScore: evaluation.totalScore,
    bandScore: evaluation.bandScore,
    band: evaluation.band,
    subscales: evaluation.subscales,
    triggeredRules: evaluation.triggeredRules,
    pendingClinicalRules: evaluation.pendingClinicalRules,
    completion: evaluation.completion,
  }, resultAad(attempt.id, attempt.campaign_id, attempt.student_id));
  await database.questionnaireTransaction(async (client) => {
    await client.query(
      `insert into unicornio_questionnaire_results (
        id, attempt_id, total_score, band_key, encrypted_payload, encryption_key_version,
        created_at, updated_at
      ) values ($1, $2, $3, $4, $5, $6, $7, $7)
      on conflict (attempt_id) do nothing`,
      [
        newId('result'),
        attempt.id,
        null,
        null,
        encryptedResult,
        JSON.parse(encryptedResult).keyVersion,
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

    if (isComplete && evaluation.alertSeverity) {
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
        studentId: attempt.student_id,
        executor: client,
      });
    }
  });

  await writeAudit(currentUser.id, 'ATTEMPT_SUBMITTED', 'ATTEMPT', attempt.id, {
    completionStatus: evaluation.completion.status,
    answeredCount: evaluation.completion.answeredCount,
    totalQuestions: evaluation.completion.totalQuestions,
  });
  return {
    status: 'SUBMITTED',
    completionMessageKey: messageKey,
    message: COMPLETION_MESSAGES[messageKey],
    isComplete,
    answeredCount: evaluation.completion.answeredCount,
    totalQuestions: evaluation.completion.totalQuestions,
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
      studentId: attempt.student_id,
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
  await database.questionnaireTransaction(async (client) => {
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
      studentId: attempt.student_id,
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
  await assertScopedCampaignAccess(campaign, currentUser);
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
  return database.transaction(async (client) => {
    const result = await client.query(
      `update unicornio_questionnaire_alerts a
       set status = case when a.status in ('OPEN', 'TRANSFERRED') then 'ACKNOWLEDGED' else a.status end,
           acknowledged_by_user_id = coalesce(a.acknowledged_by_user_id, $2),
           acknowledged_at = coalesce(a.acknowledged_at, now()),
           updated_at = now()
       from unicornio_questionnaire_campaigns c
       where a.id = $1 and c.id = a.campaign_id
         and coalesce(a.owner_professional_legacy_id, c.created_by_user_id) = $2
       returning a.*`,
      [alertId, currentUser.id],
    );
    if (!result.rows[0]) {
      throw new AppError('Alerta no encontrada o no autorizada.', 404, null, 'NOT_FOUND');
    }
    await client.query(
      `insert into unicornio_questionnaire_audit_logs (
         id, actor_user_id, action, entity_type, entity_id, metadata, created_at
       ) values ($1, $2, 'ALERT_ACKNOWLEDGED', 'ALERT', $3, null, now())`,
      [newId('qaudit'), currentUser.id, alertId],
    );
    return result.rows[0];
  });
}

async function resolveAlert(alertId, note, currentUser) {
  ensureQuestionnairePilotAvailable();
  assertRole(currentUser, 'PROFESSIONAL');
  const resolutionNote = String(note || '').trim();
  if (!resolutionNote) {
    throw new AppError('Describe brevemente la actuación realizada.', 400, null, 'BAD_REQUEST');
  }
  return database.transaction(async (client) => {
    const locked = await client.query(
      `select a.*, p.student_id
       from unicornio_questionnaire_alerts a
       join unicornio_questionnaire_campaigns c on c.id = a.campaign_id
       join unicornio_questionnaire_participants p on p.id = a.participant_id
       where a.id = $1
         and coalesce(a.owner_professional_legacy_id, c.created_by_user_id) = $2
       for update of a`,
      [alertId, currentUser.id],
    );
    const alert = locked.rows[0];
    if (!alert) {
      throw new AppError('Alerta no encontrada o no autorizada.', 404, null, 'NOT_FOUND');
    }
    const encryptedNote = encryptQuestionnairePayload(
      { note: resolutionNote },
      questionnaireAad(
        'unicornio_questionnaire_alerts',
        `${alertId}:resolution-note`,
        'encrypted_resolution_note',
        alert.campaign_id,
        alert.student_id,
      ),
    );
    const result = await client.query(
      `update unicornio_questionnaire_alerts
       set status = 'RESOLVED', resolved_by_user_id = $2, resolved_at = now(),
           resolution_note = null, encrypted_resolution_note = $3, updated_at = now()
       where id = $1
       returning *`,
      [alertId, currentUser.id, encryptedNote],
    );
    await client.query(
      `insert into unicornio_questionnaire_audit_logs (
         id, actor_user_id, action, entity_type, entity_id, metadata, created_at
       ) values ($1, $2, 'ALERT_RESOLVED', 'ALERT', $3, null, now())`,
      [newId('qaudit'), currentUser.id, alertId],
    );
    return result.rows[0];
  });
}

function validateAlertTransferTarget(actor, target, groupId, assignments) {
  if (!target || !target.isActive || String(target.role || '').toUpperCase() !== 'PROFESSIONAL') {
    throw new AppError('Profesional de destino no encontrado.', 404, null, 'NOT_FOUND');
  }
  if (String(actor.id) === String(target.id)) {
    throw new AppError('Selecciona otro profesional como destino.', 400, null, 'BAD_REQUEST');
  }
  const isAssigned = (assignments || []).some((assignment) => (
    assignment.isActive
    && String(assignment.userId) === String(target.id)
    && String(assignment.groupId) === String(groupId)
  ));
  if (!isAssigned) {
    throw new AppError('Profesional de destino no encontrado.', 404, null, 'NOT_FOUND');
  }
  return true;
}

async function transferAlert(alertId, transfer, currentUser) {
  ensureQuestionnairePilotAvailable();
  assertRole(currentUser, 'PROFESSIONAL');
  const targetProfessionalId = String(transfer?.targetProfessionalId || '').trim();
  const transferNote = String(transfer?.note || '').trim();
  if (!targetProfessionalId) {
    throw new AppError('Selecciona un profesional de destino.', 400, null, 'BAD_REQUEST');
  }
  if (!transferNote) {
    throw new AppError(
      'Indica a quién se transfiere la alerta y el siguiente paso acordado.',
      400,
      null,
      'BAD_REQUEST',
    );
  }
  const target = findUserById(targetProfessionalId);

  return database.questionnaireTransaction(async (client) => {
    const alertResult = await client.query(
      `select a.*, c.group_id, p.student_id
       from unicornio_questionnaire_alerts a
       join unicornio_questionnaire_campaigns c on c.id = a.campaign_id
       join unicornio_questionnaire_participants p on p.id = a.participant_id
       where a.id = $1
         and coalesce(a.owner_professional_legacy_id, c.created_by_user_id) = $2
       for update of a`,
      [alertId, currentUser.id],
    );
    const alert = alertResult.rows[0];
    if (!alert) {
      throw new AppError('Alerta no encontrada o no autorizada.', 404, null, 'NOT_FOUND');
    }

    validateAlertTransferTarget(
      currentUser,
      target,
      alert.group_id,
      getUserGroupAssignments(target.id),
    );
    const encryptedNote = encryptQuestionnairePayload(
      { note: transferNote },
      questionnaireAad(
        'unicornio_questionnaire_alerts',
        `${alertId}:transfer-note`,
        'encrypted_transfer_note',
        alert.campaign_id,
        alert.student_id,
      ),
    );
    const updated = await client.query(
      `update unicornio_questionnaire_alerts
       set status = 'TRANSFERRED',
           owner_professional_legacy_id = $2,
           transferred_by_user_id = $3,
           transferred_at = now(),
           transfer_note = null,
           encrypted_transfer_note = $4,
           updated_at = now()
       where id = $1
       returning *`,
      [alertId, target.id, currentUser.id, encryptedNote],
    );

    await client.query(
      `insert into unicornio_notifications (
         id, recipient_user_id, alert_id, kind, title, body, href, created_at
       ) values ($1, $2, $3, 'ALERT_TRANSFER_ASSIGNED', $4, $5, $6, now())
       on conflict (alert_id, recipient_user_id, kind) do nothing`,
      [
        newId('notification'),
        target.id,
        alertId,
        'Nueva alerta asignada',
        'Se te ha asignado una alerta para seguimiento profesional.',
        `/questionnaires.html?campaignId=${encodeURIComponent(alert.campaign_id)}&alertId=${encodeURIComponent(alertId)}`,
      ],
    );
    await client.query(
      `insert into unicornio_questionnaire_audit_logs (
         id, actor_user_id, action, entity_type, entity_id, metadata, created_at
       ) values ($1, $2, 'ALERT_TRANSFERRED', 'ALERT', $3, $4::jsonb, now())`,
      [
        newId('qaudit'),
        currentUser.id,
        alertId,
        JSON.stringify({ targetProfessionalId: target.id }),
      ],
    );
    return updated.rows[0];
  });
}

async function getStudentResult(campaignId, studentId, currentUser) {
  ensureQuestionnairePilotAvailable();
  const campaign = await getCampaignById(campaignId);
  await assertScopedCampaignAccess(campaign, currentUser);
  const review = await database.query(
    `select r.id as result_id, r.encrypted_payload as result_encrypted_payload,
            r.reviewed_at,
            a.id as attempt_id, a.status as attempt_status, a.help_requested_at,
            p.student_id, p.family_key,
            p.questionnaire_version_id, v.short_title, v.age_min, v.age_max,
            v.questions, v.response_scale
     from unicornio_questionnaire_participants p
     join unicornio_questionnaire_attempts a on a.participant_id = p.id
     join unicornio_questionnaire_versions v on v.id = p.questionnaire_version_id
     left join unicornio_questionnaire_results r on r.attempt_id = a.id
     where p.campaign_id = $1 and p.student_id = $2
       and (r.id is not null or a.status = 'HELP_REQUESTED')
     order by p.created_at, a.attempt_number`,
    [campaign.id, studentId],
  );
  if (review.rows.length === 0) {
    throw new AppError('El alumno todavía no tiene respuestas para revisar.', 404, null, 'NOT_FOUND');
  }

  const attemptIds = review.rows.map((row) => row.attempt_id);
  const answerRows = await database.query(
    `select attempt_id, question_number, encrypted_payload
     from unicornio_questionnaire_answers
     where attempt_id = any($1::text[])
     order by attempt_id, question_number`,
    [attemptIds],
  );
  const answersByAttempt = new Map();
  answerRows.rows.forEach((answerRow) => {
    const rows = answersByAttempt.get(answerRow.attempt_id) || [];
    rows.push(answerRow);
    answersByAttempt.set(answerRow.attempt_id, rows);
  });

  const reviewedAt = nowIso();
  const resultIds = review.rows.map((row) => row.result_id).filter(Boolean);
  if (resultIds.length > 0) {
    await database.query(
      `update unicornio_questionnaire_results
       set reviewed_by_user_id = $2, reviewed_at = coalesce(reviewed_at, now()), updated_at = now()
       where id = any($1::text[])`,
      [resultIds, currentUser.id],
    );
  }
  await writeAudit(currentUser.id, 'RESULTS_VIEWED', 'CAMPAIGN_STUDENT', `${campaignId}:${studentId}`, {
    campaignId,
    studentId,
    resultCount: resultIds.length,
    helpRequestedCount: review.rows.filter((row) => row.attempt_status === 'HELP_REQUESTED').length,
    answerCount: answerRows.rows.length,
  });
  const student = findUserById(studentId);
  return {
    student: student ? { id: student.id, name: student.name } : { id: studentId, name: 'Alumno no disponible' },
    results: review.rows.map((row) => {
      const clinical = row.result_encrypted_payload
        ? decryptQuestionnairePayload(
          row.result_encrypted_payload,
          resultAad(row.attempt_id, campaign.id, studentId),
        )
        : null;
      const answerItems = (answersByAttempt.get(row.attempt_id) || []).map((answerRow) => {
        const value = decryptQuestionnairePayload(
          answerRow.encrypted_payload,
          answerAad(row.attempt_id, answerRow.question_number, campaign.id, studentId),
        );
        const question = row.questions.find((item) => item.number === answerRow.question_number);
        const option = row.response_scale.find((item) => item.value === value.value);
        return {
          questionNumber: answerRow.question_number,
          question: question?.text || '',
          value: value.value,
          label: option?.label || value.value,
          points: option?.points ?? value.points,
        };
      });
      return {
        id: row.result_id || row.attempt_id,
        attemptStatus: row.attempt_status,
        helpRequestedAt: row.help_requested_at,
        familyKey: row.family_key,
        questionnaireTitle: row.short_title,
        ageRange: `${row.age_min}-${row.age_max}`,
        totalScore: clinical?.totalScore ?? null,
        bandScore: clinical ? (clinical.bandScore ?? clinical.totalScore) : null,
        band: clinical?.band || null,
        subscales: clinical?.subscales || [],
        triggeredRules: clinical?.triggeredRules || [],
        pendingClinicalRules: clinical?.pendingClinicalRules || [],
        completion: clinical?.completion || {
          status: row.attempt_status === 'HELP_REQUESTED' ? 'HELP_REQUESTED' : 'COMPLETE',
          answeredCount: answerItems.length,
          totalQuestions: row.questions.length,
        },
        answers: answerItems,
        reviewedAt: row.reviewed_at || reviewedAt,
      };
    }),
    disclaimer: 'Las respuestas guardadas se muestran para revisión profesional. Solo los envíos completos incluyen puntuación orientativa; no constituye un diagnóstico.',
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
  selectDefinitionForStudent,
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
  validateAlertTransferTarget,
  transferAlert,
  getStudentResult,
  listNotifications,
  markNotificationRead,
};
