-- FND-388: 'pending' is now defined at type-creation in 0001, because the
-- postgres-js migrator runs the whole chain in a single transaction (so the
-- 0004/0005 file split does NOT give a commit boundary — 0005's SET DEFAULT
-- would hit "unsafe use of new value"). This statement is kept as an
-- idempotent no-op (IF NOT EXISTS) so the historical chain replays cleanly on
-- both fresh DBs (value already exists -> skipped) and any older DB that
-- predates the 0001 hoist (value gets added here).
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'pending' BEFORE 'attorney';
