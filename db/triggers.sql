-- Blocks UPDATE and DELETE on audit_log at the database level.
-- Needs the TRIGGER privilege. If binary logging is on, MySQL also needs SUPER or log_bin_trust_function_creators=1.
-- Without these triggers the hash chain still detects tampering, but cannot prevent it.
CREATE TRIGGER audit_log_no_update BEFORE UPDATE ON audit_log FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit_log is append-only';
---
CREATE TRIGGER audit_log_no_delete BEFORE DELETE ON audit_log FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit_log is append-only';
