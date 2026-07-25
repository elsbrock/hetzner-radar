-- Migrate authentication to Better Auth.
--
-- Schema derived from better-auth 1.6.25's own `getMigrations()` diffed against
-- the current production schema, then adapted for two SQLite ALTER TABLE rules
-- the generator does not account for:
--   1. ADD COLUMN with NOT NULL requires a non-NULL *constant* default.
--   2. CURRENT_TIMESTAMP is not a legal ADD COLUMN default.
-- Hence: add with a placeholder constant, then backfill.
--
-- DELIBERATELY NOT REBUILDING `user`. Four tables reference user(id) with
-- ON DELETE CASCADE (price_alert, price_alert_history, cloud_availability_alert,
-- cloud_alert_history). Dropping and recreating `user` under enforced foreign
-- keys would cascade-delete every user's alerts. Additive ALTERs only — existing
-- user.id values are preserved untouched, so all four relationships survive.

-- ---------------------------------------------------------------------------
-- user: additive only
-- ---------------------------------------------------------------------------

ALTER TABLE user ADD COLUMN name TEXT NOT NULL DEFAULT '';
ALTER TABLE user ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user ADD COLUMN image TEXT;
ALTER TABLE user ADD COLUMN updated_at DATE NOT NULL DEFAULT '1970-01-01T00:00:00.000Z';

-- Existing accounts only ever authenticated by emailed one-time code, so their
-- address is already proven. Name is not collected anywhere in the app; seed it
-- from the local part of the email so the NOT NULL column carries something
-- meaningful rather than an empty string.
UPDATE user
SET
  email_verified = 1,
  name = CASE
    WHEN instr(email, '@') > 1 THEN substr(email, 1, instr(email, '@') - 1)
    ELSE email
  END,
  updated_at = created_at
WHERE
  email_verified = 0;

-- ---------------------------------------------------------------------------
-- session: rebuilt
-- ---------------------------------------------------------------------------
-- Better Auth requires `token` (NOT NULL UNIQUE), which existing rows cannot
-- supply, and its session semantics differ from the previous SHA-256-of-token
-- scheme. Every existing session is therefore invalid regardless — rebuilding
-- is both necessary and the documented forced-logout cutover.
--
-- Nothing references `session`, so this DROP cannot cascade into user data.
-- Rebuilding also corrects the declared type of user_id, which was INTEGER
-- while user.id is TEXT (better-auth flags this: "Expected string but got
-- INTEGER"). SQLite's loose typing tolerated it; the new table is honest.

DROP TABLE IF EXISTS session;

CREATE TABLE session (
  id TEXT NOT NULL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user (id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at DATE NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at DATE NOT NULL,
  updated_at DATE NOT NULL
);

CREATE INDEX idx_session_user_id ON session (user_id);
CREATE INDEX idx_session_expires_at ON session (expires_at);

-- ---------------------------------------------------------------------------
-- account
-- ---------------------------------------------------------------------------

CREATE TABLE account (
  id TEXT NOT NULL PRIMARY KEY,
  account_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES user (id) ON DELETE CASCADE,
  access_token TEXT,
  refresh_token TEXT,
  id_token TEXT,
  access_token_expires_at DATE,
  refresh_token_expires_at DATE,
  scope TEXT,
  password TEXT,
  created_at DATE NOT NULL,
  updated_at DATE NOT NULL
);

CREATE INDEX account_user_id_idx ON account (user_id);

-- ---------------------------------------------------------------------------
-- verification (backs the email OTP flow)
-- ---------------------------------------------------------------------------

CREATE TABLE verification (
  id TEXT NOT NULL PRIMARY KEY,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expires_at DATE NOT NULL,
  created_at DATE NOT NULL,
  updated_at DATE NOT NULL
);

CREATE INDEX verification_identifier_idx ON verification (identifier);

-- NOTE: `email_verification_code` is now dead — Better Auth stores OTPs in
-- `verification`. Left in place deliberately; dropping it is a separate,
-- reversible cleanup once the migration has been verified in production.
