const id = '013-questionnaire-result-upsert-policy';

const sql = `
  drop policy if exists unicornio_results_service_insert on unicornio_questionnaire_results;
  drop policy if exists unicornio_results_service_write on unicornio_questionnaire_results;
  create policy unicornio_results_service_write
    on unicornio_questionnaire_results for all
    using (
      current_setting('app.questionnaire_service_write', true) = 'on'
    )
    with check (
      current_setting('app.questionnaire_service_write', true) = 'on'
    );
`;

module.exports = { id, sql };
