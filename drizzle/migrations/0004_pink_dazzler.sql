-- Postgres requires ALTER TYPE ADD VALUE to commit before the new value can
-- be used. We split into two separate migration files (0004 + 0005) so each
-- runs in its own transaction. See:
-- https://www.postgresql.org/docs/current/sql-altertype.html#SQL-ALTERTYPE-NOTES
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'pending' BEFORE 'attorney';
