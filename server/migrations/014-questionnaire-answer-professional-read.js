const id = '014-questionnaire-answer-professional-read';

const sql = `
  drop policy if exists unicornio_answers_professional_scope on unicornio_questionnaire_answers;
  create policy unicornio_answers_professional_scope
    on unicornio_questionnaire_answers for select
    using (
      exists (
        select 1
        from unicornio_questionnaire_attempts qa
        join unicornio_questionnaire_participants qp on qp.id = qa.participant_id
        join unicornio_questionnaire_campaigns qc on qc.id = qp.campaign_id
        join unicornio_groups ug on ug.id = qc.group_uuid or ug.legacy_id = qc.group_id
        join unicornio_group_assignments ga on ga.group_id = ug.id
        join unicornio_users actor on actor.id = ga.user_id
        where qa.id = unicornio_questionnaire_answers.attempt_id
          and ga.role = 'PROFESSIONAL'
          and ga.active_until is null
          and (
            actor.id = nullif(current_setting('app.user_id', true), '')::uuid
            or actor.legacy_id = nullif(current_setting('app.legacy_user_id', true), '')
          )
      )
    );
`;

module.exports = { id, sql };
