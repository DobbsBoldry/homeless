-- #227 — guarantee `updated_at` advances on every UPDATE to
-- eviction_response_packets, even if a future code path forgets to set it.
--
-- Today the two writers (savePacketAction, changePacketStatusAction in
-- src/app/actions/eviction.ts) both set updatedAt: new Date() explicitly,
-- so this trigger is a belt-and-suspenders guarantee — not a bug fix.
-- It exists so that adding a third writer later can't silently leave
-- updated_at stale, which downstream metrics (queries/metrics.ts uses
-- updated_at as the activity dimension) would silently miscount.
--
-- App-code vs trigger: same DRY argument as the audit-log trigger in
-- 0008_audit_log_append_only.sql — when invariants matter, enforce them
-- at the layer no caller can route around.

CREATE OR REPLACE FUNCTION set_updated_at_now()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER eviction_response_packets_touch_updated_at
BEFORE UPDATE ON eviction_response_packets
FOR EACH ROW EXECUTE FUNCTION set_updated_at_now();
