const id = '007-rls-request-context';

const sql = `
  alter table unicornio_academic_years add column if not exists legacy_id text;
  create unique index if not exists unicornio_academic_years_legacy_unique
    on unicornio_academic_years (legacy_id) where legacy_id is not null;

  drop policy if exists unicornio_answers_student_scope on unicornio_questionnaire_answers;
  create policy unicornio_answers_student_scope on unicornio_questionnaire_answers for all using (
    exists (
      select 1
      from unicornio_questionnaire_attempts qa
      join unicornio_questionnaire_participants qp on qp.id = qa.participant_id
      where qa.id = unicornio_questionnaire_answers.attempt_id
        and (
          qp.student_user_uuid = nullif(current_setting('app.user_id', true), '')::uuid
          or qp.student_id = nullif(current_setting('app.legacy_user_id', true), '')
        )
    )
  ) with check (
    exists (
      select 1
      from unicornio_questionnaire_attempts qa
      join unicornio_questionnaire_participants qp on qp.id = qa.participant_id
      where qa.id = unicornio_questionnaire_answers.attempt_id
        and (
          qp.student_user_uuid = nullif(current_setting('app.user_id', true), '')::uuid
          or qp.student_id = nullif(current_setting('app.legacy_user_id', true), '')
        )
    )
  );

  drop policy if exists unicornio_results_professional_scope on unicornio_questionnaire_results;
  create policy unicornio_results_professional_scope on unicornio_questionnaire_results for select using (
    exists (
      select 1
      from unicornio_questionnaire_attempts qa
      join unicornio_questionnaire_participants qp on qp.id = qa.participant_id
      join unicornio_questionnaire_campaigns qc on qc.id = qp.campaign_id
      join unicornio_groups ug on ug.id = qc.group_uuid or ug.legacy_id = qc.group_id
      join unicornio_group_assignments ga on ga.group_id = ug.id
      join unicornio_users actor on actor.id = ga.user_id
      where qa.id = unicornio_questionnaire_results.attempt_id
        and ga.role = 'PROFESSIONAL' and ga.active_until is null
        and (
          actor.id = nullif(current_setting('app.user_id', true), '')::uuid
          or actor.legacy_id = nullif(current_setting('app.legacy_user_id', true), '')
        )
    )
  );

  drop policy if exists unicornio_alerts_professional_scope on unicornio_questionnaire_alerts;
  create policy unicornio_alerts_professional_scope on unicornio_questionnaire_alerts for all using (
    owner_professional_id = nullif(current_setting('app.user_id', true), '')::uuid
    or target_professional_id = nullif(current_setting('app.user_id', true), '')::uuid
    or owner_professional_legacy_id = nullif(current_setting('app.legacy_user_id', true), '')
  ) with check (
    owner_professional_id = nullif(current_setting('app.user_id', true), '')::uuid
    or target_professional_id = nullif(current_setting('app.user_id', true), '')::uuid
    or owner_professional_legacy_id = nullif(current_setting('app.legacy_user_id', true), '')
  );

  drop policy if exists unicornio_notifications_recipient_scope on unicornio_notifications;
  create policy unicornio_notifications_recipient_scope on unicornio_notifications for all using (
    recipient_user_uuid = nullif(current_setting('app.user_id', true), '')::uuid
    or recipient_user_id = nullif(current_setting('app.legacy_user_id', true), '')
  ) with check (
    recipient_user_uuid = nullif(current_setting('app.user_id', true), '')::uuid
    or recipient_user_id = nullif(current_setting('app.legacy_user_id', true), '')
  );
`;

module.exports = { id, sql };
