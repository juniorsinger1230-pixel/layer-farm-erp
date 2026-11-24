CREATE TABLE app_ops.payment_allocation (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_code VARCHAR(16) NOT NULL,
  payment_id BIGINT NOT NULL,
  payable_id BIGINT NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_code,payment_id,payable_id)
);

CREATE TABLE app_ops.journal_entry (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entry_no VARCHAR(40) NOT NULL,
  company_code VARCHAR(16) NOT NULL,
  entry_date DATE NOT NULL,
  source_type VARCHAR(64) NOT NULL,
  source_id VARCHAR(100) NOT NULL,
  status VARCHAR(16) NOT NULL CHECK (status IN ('draft','posted','reversed')),
  created_by VARCHAR(32) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_code,entry_no),
  UNIQUE (company_code,source_type,source_id)
);

CREATE TABLE app_ops.journal_line (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entry_id BIGINT NOT NULL REFERENCES app_ops.journal_entry(id),
  company_code VARCHAR(16) NOT NULL,
  line_no INTEGER NOT NULL CHECK (line_no > 0),
  account_code VARCHAR(32) NOT NULL,
  debit NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  description VARCHAR(500),
  CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0)),
  UNIQUE (entry_id,line_no)
);

CREATE TABLE app_ops.tax_rate (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_code VARCHAR(16) NOT NULL,
  tax_code VARCHAR(32) NOT NULL,
  rate NUMERIC(7,6) NOT NULL CHECK (rate >= 0 AND rate <= 1),
  effective_from DATE NOT NULL,
  effective_to DATE,
  created_by VARCHAR(32) NOT NULL,
  UNIQUE (company_code,tax_code,effective_from)
);

CREATE TABLE app_ops.tax_transaction (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_code VARCHAR(16) NOT NULL,
  transaction_date DATE NOT NULL,
  direction VARCHAR(16) NOT NULL CHECK (direction IN ('output','input','withholding')),
  source_type VARCHAR(64) NOT NULL,
  source_id VARCHAR(100) NOT NULL,
  tax_code VARCHAR(32) NOT NULL,
  net_amount NUMERIC(18,2) NOT NULL CHECK (net_amount >= 0),
  tax_amount NUMERIC(18,2) NOT NULL CHECK (tax_amount >= 0),
  gross_amount NUMERIC(18,2) NOT NULL CHECK (gross_amount = net_amount + tax_amount),
  currency CHAR(3) NOT NULL DEFAULT 'PHP',
  bir_form VARCHAR(16) NOT NULL CHECK (bir_form IN ('2550Q','2550M','1601EQ','2307')),
  created_by VARCHAR(32) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_code,direction,source_type,source_id,tax_code,bir_form)
);

CREATE INDEX app_ops_mrp_line_material_idx ON app_ops.mrp_line (company_code,material_id,required_date);
CREATE INDEX app_ops_journal_line_account_idx ON app_ops.journal_line (company_code,account_code);
CREATE INDEX app_ops_tax_transaction_period_idx ON app_ops.tax_transaction (company_code,transaction_date,bir_form,direction);
