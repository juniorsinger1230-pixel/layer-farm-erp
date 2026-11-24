CREATE TABLE app_ops.supplier_account_binding (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_code VARCHAR(16) NOT NULL CHECK (company_code IN ('THL','TGE')),
  employee_id BIGINT NOT NULL,
  supplier_id BIGINT NOT NULL,
  status VARCHAR(16) NOT NULL CHECK (status IN ('active','disabled')),
  created_by VARCHAR(32) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_code,employee_id),
  UNIQUE (company_code,supplier_id,employee_id)
);

CREATE TABLE app_ops.supplier_order_confirmation (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_code VARCHAR(16) NOT NULL,
  purchase_order_id BIGINT NOT NULL,
  supplier_id BIGINT NOT NULL,
  confirmed_delivery_date DATE NOT NULL,
  note VARCHAR(500),
  confirmed_by VARCHAR(32) NOT NULL,
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_code,purchase_order_id)
);

CREATE TABLE app_ops.supplier_asn (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_code VARCHAR(16) NOT NULL,
  asn_no VARCHAR(40) NOT NULL,
  purchase_order_id BIGINT NOT NULL,
  supplier_id BIGINT NOT NULL,
  material_id BIGINT NOT NULL,
  quantity NUMERIC(14,2) NOT NULL CHECK (quantity > 0),
  batch_no VARCHAR(32) NOT NULL,
  production_date DATE NOT NULL,
  expiry_date DATE NOT NULL,
  status VARCHAR(16) NOT NULL CHECK (status IN ('submitted','received','cancelled')),
  created_by VARCHAR(32) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_code,asn_no),
  CHECK (expiry_date > production_date)
);

CREATE TABLE app_ops.livestock_sale_execution (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_code VARCHAR(16) NOT NULL,
  sale_no VARCHAR(40) NOT NULL,
  sales_order_id BIGINT NOT NULL,
  sale_type VARCHAR(16) NOT NULL CHECK (sale_type IN ('chick','cull')),
  flock_batch_id BIGINT NOT NULL,
  customer_id BIGINT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(14,2) NOT NULL CHECK (unit_price > 0),
  unit_cost NUMERIC(14,2) NOT NULL CHECK (unit_cost >= 0),
  total_amount NUMERIC(18,2) NOT NULL CHECK (total_amount = quantity * unit_price),
  sale_date DATE NOT NULL,
  created_by VARCHAR(32) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_code,sale_no),
  UNIQUE (company_code,sales_order_id)
);

CREATE INDEX app_ops_supplier_asn_order_idx ON app_ops.supplier_asn (company_code,purchase_order_id,status);
CREATE INDEX app_ops_livestock_sale_batch_idx ON app_ops.livestock_sale_execution (company_code,flock_batch_id,sale_date);
