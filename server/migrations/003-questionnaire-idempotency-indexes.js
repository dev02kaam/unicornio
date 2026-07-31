const id = '003-questionnaire-idempotency-indexes';

const sql = `
  create unique index if not exists idx_ucr_unique_alert_type_attempt
    on unicornio_questionnaire_alerts(attempt_id, type);
  create unique index if not exists idx_ucr_unique_alert_notification
    on unicornio_notifications(alert_id, recipient_user_id, kind);
`;

module.exports = { id, sql };
