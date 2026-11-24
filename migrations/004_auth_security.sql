CREATE SCHEMA IF NOT EXISTS app_auth;

CREATE TABLE app_auth.credential (
  employee_id BIGINT PRIMARY KEY,
  account VARCHAR(64) NOT NULL,
  company_code VARCHAR(16) NOT NULL CHECK (company_code IN ('THL','TGE')),
  password_hash TEXT NOT NULL,
  principal JSONB NOT NULL,
  status VARCHAR(16) NOT NULL CHECK (status IN ('active','disabled')),
  failed_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  locked_until TIMESTAMPTZ,
  mfa_secret TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account, company_code)
);

CREATE TABLE app_auth.session (
  session_id UUID PRIMARY KEY,
  employee_id BIGINT NOT NULL,
  access_expires_at TIMESTAMPTZ NOT NULL,
  refresh_expires_at TIMESTAMPTZ NOT NULL,
  refresh_hash CHAR(64) NOT NULL UNIQUE,
  previous_refresh_hash CHAR(64),
  rotated_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_auth_session_employee ON app_auth.session (employee_id);
CREATE INDEX idx_auth_session_previous_refresh ON app_auth.session (previous_refresh_hash) WHERE previous_refresh_hash IS NOT NULL;

REVOKE ALL ON SCHEMA app_auth FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA app_auth FROM PUBLIC;
