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
