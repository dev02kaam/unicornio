const id = '002-questionnaire-alert-transfer';

const sql = `
  alter table unicornio_questionnaire_alerts
    add column if not exists transferred_by_user_id text,
    add column if not exists transferred_at timestamptz,
    add column if not exists transfer_note text;
`;

module.exports = { id, sql };
