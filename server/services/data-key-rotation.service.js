const crypto = require('node:crypto');
const {
  encryptQuestionnairePayload,
  decryptQuestionnairePayload,
} = require('./questionnaire-crypto.service');

function aad(table, recordId, field, campaignId, studentId) {
  return { table, recordId, field, campaignId, studentId };
}

function needsRotation(payload, currentVersion) {
  if (!payload) return false;
  const envelope = typeof payload === 'string' ? JSON.parse(payload) : payload;
  return envelope.keyVersion !== currentVersion;
}

async function rotateQuestionnaireData(client, provider) {
  const currentVersion = provider.getCurrentVersion();
  const counts = { answers: 0, results: 0, alertContext: 0, resolutionNotes: 0, transferNotes: 0 };

  await client.query('begin');
  try {
    const answers = await client.query(
      `select answer.id, answer.attempt_id, answer.question_number, answer.encrypted_payload,
              participant.campaign_id, participant.student_id
       from unicornio_questionnaire_answers answer
       join unicornio_questionnaire_attempts attempt on attempt.id = answer.attempt_id
       join unicornio_questionnaire_participants participant on participant.id = attempt.participant_id
       for update of answer`,
    );
    for (const row of answers.rows) {
      if (!needsRotation(row.encrypted_payload, currentVersion)) continue;
      const context = aad('unicornio_questionnaire_answers', `${row.attempt_id}:question:${row.question_number}`, 'encrypted_payload', row.campaign_id, row.student_id);
      const encrypted = encryptQuestionnairePayload(decryptQuestionnairePayload(row.encrypted_payload, context), context);
      await client.query(
        'update unicornio_questionnaire_answers set encrypted_payload = $2, encryption_key_version = $3 where id = $1',
        [row.id, encrypted, currentVersion],
      );
      counts.answers += 1;
    }

    const results = await client.query(
      `select result.id, result.attempt_id, result.encrypted_payload,
              participant.campaign_id, participant.student_id
       from unicornio_questionnaire_results result
       join unicornio_questionnaire_attempts attempt on attempt.id = result.attempt_id
       join unicornio_questionnaire_participants participant on participant.id = attempt.participant_id
       for update of result`,
    );
    for (const row of results.rows) {
      if (!needsRotation(row.encrypted_payload, currentVersion)) continue;
      const context = aad('unicornio_questionnaire_results', `${row.attempt_id}:result`, 'encrypted_payload', row.campaign_id, row.student_id);
      const encrypted = encryptQuestionnairePayload(decryptQuestionnairePayload(row.encrypted_payload, context), context);
      await client.query(
        'update unicornio_questionnaire_results set encrypted_payload = $2, encryption_key_version = $3 where id = $1',
        [row.id, encrypted, currentVersion],
      );
      counts.results += 1;
    }

    const alerts = await client.query(
      `select alert.id, alert.attempt_id, alert.type, alert.encrypted_context,
              alert.encrypted_resolution_note, alert.encrypted_transfer_note,
              participant.campaign_id, participant.student_id
       from unicornio_questionnaire_alerts alert
       join unicornio_questionnaire_participants participant on participant.id = alert.participant_id
       for update of alert`,
    );
    const alertFields = [
      ['encrypted_context', 'alertContext'],
      ['encrypted_resolution_note', 'resolutionNotes'],
      ['encrypted_transfer_note', 'transferNotes'],
    ];
    for (const row of alerts.rows) {
      for (const [field, counter] of alertFields) {
        if (!needsRotation(row[field], currentVersion)) continue;
        const context = aad('unicornio_questionnaire_alerts', `${row.attempt_id}:${row.type}`, field, row.campaign_id, row.student_id);
        const encrypted = encryptQuestionnairePayload(decryptQuestionnairePayload(row[field], context), context);
        await client.query(
          `update unicornio_questionnaire_alerts set ${field} = $2, encryption_key_version = $3 where id = $1`,
          [row.id, encrypted, currentVersion],
        );
        counts[counter] += 1;
      }
    }

    await client.query(
      `insert into unicornio_questionnaire_audit_logs
         (id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
       values ($1, null, 'DATA_KEY_ROTATED', 'KEY_PROVIDER', $2, $3::jsonb, now())`,
      [`audit-${crypto.randomUUID()}`, currentVersion, JSON.stringify({ counts })],
    );
    await client.query('commit');
    return counts;
  } catch (error) {
    await client.query('rollback');
    throw error;
  }
}

module.exports = { rotateQuestionnaireData, needsRotation };
