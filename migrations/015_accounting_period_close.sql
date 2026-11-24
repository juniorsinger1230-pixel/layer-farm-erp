CREATE TABLE app_ops.accounting_period (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_code VARCHAR(16) NOT NULL,
  period_code VARCHAR(16) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status VARCHAR(16) NOT NULL,
  closed_by VARCHAR(32),
  closed_at TIMESTAMPTZ,
  note VARCHAR(500),
  created_by VARCHAR(32) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_accounting_period_company_code UNIQUE (company_code, period_code),
  CONSTRAINT accounting_period_dates_check CHECK (period_start <= period_end),
  CONSTRAINT accounting_period_status_check CHECK (status IN ('open','closing','closed'))
);

CREATE TABLE app_ops.account_balance_snapshot (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  period_id BIGINT NOT NULL REFERENCES app_ops.accounting_period(id),
  company_code VARCHAR(16) NOT NULL,
  account_code VARCHAR(32) NOT NULL,
  debit NUMERIC(14,2) NOT NULL DEFAULT 0,
  credit NUMERIC(14,2) NOT NULL DEFAULT 0,
  balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_account_snapshot_period_account UNIQUE (period_id, account_code),
  CONSTRAINT account_snapshot_company_check CHECK (company_code IS NOT NULL),
  CONSTRAINT account_snapshot_amount_check CHECK (debit >= 0 AND credit >= 0)
);

CREATE INDEX idx_accounting_period_company_status
  ON app_ops.accounting_period (company_code, status);
CREATE INDEX idx_accounting_period_dates
  ON app_ops.accounting_period (company_code, period_start, period_end);
CREATE INDEX idx_account_balance_snapshot_company
  ON app_ops.account_balance_snapshot (company_code, account_code);
