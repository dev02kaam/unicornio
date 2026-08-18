const id = '006-sensitive-data-and-immutability';

const sql = `
  alter table unicornio_questionnaire_results
    alter column total_score drop not null,
    alter column band_key drop not null,
    add column if not exists needs_sensitive_reencryption boolean not null default false;

  update unicornio_questionnaire_results
  set needs_sensitive_reencryption = true
  where total_score is not null or band_key is not null;

  alter table unicornio_questionnaire_alerts
    add column if not exists needs_sensitive_reencryption boolean not null default false;
  update unicornio_questionnaire_alerts
  set needs_sensitive_reencryption = true
  where resolution_note is not null or transfer_note is not null;

  alter table unicornio_legal_text_versions
    add column if not exists content_hash text;
  update unicornio_legal_text_versions
  set content_hash = encode(digest(content, 'sha256'), 'hex')
  where content_hash is null;
  alter table unicornio_legal_text_versions
    alter column content_hash set not null;

  create or replace function unicornio_prevent_published_questionnaire_mutation()
  returns trigger language plpgsql as $$
  begin
    if old.status = 'PUBLISHED' and (
      new.questions is distinct from old.questions
      or new.response_scale is distinct from old.response_scale
      or new.scoring_rules is distinct from old.scoring_rules
      or new.source_hash is distinct from old.source_hash
      or new.family_key is distinct from old.family_key
      or new.version is distinct from old.version
    ) then
      raise exception 'published questionnaire versions are immutable';
    end if;
    return new;
  end;
  $$;
  drop trigger if exists unicornio_questionnaire_version_immutable
    on unicornio_questionnaire_versions;
  create trigger unicornio_questionnaire_version_immutable
    before update on unicornio_questionnaire_versions
    for each row execute function unicornio_prevent_published_questionnaire_mutation();

  create or replace function unicornio_prevent_legal_content_mutation()
  returns trigger language plpgsql as $$
  begin
    if new.version is distinct from old.version
      or new.title is distinct from old.title
      or new.content is distinct from old.content
      or new.content_hash is distinct from old.content_hash then
      raise exception 'legal text content is immutable; create a new version';
    end if;
    return new;
  end;
  $$;
  drop trigger if exists unicornio_legal_content_immutable
    on unicornio_legal_text_versions;
  create trigger unicornio_legal_content_immutable
    before update on unicornio_legal_text_versions
    for each row execute function unicornio_prevent_legal_content_mutation();
`;

module.exports = { id, sql };
