function assertRetentionConfiguration(retentionDays) {
  const required = ['responses', 'results', 'notifications', 'sessions', 'audit'];
  for (const name of required) {
    if (!Number.isFinite(retentionDays?.[name]) || retentionDays[name] <= 0) {
      throw new Error(`La retencion ${name} debe ser un numero positivo explicito.`);
    }
  }
}

async function runRetention(client, retentionDays, now = new Date()) {
  assertRetentionConfiguration(retentionDays);
  const counts = {};

  const statements = [
    ['responses', `delete from unicornio_questionnaire_answers
      where answered_at < $1::timestamptz - ($2 * interval '1 day')`, retentionDays.responses],
    ['results', `delete from unicornio_questionnaire_results
      where created_at < $1::timestamptz - ($2 * interval '1 day')`, retentionDays.results],
    ['notifications', `delete from unicornio_notifications
      where created_at < $1::timestamptz - ($2 * interval '1 day')`, retentionDays.notifications],
    ['sessions', 'delete from unicornio_sessions where expire < $1::timestamptz', 0],
    ['audit', `delete from unicornio_audit_events
      where created_at < $1::timestamptz - ($2 * interval '1 day')`, retentionDays.audit],
    ['questionnaireAudit', `delete from unicornio_questionnaire_audit_logs
      where created_at < $1::timestamptz - ($2 * interval '1 day')`, retentionDays.audit],
    ['abuseCounters', 'delete from unicornio_abuse_counters where reset_at < $1::timestamptz', 0],
  ];

  await client.query('begin');
  try {
    for (const [name, sql, days] of statements) {
      const result = days === 0
        ? await client.query(sql, [now])
        : await client.query(sql, [now, days]);
      counts[name] = result.rowCount;
    }
    await client.query('commit');
    return counts;
  } catch (error) {
    await client.query('rollback');
    throw error;
  }
}

module.exports = { assertRetentionConfiguration, runRetention };
