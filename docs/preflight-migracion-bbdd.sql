-- Proyecto Unicornio: preflight de solo lectura para PostgreSQL.
-- Ejecutar con el mismo rol DDL que se utilizara para la migracion.
-- La salida contiene metadatos y contadores, no filas ni datos personales.

select version() as postgres_version,
       current_database() as database_name,
       current_user as migration_role,
       current_schema() as active_schema;

select rolname,
       rolsuper,
       rolcreatedb,
       rolcreaterole,
       rolbypassrls,
       has_database_privilege(current_user, current_database(), 'CONNECT') as can_connect,
       has_schema_privilege(current_user, current_schema(), 'USAGE') as can_use_schema,
       has_schema_privilege(current_user, current_schema(), 'CREATE') as can_create_in_schema
from pg_roles
where rolname = current_user;

select name, default_version, installed_version
from pg_available_extensions
where name = 'pgcrypto';

select schemaname, tablename, tableowner,
       pg_has_role(current_user, tableowner, 'USAGE') as migration_role_inherits_owner
from pg_tables
where schemaname = current_schema()
  and tablename like 'unicornio\_%' escape '\'
order by tablename;

select to_regclass(current_schema() || '.unicornio_migrations') as migration_ledger,
       to_regclass(current_schema() || '.unicornio_collections') as legacy_collections,
       to_regclass(current_schema() || '.unicornio_questionnaire_alerts') as alerts_table,
       to_regclass(current_schema() || '.unicornio_questionnaire_results') as results_table,
       to_regclass(current_schema() || '.unicornio_users') as users_table;

do $$
declare
  value bigint;
begin
  if to_regclass(current_schema() || '.unicornio_migrations') is not null then
    raise notice 'Migraciones ya aplicadas:';
    execute 'select count(*) from ' || quote_ident(current_schema()) || '.unicornio_migrations'
      into value;
    raise notice 'unicornio_migrations: % filas', value;
  else
    raise notice 'unicornio_migrations no existe; el runner la creara.';
  end if;

  if to_regclass(current_schema() || '.unicornio_collections') is not null then
    execute 'select count(*) from ' || quote_ident(current_schema()) || '.unicornio_collections'
      into value;
    raise notice 'ATENCION: unicornio_collections contiene % filas; revisar migracion de datos heredados.', value;
  end if;

  if to_regclass(current_schema() || '.unicornio_questionnaire_alerts') is not null then
    execute 'select count(*) from ' || quote_ident(current_schema()) || '.unicornio_questionnaire_alerts'
      into value;
    raise notice 'unicornio_questionnaire_alerts: % filas', value;
  end if;

  if to_regclass(current_schema() || '.unicornio_questionnaire_results') is not null then
    execute 'select count(*) from ' || quote_ident(current_schema()) || '.unicornio_questionnaire_results'
      into value;
    raise notice 'unicornio_questionnaire_results: % filas', value;
  end if;

  if to_regclass(current_schema() || '.unicornio_users') is not null then
    execute 'select count(*) from ' || quote_ident(current_schema())
      || '.unicornio_users where role = ''ADMIN'' and status = ''ACTIVE'''
      into value;
    raise notice 'Administradores activos existentes: %', value;
    if value > 1 then
      raise warning 'La migracion 009 fallara hasta resolver los administradores activos duplicados.';
    end if;
  end if;
end
$$ language plpgsql;

-- Mostrar las versiones aplicadas, si el ledger ya existe:
-- select id, applied_at from unicornio_migrations order by id;

-- Antes de aplicar la 003, BBDD debe comprobar duplicados si las tablas contienen datos:
-- select attempt_id, type, count(*)
-- from unicornio_questionnaire_alerts
-- group by attempt_id, type having count(*) > 1;
-- select alert_id, recipient_user_id, kind, count(*)
-- from unicornio_notifications
-- group by alert_id, recipient_user_id, kind having count(*) > 1;
