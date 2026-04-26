-- audit_log is append-only: enforce at the DB level so a careless
-- `db.delete(auditLog)` or `db.update(auditLog).set(...)` raises rather
-- than silently mutates the immutable record.
--
-- We use a trigger (not a role/grant revoke) because everything in this
-- repo runs as the same Supabase service-role user — there's no separate
-- app role to scope down. When the HIPAA migration (ESUC-002) splits roles
-- on AWS RDS, an additional `REVOKE UPDATE, DELETE ON audit_log FROM <app>`
-- becomes the defense-in-depth layer documented in #198.

CREATE OR REPLACE FUNCTION audit_log_block_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only; %s on audit_log is not permitted',
    TG_OP USING ERRCODE = 'feature_not_supported';
END;
$$;

CREATE TRIGGER audit_log_no_update
BEFORE UPDATE ON audit_log
FOR EACH ROW EXECUTE FUNCTION audit_log_block_mutation();

CREATE TRIGGER audit_log_no_delete
BEFORE DELETE ON audit_log
FOR EACH ROW EXECUTE FUNCTION audit_log_block_mutation();
