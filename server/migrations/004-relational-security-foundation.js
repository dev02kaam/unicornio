const id = '004-relational-security-foundation';

const sql = `
  create extension if not exists pgcrypto;

  create table if not exists unicornio_users (
    id uuid primary key default gen_random_uuid(),
    public_id uuid not null unique default gen_random_uuid(),
    legacy_id text unique,
    email text not null,
    name text not null check (char_length(name) between 1 and 120),
    password_hash text,
    role text not null check (role in ('ADMIN', 'SCHOOL', 'TEACHER', 'PROFESSIONAL', 'STUDENT', 'FAMILY')),
    status text not null default 'ACTIVE' check (status in ('INVITED', 'ACTIVE', 'SUSPENDED', 'DISABLED')),
    birth_date date,
    age_range text,
    unicorn_gender text check (unicorn_gender is null or unicorn_gender in ('MASCULINE', 'FEMININE')),
    session_version integer not null default 1 check (session_version > 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );
  create unique index if not exists unicornio_users_email_unique
    on unicornio_users (lower(email));

  create table if not exists unicornio_oidc_identities (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references unicornio_users(id) on delete cascade,
    issuer text not null,
    subject text not null,
    email_at_link text,
    created_at timestamptz not null default now(),
    last_login_at timestamptz,
    unique (issuer, subject)
  );
  create index if not exists unicornio_oidc_identities_user_idx
    on unicornio_oidc_identities (user_id);

  create table if not exists unicornio_academic_years (
    id uuid primary key default gen_random_uuid(),
    public_id uuid not null unique default gen_random_uuid(),
    name text not null,
    starts_on date not null,
    ends_on date not null,
    status text not null check (status in ('PLANNED', 'ACTIVE', 'CLOSED')),
    check (starts_on < ends_on)
  );

  create table if not exists unicornio_centers (
    id uuid primary key default gen_random_uuid(),
    public_id uuid not null unique default gen_random_uuid(),
    legacy_id text unique,
    academic_year_id uuid references unicornio_academic_years(id),
    name text not null check (char_length(name) between 1 and 160),
    code text,
    type text check (type is null or type in ('PUBLIC', 'PRIVATE', 'CONCERTED', 'OTHER')),
    city text,
    support_contact text,
    status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );
  create unique index if not exists unicornio_centers_code_unique
    on unicornio_centers (lower(code)) where code is not null;

  create table if not exists unicornio_groups (
    id uuid primary key default gen_random_uuid(),
    public_id uuid not null unique default gen_random_uuid(),
    legacy_id text unique,
    center_id uuid not null references unicornio_centers(id) on delete cascade,
    academic_year_id uuid references unicornio_academic_years(id),
    name text not null check (char_length(name) between 1 and 120),
    code text,
    stage text,
    course text,
    shift text,
    status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );
  create index if not exists unicornio_groups_center_idx on unicornio_groups (center_id, status);
  create unique index if not exists unicornio_groups_center_code_unique
    on unicornio_groups (center_id, lower(code)) where code is not null;

  create table if not exists unicornio_center_assignments (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references unicornio_users(id) on delete cascade,
    center_id uuid not null references unicornio_centers(id) on delete cascade,
    role text not null check (role in ('CENTER_MANAGER', 'TEACHER', 'PROFESSIONAL', 'STUDENT')),
    is_primary boolean not null default false,
    active_from timestamptz not null default now(),
    active_until timestamptz,
    created_at timestamptz not null default now(),
    check (active_until is null or active_until > active_from),
    unique (user_id, center_id, role, active_from)
  );
  create index if not exists unicornio_center_assignments_scope_idx
    on unicornio_center_assignments (center_id, user_id, role)
    where active_until is null;

  create table if not exists unicornio_group_assignments (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references unicornio_users(id) on delete cascade,
    group_id uuid not null references unicornio_groups(id) on delete cascade,
    role text not null check (role in ('TEACHER', 'PROFESSIONAL', 'STUDENT')),
    is_primary boolean not null default false,
    active_from timestamptz not null default now(),
    active_until timestamptz,
    created_at timestamptz not null default now(),
    check (active_until is null or active_until > active_from),
    unique (user_id, group_id, role, active_from)
  );
  create index if not exists unicornio_group_assignments_scope_idx
    on unicornio_group_assignments (group_id, user_id, role)
    where active_until is null;

  create table if not exists unicornio_family_links (
    id uuid primary key default gen_random_uuid(),
    family_user_id uuid not null references unicornio_users(id) on delete cascade,
    student_user_id uuid not null references unicornio_users(id) on delete cascade,
    relationship text,
    active_from timestamptz not null default now(),
    active_until timestamptz,
    created_at timestamptz not null default now(),
    check (family_user_id <> student_user_id),
    check (active_until is null or active_until > active_from),
    unique (family_user_id, student_user_id, active_from)
  );
  create index if not exists unicornio_family_links_student_idx
    on unicornio_family_links (student_user_id, family_user_id)
    where active_until is null;

  create table if not exists unicornio_invitations (
    id uuid primary key default gen_random_uuid(),
    token_hash bytea not null unique,
    email text not null,
    role text not null check (role in ('STUDENT', 'FAMILY')),
    center_id uuid references unicornio_centers(id),
    group_id uuid references unicornio_groups(id),
    student_user_id uuid references unicornio_users(id),
    invited_by_user_id uuid not null references unicornio_users(id),
    expires_at timestamptz not null,
    used_at timestamptz,
    used_by_user_id uuid references unicornio_users(id),
    revoked_at timestamptz,
    created_at timestamptz not null default now(),
    check (used_at is null or used_by_user_id is not null)
  );
  create index if not exists unicornio_invitations_pending_idx
    on unicornio_invitations (lower(email), expires_at)
    where used_at is null and revoked_at is null;

  create table if not exists unicornio_consents (
    id uuid primary key default gen_random_uuid(),
    public_id uuid not null unique default gen_random_uuid(),
    student_user_id uuid not null references unicornio_users(id),
    family_user_id uuid not null references unicornio_users(id),
    center_id uuid not null references unicornio_centers(id),
    campaign_id text,
    legal_version_id text not null references unicornio_legal_text_versions(id),
    requested_by_user_id uuid not null references unicornio_users(id),
    status text not null check (status in ('PENDING', 'ACCEPTED', 'REJECTED', 'REVOKED', 'EXPIRED')),
    decided_at timestamptz,
    expires_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (student_user_id, family_user_id, center_id, legal_version_id, campaign_id)
  );
  create index if not exists unicornio_consents_student_idx
    on unicornio_consents (student_user_id, status, updated_at desc);
  create index if not exists unicornio_consents_family_idx
    on unicornio_consents (family_user_id, status, updated_at desc);
  create index if not exists unicornio_consents_center_idx
    on unicornio_consents (center_id, status, updated_at desc);

  create table if not exists unicornio_sessions (
    sid varchar not null collate "default" primary key,
    sess json not null,
    expire timestamp(6) without time zone not null
  );
  create index if not exists unicornio_sessions_expire_idx on unicornio_sessions (expire);

  create table if not exists unicornio_audit_events (
    id uuid primary key default gen_random_uuid(),
    actor_user_id uuid references unicornio_users(id),
    action text not null check (char_length(action) between 1 and 120),
    entity_type text not null check (char_length(entity_type) between 1 and 80),
    entity_public_id uuid,
    request_id uuid,
    outcome text not null check (outcome in ('SUCCESS', 'DENIED', 'FAILED')),
    metadata jsonb,
    created_at timestamptz not null default now()
  );
  create index if not exists unicornio_audit_events_actor_idx
    on unicornio_audit_events (actor_user_id, created_at desc);
  create index if not exists unicornio_audit_events_entity_idx
    on unicornio_audit_events (entity_type, entity_public_id, created_at desc);
  revoke update, delete on unicornio_audit_events from public;

  alter table unicornio_questionnaire_campaigns
    add column if not exists center_uuid uuid references unicornio_centers(id),
    add column if not exists group_uuid uuid references unicornio_groups(id),
    add column if not exists created_by_user_uuid uuid references unicornio_users(id);
  alter table unicornio_questionnaire_participants
    add column if not exists student_user_uuid uuid references unicornio_users(id),
    add column if not exists family_user_uuid uuid references unicornio_users(id);
  alter table unicornio_questionnaire_alerts
    add column if not exists owner_professional_id uuid references unicornio_users(id),
    add column if not exists target_professional_id uuid references unicornio_users(id),
    add column if not exists transfer_accepted_at timestamptz,
    add column if not exists encrypted_resolution_note text,
    add column if not exists encrypted_transfer_note text;
  alter table unicornio_notifications
    add column if not exists recipient_user_uuid uuid references unicornio_users(id);

  create index if not exists unicornio_campaign_scope_uuid_idx
    on unicornio_questionnaire_campaigns (group_uuid, status);
  create index if not exists unicornio_participant_student_uuid_idx
    on unicornio_questionnaire_participants (student_user_uuid, status);
  create index if not exists unicornio_alert_owner_idx
    on unicornio_questionnaire_alerts (owner_professional_id, status, created_at desc);
  create index if not exists unicornio_notification_recipient_uuid_idx
    on unicornio_notifications (recipient_user_uuid, is_read, created_at desc);

  alter table unicornio_consents enable row level security;
  alter table unicornio_consents force row level security;
  drop policy if exists unicornio_consents_select_scope on unicornio_consents;
  create policy unicornio_consents_select_scope on unicornio_consents for select using (
    student_user_id = nullif(current_setting('app.user_id', true), '')::uuid
    or family_user_id = nullif(current_setting('app.user_id', true), '')::uuid
    or exists (
      select 1 from unicornio_center_assignments ca
      where ca.user_id = nullif(current_setting('app.user_id', true), '')::uuid
        and ca.center_id = unicornio_consents.center_id
        and ca.role = 'CENTER_MANAGER' and ca.active_until is null
    )
    or exists (
      select 1
      from unicornio_group_assignments actor_ga
      join unicornio_group_assignments student_ga on student_ga.group_id = actor_ga.group_id
      where actor_ga.user_id = nullif(current_setting('app.user_id', true), '')::uuid
        and actor_ga.role in ('TEACHER', 'PROFESSIONAL') and actor_ga.active_until is null
        and student_ga.user_id = unicornio_consents.student_user_id
        and student_ga.role = 'STUDENT' and student_ga.active_until is null
    )
  );
  drop policy if exists unicornio_consents_write_scope on unicornio_consents;
  create policy unicornio_consents_write_scope on unicornio_consents for all using (
    family_user_id = nullif(current_setting('app.user_id', true), '')::uuid
    or exists (
      select 1 from unicornio_center_assignments ca
      where ca.user_id = nullif(current_setting('app.user_id', true), '')::uuid
        and ca.center_id = unicornio_consents.center_id
        and ca.role = 'CENTER_MANAGER' and ca.active_until is null
    )
  ) with check (
    family_user_id = nullif(current_setting('app.user_id', true), '')::uuid
    or exists (
      select 1 from unicornio_center_assignments ca
      where ca.user_id = nullif(current_setting('app.user_id', true), '')::uuid
        and ca.center_id = unicornio_consents.center_id
        and ca.role = 'CENTER_MANAGER' and ca.active_until is null
    )
  );

  alter table unicornio_questionnaire_answers enable row level security;
  alter table unicornio_questionnaire_answers force row level security;
  drop policy if exists unicornio_answers_student_scope on unicornio_questionnaire_answers;
  create policy unicornio_answers_student_scope on unicornio_questionnaire_answers for all using (
    exists (
      select 1 from unicornio_questionnaire_attempts qa
      join unicornio_questionnaire_participants qp on qp.id = qa.participant_id
      where qa.id = unicornio_questionnaire_answers.attempt_id
        and qp.student_user_uuid = nullif(current_setting('app.user_id', true), '')::uuid
    )
  ) with check (
    exists (
      select 1 from unicornio_questionnaire_attempts qa
      join unicornio_questionnaire_participants qp on qp.id = qa.participant_id
      where qa.id = unicornio_questionnaire_answers.attempt_id
        and qp.student_user_uuid = nullif(current_setting('app.user_id', true), '')::uuid
    )
  );

  alter table unicornio_questionnaire_results enable row level security;
  alter table unicornio_questionnaire_results force row level security;
  drop policy if exists unicornio_results_professional_scope on unicornio_questionnaire_results;
  create policy unicornio_results_professional_scope on unicornio_questionnaire_results for select using (
    exists (
      select 1 from unicornio_questionnaire_attempts qa
      join unicornio_questionnaire_participants qp on qp.id = qa.participant_id
      join unicornio_questionnaire_campaigns qc on qc.id = qp.campaign_id
      join unicornio_group_assignments ga on ga.group_id = qc.group_uuid
      where qa.id = unicornio_questionnaire_results.attempt_id
        and ga.user_id = nullif(current_setting('app.user_id', true), '')::uuid
        and ga.role = 'PROFESSIONAL' and ga.active_until is null
    )
  );

  alter table unicornio_questionnaire_alerts enable row level security;
  alter table unicornio_questionnaire_alerts force row level security;
  drop policy if exists unicornio_alerts_professional_scope on unicornio_questionnaire_alerts;
  create policy unicornio_alerts_professional_scope on unicornio_questionnaire_alerts for all using (
    owner_professional_id = nullif(current_setting('app.user_id', true), '')::uuid
    or target_professional_id = nullif(current_setting('app.user_id', true), '')::uuid
  ) with check (
    owner_professional_id = nullif(current_setting('app.user_id', true), '')::uuid
    or target_professional_id = nullif(current_setting('app.user_id', true), '')::uuid
  );

  alter table unicornio_notifications enable row level security;
  alter table unicornio_notifications force row level security;
  drop policy if exists unicornio_notifications_recipient_scope on unicornio_notifications;
  create policy unicornio_notifications_recipient_scope on unicornio_notifications for all using (
    recipient_user_uuid = nullif(current_setting('app.user_id', true), '')::uuid
  ) with check (
    recipient_user_uuid = nullif(current_setting('app.user_id', true), '')::uuid
  );
`;

module.exports = { id, sql };
