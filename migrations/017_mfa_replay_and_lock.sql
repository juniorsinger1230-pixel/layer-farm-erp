ALTER TABLE app_auth.credential
  ADD COLUMN IF NOT EXISTS mfa_failed_attempts INTEGER NOT NULL DEFAULT 0 CHECK (mfa_failed_attempts >= 0),
  ADD COLUMN IF NOT EXISTS mfa_locked_until TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS app_auth.mfa_used_code (
  employee_id BIGINT NOT NULL,
  time_window BIGINT NOT NULL,
  code_hash CHAR(64) NOT NULL,
  used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (employee_id, time_window, code_hash),
  FOREIGN KEY (employee_id) REFERENCES app_auth.credential(employee_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mfa_used_code_expires ON app_auth.mfa_used_code (expires_at);

REVOKE ALL ON app_auth.mfa_used_code FROM PUBLIC;
