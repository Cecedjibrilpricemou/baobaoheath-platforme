-- Make journal_audit append-only: reject UPDATE and DELETE at the
-- database level, regardless of which role or code path issues them,
-- so the audit trail can't be tampered with after the fact.

CREATE OR REPLACE FUNCTION prevent_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'journal_audit is append-only — % is not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_journal_audit_immutable
BEFORE UPDATE OR DELETE ON journal_audit
FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();
