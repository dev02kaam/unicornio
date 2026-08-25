const id = '011-questionnaire-version-targeting';

const sql = `
  create table if not exists unicornio_questionnaire_campaign_versions (
    campaign_id text not null references unicornio_questionnaire_campaigns(id) on delete cascade,
    questionnaire_version_id text not null references unicornio_questionnaire_versions(id),
    position integer not null check (position >= 0),
    created_at timestamptz not null default now(),
    primary key (campaign_id, questionnaire_version_id)
  );

  insert into unicornio_questionnaire_campaign_versions (
    campaign_id, questionnaire_version_id, position, created_at
  )
  select
    cf.campaign_id,
    v.id,
    (row_number() over (
      partition by cf.campaign_id
      order by cf.position, v.age_min, v.age_max, v.id
    ) - 1)::integer,
    cf.created_at
  from unicornio_questionnaire_campaign_families cf
  join unicornio_questionnaire_versions v on v.family_key = cf.family_key
  where v.status = 'EXPERIMENTAL'
  on conflict (campaign_id, questionnaire_version_id) do nothing;

  create index if not exists unicornio_campaign_version_lookup_idx
    on unicornio_questionnaire_campaign_versions (questionnaire_version_id, campaign_id);
`;

module.exports = { id, sql };
