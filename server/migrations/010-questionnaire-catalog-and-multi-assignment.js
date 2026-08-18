const id = '010-questionnaire-catalog-and-multi-assignment';

const sql = `
  create table if not exists unicornio_questionnaire_campaign_families (
    campaign_id text not null references unicornio_questionnaire_campaigns(id) on delete cascade,
    family_key text not null,
    position integer not null check (position >= 0),
    created_at timestamptz not null default now(),
    primary key (campaign_id, family_key)
  );

  insert into unicornio_questionnaire_campaign_families (
    campaign_id, family_key, position, created_at
  )
  select id, family_key, 0, created_at
  from unicornio_questionnaire_campaigns
  where family_key is not null
  on conflict (campaign_id, family_key) do nothing;

  alter table unicornio_questionnaire_participants
    add column if not exists family_key text;

  update unicornio_questionnaire_participants p
  set family_key = coalesce(
    (
      select v.family_key
      from unicornio_questionnaire_versions v
      where v.id = p.questionnaire_version_id
    ),
    (
      select c.family_key
      from unicornio_questionnaire_campaigns c
      where c.id = p.campaign_id
    )
  )
  where p.family_key is null;

  alter table unicornio_questionnaire_participants
    alter column family_key set not null;

  alter table unicornio_questionnaire_participants
    drop constraint if exists unicornio_questionnaire_participants_campaign_id_student_id_key;

  create unique index if not exists unicornio_participant_campaign_student_family_unique
    on unicornio_questionnaire_participants (campaign_id, student_id, family_key);

  create index if not exists unicornio_campaign_family_lookup_idx
    on unicornio_questionnaire_campaign_families (family_key, campaign_id);

  create index if not exists unicornio_participant_campaign_family_status_idx
    on unicornio_questionnaire_participants (campaign_id, family_key, status);
`;

module.exports = { id, sql };
