const id = '001-questionnaire-pilot';

const sql = `
  create table if not exists unicornio_legal_text_versions (
    id text primary key,
    version text not null unique,
    title text not null,
    content text not null,
    is_active boolean not null default false,
    effective_from date,
    effective_to date,
    created_at timestamptz not null,
    updated_at timestamptz not null
  );

  create table if not exists unicornio_consent_records (
    id text primary key,
    student_id text not null,
    family_user_id text not null,
    center_id text not null,
    legal_text_version_id text not null,
    campaign_id text,
    status text not null,
    requested_by_user_id text not null,
    accepted_at timestamptz,
    rejected_at timestamptz,
    revoked_at timestamptz,
    expires_at timestamptz,
    revocation_reason text,
    created_at timestamptz not null,
    updated_at timestamptz not null
  );

  create table if not exists unicornio_consent_audit_logs (
    id text primary key,
    consent_id text,
    action text not null,
    performed_by_user_id text,
    previous_status text,
    new_status text,
    metadata jsonb,
    created_at timestamptz not null
  );

  create table if not exists unicornio_questionnaire_versions (
    id text primary key,
    family_key text not null,
    version text not null,
    title text not null,
    short_title text not null,
    age_min integer not null,
    age_max integer not null,
    instructions text not null,
    response_scale jsonb not null,
    questions jsonb not null,
    scoring_rules jsonb not null,
    source_document text not null,
    source_hash text not null,
    status text not null default 'EXPERIMENTAL',
    published_at timestamptz,
    created_at timestamptz not null default now(),
    unique (family_key, version, age_min, age_max)
  );

  create table if not exists unicornio_questionnaire_campaigns (
    id text primary key,
    family_key text not null,
    center_id text not null,
    group_id text not null,
    created_by_user_id text not null,
    legal_text_version_id text,
    title text not null,
    status text not null,
    planned_for timestamptz,
    live_started_at timestamptz,
    live_expires_at timestamptz,
    closed_at timestamptz,
    created_at timestamptz not null,
    updated_at timestamptz not null
  );

  create table if not exists unicornio_questionnaire_participants (
    id text primary key,
    campaign_id text not null references unicornio_questionnaire_campaigns(id) on delete cascade,
    student_id text not null,
    family_user_id text,
    consent_id text,
    questionnaire_version_id text references unicornio_questionnaire_versions(id),
    status text not null,
    ineligible_reason text,
    created_at timestamptz not null,
    updated_at timestamptz not null,
    unique (campaign_id, student_id)
  );

  create table if not exists unicornio_questionnaire_attempts (
    id text primary key,
    participant_id text not null references unicornio_questionnaire_participants(id) on delete cascade,
    attempt_number integer not null default 1,
    status text not null,
    started_at timestamptz not null,
    submitted_at timestamptz,
    help_requested_at timestamptz,
    completion_message_key text,
    created_at timestamptz not null,
    updated_at timestamptz not null,
    unique (participant_id, attempt_number)
  );

  create table if not exists unicornio_questionnaire_answers (
    id text primary key,
    attempt_id text not null references unicornio_questionnaire_attempts(id) on delete cascade,
    question_number integer not null,
    encrypted_payload text not null,
    encryption_key_version text not null,
    answered_at timestamptz not null,
    unique (attempt_id, question_number)
  );

  create table if not exists unicornio_questionnaire_results (
    id text primary key,
    attempt_id text not null unique references unicornio_questionnaire_attempts(id) on delete cascade,
    total_score integer not null,
    band_key text not null,
    encrypted_payload text not null,
    encryption_key_version text not null,
    reviewed_by_user_id text,
    reviewed_at timestamptz,
    created_at timestamptz not null,
    updated_at timestamptz not null
  );

  create table if not exists unicornio_questionnaire_alerts (
    id text primary key,
    campaign_id text not null references unicornio_questionnaire_campaigns(id) on delete cascade,
    participant_id text not null references unicornio_questionnaire_participants(id) on delete cascade,
    attempt_id text references unicornio_questionnaire_attempts(id) on delete cascade,
    type text not null,
    severity text not null,
    status text not null,
    encrypted_context text,
    encryption_key_version text,
    acknowledged_by_user_id text,
    acknowledged_at timestamptz,
    resolved_by_user_id text,
    resolved_at timestamptz,
    resolution_note text,
    created_at timestamptz not null,
    updated_at timestamptz not null
  );

  create table if not exists unicornio_notifications (
    id text primary key,
    recipient_user_id text not null,
    alert_id text references unicornio_questionnaire_alerts(id) on delete cascade,
    kind text not null,
    title text not null,
    body text not null,
    href text,
    is_read boolean not null default false,
    read_at timestamptz,
    created_at timestamptz not null
  );

  create table if not exists unicornio_questionnaire_audit_logs (
    id text primary key,
    actor_user_id text,
    action text not null,
    entity_type text not null,
    entity_id text not null,
    metadata jsonb,
    created_at timestamptz not null
  );

  create index if not exists idx_ucr_campaign_group
    on unicornio_questionnaire_campaigns(group_id, status);
  create index if not exists idx_ucr_participant_student
    on unicornio_questionnaire_participants(student_id, status);
  create index if not exists idx_ucr_alert_campaign
    on unicornio_questionnaire_alerts(campaign_id, status, created_at desc);
  create index if not exists idx_ucr_notification_recipient
    on unicornio_notifications(recipient_user_id, is_read, created_at desc);
  create unique index if not exists idx_ucr_unique_alert_type_attempt
    on unicornio_questionnaire_alerts(attempt_id, type);
  create unique index if not exists idx_ucr_unique_alert_notification
    on unicornio_notifications(alert_id, recipient_user_id, kind);
  create index if not exists idx_ucr_consent_campaign
    on unicornio_consent_records(campaign_id, status);
`;

module.exports = { id, sql };
