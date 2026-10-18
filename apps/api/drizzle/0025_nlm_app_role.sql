-- The role the app connects as once row-level security is on. NOLOGIN here: a migration must not
-- hold a password. provision.sh (and the test setup) give it LOGIN and a password. A role belongs
-- to the cluster, not the database, so create it only when it is missing.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'nlm_app') THEN
    CREATE ROLE nlm_app NOLOGIN NOBYPASSRLS;
  END IF;
END
$$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO nlm_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO nlm_app;
--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO nlm_app;
--> statement-breakpoint
-- Tables and sequences that later migrations make get the same rights.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO nlm_app;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO nlm_app;
