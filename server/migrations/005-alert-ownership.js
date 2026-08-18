const id = '005-alert-ownership';

const sql = `
  alter table unicornio_questionnaire_alerts
    add column if not exists owner_professional_legacy_id text,
    add column if not exists encrypted_resolution_note text,
    add column if not exists encrypted_transfer_note text;

  update unicornio_questionnaire_alerts a
  set owner_professional_legacy_id = c.created_by_user_id
  from unicornio_questionnaire_campaigns c
  where c.id = a.campaign_id and a.owner_professional_legacy_id is null;

  create index if not exists unicornio_alert_owner_legacy_idx
    on unicornio_questionnaire_alerts (owner_professional_legacy_id, status, created_at desc);
`;

module.exports = { id, sql };
