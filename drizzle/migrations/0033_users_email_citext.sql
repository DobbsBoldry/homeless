-- #192 / FND-003b — make users.email case-insensitive.
--
-- No callsite queries email by value today (email comes from Clerk and is
-- a display field), but eventual admin lookups and cross-event reconciliation
-- will, and the moment someone writes WHERE email = ? against plain text,
-- case-sensitivity bites silently. citext does the work at the column type
-- level so no caller has to remember to LOWER().
--
-- Supabase ships citext; AWS RDS Postgres includes it as a contrib extension
-- and CREATE EXTENSION is permitted by the rds_superuser role we'll have
-- post-BAA. No portability risk.

CREATE EXTENSION IF NOT EXISTS citext;

ALTER TABLE users ALTER COLUMN email TYPE citext USING email::citext;
