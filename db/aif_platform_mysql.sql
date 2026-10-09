-- AIF Platform: MySQL 8.0.16+ database script (utf8mb4, UTC)
-- Usage: mysql -uroot -e "CREATE DATABASE aif_platform CHARACTER SET utf8mb4;" && mysql -uroot aif_platform < aif_platform_mysql.sql
-- Then create the first system admin with `npm run db:seed`.
SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- AIF Platform: MySQL 8.0.16+ / utf8mb4. IDs are UUIDs (CHAR(36)). All timestamps are UTC.
-- Hierarchy: system admin -> organization -> organization users (one organization per user).

CREATE TABLE organizations (
  id              CHAR(36) NOT NULL PRIMARY KEY,
  name            VARCHAR(120) NOT NULL,
  type            ENUM('AIF manager','Fund administrator','Trustee','Custodian') NOT NULL,
  registration_no VARCHAR(60) NULL,
  status          ENUM('active','suspended') NOT NULL DEFAULT 'active',
  created_by      CHAR(36) NULL,
  created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY organizations_name_uq (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE users (
  id            CHAR(36) NOT NULL PRIMARY KEY,
  org_id        CHAR(36) NULL,                       -- NULL only for system_admin
  email         VARCHAR(254) NOT NULL,
  name          VARCHAR(100) NOT NULL,
  role          ENUM('system_admin','org_admin','fund_manager','compliance_manager','auditor','investor') NOT NULL,
  password_hash VARCHAR(100) NULL,
  status        ENUM('invited','active','suspended') NOT NULL DEFAULT 'invited',
  token_version INT NOT NULL DEFAULT 0,              -- bump to sign a person out everywhere
  created_by    CHAR(36) NULL,
  last_login_at DATETIME(3) NULL,
  created_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY users_email_uq (email),
  KEY users_org_role_idx (org_id, role),
  CONSTRAINT users_org_fk FOREIGN KEY (org_id) REFERENCES organizations(id),
  CONSTRAINT users_role_org_ck CHECK ((role = 'system_admin' AND org_id IS NULL) OR (role <> 'system_admin' AND org_id IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE invites (
  id         CHAR(36) NOT NULL PRIMARY KEY,
  user_id    CHAR(36) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  used_at    DATETIME(3) NULL,
  UNIQUE KEY invites_token_uq (token_hash),
  CONSTRAINT invites_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- One row per investor. PAN and bank account number are encrypted (AES-256-GCM); only last 4 digits are readable in SQL.
CREATE TABLE investor_profiles (
  user_id           CHAR(36) NOT NULL PRIMARY KEY,
  org_id            CHAR(36) NOT NULL,
  kyc_status        ENUM('not_started','in_progress','submitted','verified','rejected') NOT NULL DEFAULT 'not_started',
  legal_name        VARCHAR(100) NULL,
  dob               DATE NULL,
  mobile            VARCHAR(10) NULL,
  pan_enc           TEXT NULL,
  pan_hash          CHAR(64) NULL,                    -- HMAC of the PAN, used to block duplicate investors in one organization
  pan_last4         CHAR(4) NULL,
  aadhaar_last4     CHAR(4) NULL,                     -- never store the full Aadhaar number
  address_line1     VARCHAR(150) NULL,
  address_line2     VARCHAR(150) NULL,
  city              VARCHAR(80) NULL,
  state             VARCHAR(80) NULL,
  pincode           CHAR(6) NULL,
  country           VARCHAR(60) NOT NULL DEFAULT 'India',
  occupation        VARCHAR(60) NULL,
  income_range      VARCHAR(30) NULL,
  source_of_funds   VARCHAR(40) NULL,
  is_pep            TINYINT(1) NULL,
  is_us_person      TINYINT(1) NULL,
  tax_residency     VARCHAR(60) NULL,
  bank_holder       VARCHAR(100) NULL,
  bank_account_enc  TEXT NULL,
  bank_account_last4 CHAR(4) NULL,
  bank_ifsc         CHAR(11) NULL,
  bank_name         VARCHAR(100) NULL,
  declaration_at    DATETIME(3) NULL,
  auto_checks       JSON NULL,
  submission_count  INT NOT NULL DEFAULT 0,
  submitted_at      DATETIME(3) NULL,
  reviewed_by       CHAR(36) NULL,
  reviewed_at       DATETIME(3) NULL,
  rejection_reason  VARCHAR(500) NULL,
  created_at        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY investor_pan_uq (org_id, pan_hash),
  KEY investor_status_idx (org_id, kyc_status),
  CONSTRAINT ip_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT ip_org_fk  FOREIGN KEY (org_id)  REFERENCES organizations(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE kyc_documents (
  id          CHAR(36) NOT NULL PRIMARY KEY,
  user_id     CHAR(36) NOT NULL,
  org_id      CHAR(36) NOT NULL,
  kind        ENUM('pan_card','address_proof','bank_proof','photo') NOT NULL,
  file_name   VARCHAR(200) NOT NULL,
  mime        VARCHAR(60) NOT NULL,
  size_bytes  INT NOT NULL,
  sha256      CHAR(64) NOT NULL,
  content     MEDIUMBLOB NOT NULL,
  uploaded_at DATETIME(3) NOT NULL,
  UNIQUE KEY kyc_doc_kind_uq (user_id, kind),
  CONSTRAINT kd_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Every verify / reject decision is kept, so a resubmission never erases the history
CREATE TABLE kyc_reviews (
  id          CHAR(36) NOT NULL PRIMARY KEY,
  investor_id CHAR(36) NOT NULL,
  org_id      CHAR(36) NOT NULL,
  reviewer_id CHAR(36) NOT NULL,
  decision    ENUM('verified','rejected') NOT NULL,
  reason      VARCHAR(500) NULL,
  checklist   JSON NULL,
  created_at  DATETIME(3) NOT NULL,
  KEY kyc_reviews_investor_idx (investor_id, created_at),
  CONSTRAINT kr_inv_fk FOREIGN KEY (investor_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT kr_rev_fk FOREIGN KEY (reviewer_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE funds (
  id               CHAR(36) NOT NULL PRIMARY KEY,
  org_id           CHAR(36) NOT NULL,
  code             VARCHAR(20) NOT NULL,
  name             VARCHAR(120) NOT NULL,
  category         ENUM('Category I','Category II','Category III') NOT NULL,
  strategy         VARCHAR(80) NULL,
  description      VARCHAR(1000) NULL,
  currency         CHAR(3) NOT NULL DEFAULT 'INR',
  target_size      DECIMAL(18,2) NOT NULL,
  min_commitment   DECIMAL(18,2) NOT NULL,
  tenure_years     TINYINT NOT NULL,
  status           ENUM('draft','open','closed','wound_up') NOT NULL DEFAULT 'draft',
  created_by       CHAR(36) NOT NULL,
  created_at       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY funds_code_uq (org_id, code),
  KEY funds_org_idx (org_id, status),
  CONSTRAINT funds_org_fk FOREIGN KEY (org_id) REFERENCES organizations(id),
  CONSTRAINT funds_by_fk  FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- An investor assigned to a fund with a commitment
CREATE TABLE fund_investors (
  id                CHAR(36) NOT NULL PRIMARY KEY,
  fund_id           CHAR(36) NOT NULL,
  org_id            CHAR(36) NOT NULL,
  investor_id       CHAR(36) NOT NULL,
  commitment_amount DECIMAL(18,2) NOT NULL,
  status            ENUM('active','removed') NOT NULL DEFAULT 'active',
  notes             VARCHAR(300) NULL,
  assigned_by       CHAR(36) NOT NULL,
  accepted_at       DATETIME(3) NULL,                -- the investor confirms the commitment
  created_at        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY fi_fund_investor_uq (fund_id, investor_id),
  KEY fi_investor_idx (investor_id),
  CONSTRAINT fi_fund_fk FOREIGN KEY (fund_id) REFERENCES funds(id),
  CONSTRAINT fi_inv_fk  FOREIGN KEY (investor_id) REFERENCES users(id),
  CONSTRAINT fi_by_fk   FOREIGN KEY (assigned_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Append-only, hash-chained audit trail. audit_head holds the latest hash and is row-locked per write.
CREATE TABLE audit_log (
  id          BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  org_id      CHAR(36) NULL,
  actor_id    CHAR(36) NULL,
  action      VARCHAR(60) NOT NULL,
  entity      VARCHAR(40) NOT NULL,
  entity_id   VARCHAR(64) NULL,
  before_json JSON NULL,
  after_json  JSON NULL,
  ip          VARCHAR(64) NULL,
  at          DATETIME(3) NOT NULL,
  prev_hash   CHAR(64) NOT NULL,
  hash        CHAR(64) NOT NULL,
  KEY audit_org_idx (org_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE audit_head (
  id        TINYINT NOT NULL PRIMARY KEY,
  last_hash CHAR(64) NOT NULL
) ENGINE=InnoDB;
INSERT INTO audit_head (id, last_hash) VALUES (1, '');

CREATE TABLE login_failures (
  id           BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  throttle_key CHAR(64) NOT NULL,
  at           DATETIME(3) NOT NULL,
  KEY login_failures_key_idx (throttle_key, at)
) ENGINE=InnoDB;

-- Second sign-in factor: a one-time code sent after the password is accepted.
-- Only a keyed hash of the code is stored. A challenge allows 3 wrong attempts in total and 5 minutes.
CREATE TABLE login_challenges (
  id            CHAR(36) NOT NULL PRIMARY KEY,
  user_id       CHAR(36) NOT NULL,
  portal        ENUM('org','system') NOT NULL,
  token_hash    CHAR(64) NOT NULL,                 -- the browser holds the random token in an httpOnly cookie; we keep its hash
  code_hash     CHAR(64) NOT NULL,                 -- HMAC(secret, challenge id + code): never the code itself
  attempts      TINYINT NOT NULL DEFAULT 0,        -- wrong guesses so far (resending does NOT reset this)
  sends         TINYINT NOT NULL DEFAULT 1,        -- how many times a code was sent for this challenge
  status        ENUM('pending','verified','locked','replaced') NOT NULL DEFAULT 'pending',
  ip            VARCHAR(64) NULL,
  expires_at    DATETIME(3) NOT NULL,
  last_sent_at  DATETIME(3) NOT NULL,
  created_at    DATETIME(3) NOT NULL,
  UNIQUE KEY lc_token_uq (token_hash),
  KEY lc_user_idx (user_id, created_at),
  CONSTRAINT lc_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- The organization's type is chosen by the organization itself (its org admin), not by the system admin who creates it.
-- So it starts empty and is filled in later. Existing values are kept.
ALTER TABLE organizations MODIFY type ENUM('AIF manager','Fund administrator','Trustee','Custodian') NULL DEFAULT NULL;

-- ============ AUDIT PROTECTION (needs TRIGGER; plus SUPER or log_bin_trust_function_creators=1 if binary logging is on)
-- Blocks UPDATE and DELETE on audit_log at the database level.
-- Needs the TRIGGER privilege. If binary logging is on, MySQL also needs SUPER or log_bin_trust_function_creators=1.
-- Without these triggers the hash chain still detects tampering, but cannot prevent it.
CREATE TRIGGER audit_log_no_update BEFORE UPDATE ON audit_log FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit_log is append-only';
CREATE TRIGGER audit_log_no_delete BEFORE DELETE ON audit_log FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit_log is append-only';

CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(100) PRIMARY KEY, applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3));
INSERT IGNORE INTO schema_migrations (name) VALUES ('001_init.sql'), ('002_login_challenges.sql'), ('003_org_type_set_by_org.sql'), ('triggers.sql');
