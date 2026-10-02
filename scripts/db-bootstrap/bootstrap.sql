-- Idempotent bootstrap of the per-service databases and roles (ADR-0020).
-- Run by the in-cluster bootstrap Job with the RDS master credential.
-- Required psql variables: os_user os_password os_db billing_user
-- billing_password billing_db execucao_user execucao_password execucao_db.
-- CREATE DATABASE cannot run inside DO $$, so statements are generated with
-- format() and executed with \gexec only when the object is missing.
\set ON_ERROR_STOP on
\connect postgres

-- Roles: create when missing, always resync the password with the secret.
SELECT format('CREATE ROLE %I LOGIN', :'os_user')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'os_user') \gexec
SELECT format('CREATE ROLE %I LOGIN', :'billing_user')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'billing_user') \gexec
SELECT format('CREATE ROLE %I LOGIN', :'execucao_user')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'execucao_user') \gexec

SELECT format('ALTER ROLE %I WITH LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE', :'os_user', :'os_password') \gexec
SELECT format('ALTER ROLE %I WITH LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE', :'billing_user', :'billing_password') \gexec
SELECT format('ALTER ROLE %I WITH LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE', :'execucao_user', :'execucao_password') \gexec

-- RDS master is not a real superuser: it must be a member of a role to hand
-- ownership to it.
SELECT format('GRANT %I TO CURRENT_USER', :'os_user') \gexec
SELECT format('GRANT %I TO CURRENT_USER', :'billing_user') \gexec
SELECT format('GRANT %I TO CURRENT_USER', :'execucao_user') \gexec

-- Databases: os_service already exists (RDS db_name); the others are created.
SELECT format('CREATE DATABASE %I', :'os_db')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'os_db') \gexec
SELECT format('CREATE DATABASE %I', :'billing_db')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'billing_db') \gexec
SELECT format('CREATE DATABASE %I', :'execucao_db')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'execucao_db') \gexec

-- Each service owns its database; nobody else may even connect.
SELECT format('ALTER DATABASE %I OWNER TO %I', :'os_db', :'os_user') \gexec
SELECT format('ALTER DATABASE %I OWNER TO %I', :'billing_db', :'billing_user') \gexec
SELECT format('ALTER DATABASE %I OWNER TO %I', :'execucao_db', :'execucao_user') \gexec

SELECT format('REVOKE ALL ON DATABASE %I FROM PUBLIC', datname)
FROM pg_database WHERE datname IN ('postgres', 'template1', :'os_db', :'billing_db', :'execucao_db') \gexec

SELECT format('GRANT CONNECT ON DATABASE %I TO %I', :'os_db', :'os_user') \gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO %I', :'billing_db', :'billing_user') \gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO %I', :'execucao_db', :'execucao_user') \gexec

-- Explicitly deny each service on the other services' databases.
SELECT format('REVOKE ALL ON DATABASE %I FROM %I', db, usr)
FROM (VALUES
  (:'billing_db', :'os_user'), (:'execucao_db', :'os_user'),
  (:'os_db', :'billing_user'), (:'execucao_db', :'billing_user'),
  (:'os_db', :'execucao_user'), (:'billing_db', :'execucao_user')
) AS t(db, usr) \gexec

-- Public schema of each database belongs to its service only.
\connect :os_db
REVOKE ALL ON SCHEMA public FROM PUBLIC;
SELECT format('ALTER SCHEMA public OWNER TO %I', :'os_user') \gexec
\connect :billing_db
REVOKE ALL ON SCHEMA public FROM PUBLIC;
SELECT format('ALTER SCHEMA public OWNER TO %I', :'billing_user') \gexec
\connect :execucao_db
REVOKE ALL ON SCHEMA public FROM PUBLIC;
SELECT format('ALTER SCHEMA public OWNER TO %I', :'execucao_user') \gexec
