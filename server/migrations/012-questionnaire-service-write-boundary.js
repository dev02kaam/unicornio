const id = '012-questionnaire-service-write-boundary';

const sql = `
  drop policy if exists unicornio_results_service_insert on unicornio_questionnaire_results;
  create policy unicornio_results_service_insert
    on unicornio_questionnaire_results for insert
    with check (
      current_setting('app.questionnaire_service_write', true) = 'on'
    );

  drop policy if exists unicornio_alerts_service_write on unicornio_questionnaire_alerts;
  create policy unicornio_alerts_service_write
    on unicornio_questionnaire_alerts for all
    using (
      current_setting('app.questionnaire_service_write', true) = 'on'
    )
    with check (
      current_setting('app.questionnaire_service_write', true) = 'on'
    );

  drop policy if exists unicornio_notifications_service_write on unicornio_notifications;
  create policy unicornio_notifications_service_write
    on unicornio_notifications for all
    using (
      current_setting('app.questionnaire_service_write', true) = 'on'
    )
    with check (
      current_setting('app.questionnaire_service_write', true) = 'on'
    );
`;

module.exports = { id, sql };
