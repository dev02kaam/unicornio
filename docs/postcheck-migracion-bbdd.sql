-- Proyecto Unicornio: validacion posterior de PostgreSQL.
-- La salida contiene metadatos y contadores, no filas ni datos personales.

select id, applied_at
from unicornio_migrations
order by id;

with expected(id) as (
  values
    ('001-questionnaire-pilot'),
    ('002-questionnaire-alert-transfer'),
    ('003-questionnaire-idempotency-indexes'),
    ('004-relational-security-foundation'),
    ('005-alert-ownership'),
    ('006-sensitive-data-and-immutability'),
    ('007-rls-request-context'),
    ('008-persistent-abuse-controls'),
    ('009-emergency-admin')
)
select expected.id as missing_migration
from expected
left join unicornio_migrations applied on applied.id = expected.id
where applied.id is null
order by expected.id;

select extname, extversion
from pg_extension
where extname = 'pgcrypto';

select c.relname as table_name,
       c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = current_schema()
  and c.relname in (
    'unicornio_consents',
    'unicornio_questionnaire_answers',
    'unicornio_questionnaire_results',
    'unicornio_questionnaire_alerts',
    'unicornio_notifications'
  )
order by c.relname;

select schemaname, tablename, policyname, cmd
from pg_policies
where schemaname = current_schema()
  and tablename in (
    'unicornio_consents',
    'unicornio_questionnaire_answers',
    'unicornio_questionnaire_results',
    'unicornio_questionnaire_alerts',
    'unicornio_notifications'
  )
order by tablename, policyname;

select indexname
from pg_indexes
where schemaname = current_schema()
  and indexname in (
    'idx_ucr_unique_alert_type_attempt',
    'idx_ucr_unique_alert_notification',
    'unicornio_one_active_emergency_admin'
  )
order by indexname;

select
  (select count(*) from unicornio_questionnaire_results
   where needs_sensitive_reencryption) as results_pending_sensitive_reencryption,
  (select count(*) from unicornio_questionnaire_alerts
   where needs_sensitive_reencryption) as alerts_pending_sensitive_reencryption;

select count(*) as active_emergency_admins
from unicornio_users
where role = 'ADMIN' and status = 'ACTIVE';

select has_table_privilege(current_user, 'unicornio_audit_events', 'UPDATE')
         as ddl_role_can_update_audit,
       has_table_privilege(current_user, 'unicornio_audit_events', 'DELETE')
         as ddl_role_can_delete_audit;

-- Repetir las comprobaciones de privilegios con el rol real de aplicacion.
-- El rol de aplicacion debe ser NOBYPASSRLS, sin DDL y sin UPDATE/DELETE
-- sobre unicornio_audit_events. Los grants se administran fuera de estas migraciones.
