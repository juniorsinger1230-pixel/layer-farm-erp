CREATE TABLE app_ops.supplier_lead_time (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_code VARCHAR(16) NOT NULL CHECK (company_code IN ('THL','TGE')),
  supplier_id BIGINT NOT NULL,
  material_id BIGINT NOT NULL,
  lead_time_days INTEGER NOT NULL CHECK (lead_time_days BETWEEN 0 AND 365),
  effective_from DATE NOT NULL,
  created_by VARCHAR(32) NOT NULL,
  UNIQUE (company_code,supplier_id,material_id,effective_from)
);

CREATE TABLE app_ops.mrp_run (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_no VARCHAR(40) NOT NULL,
  company_code VARCHAR(16) NOT NULL CHECK (company_code IN ('THL','TGE')),
  input_hash CHAR(64) NOT NULL,
  status VARCHAR(16) NOT NULL CHECK (status IN ('calculated','converted','cancelled')),
  created_by VARCHAR(32) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_code,run_no)
);

CREATE TABLE app_ops.mrp_line (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_id BIGINT NOT NULL REFERENCES app_ops.mrp_run(id),
  company_code VARCHAR(16) NOT NULL,
  material_id BIGINT NOT NULL,
  required_date DATE NOT NULL,
  gross_requirement NUMERIC(14,2) NOT NULL CHECK (gross_requirement >= 0),
  on_hand NUMERIC(14,2) NOT NULL,
  reserved NUMERIC(14,2) NOT NULL,
  inbound NUMERIC(14,2) NOT NULL,
  safety_stock NUMERIC(14,2) NOT NULL,
  net_requirement NUMERIC(14,2) NOT NULL CHECK (net_requirement >= 0),
  supplier_id BIGINT,
  lead_time_days INTEGER,
  suggested_order_date DATE,
  expedite BOOLEAN NOT NULL DEFAULT false,
  requisition_id BIGINT,
  UNIQUE (run_id,material_id,required_date)
);

CREATE TABLE app_ops.procurement_return (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  return_no VARCHAR(40) NOT NULL,
  company_id BIGINT NOT NULL,
  goods_receipt_id BIGINT NOT NULL,
  material_id BIGINT NOT NULL,
  batch_no VARCHAR(32) NOT NULL,
  warehouse_id BIGINT NOT NULL,
  location_id BIGINT NOT NULL,
  quantity NUMERIC(14,2) NOT NULL CHECK (quantity > 0),
  unit_cost NUMERIC(14,4) NOT NULL CHECK (unit_cost >= 0),
  reason VARCHAR(500) NOT NULL,
  created_by VARCHAR(32) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id,return_no)
);

CREATE TABLE app_ops.sales_return_execution (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  return_no VARCHAR(40) NOT NULL,
  company_id BIGINT NOT NULL,
  sales_order_id BIGINT NOT NULL,
  original_reservation_id BIGINT NOT NULL,
  quantity NUMERIC(14,2) NOT NULL CHECK (quantity > 0),
  credit_amount NUMERIC(14,2) NOT NULL CHECK (credit_amount >= 0),
  reason VARCHAR(500) NOT NULL,
  created_by VARCHAR(32) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id,return_no),
  UNIQUE (company_id,original_reservation_id)
);

CREATE TABLE app_ops.delivery_status_event (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_code VARCHAR(16) NOT NULL,
  delivery_task_id BIGINT NOT NULL,
  sequence_no INTEGER NOT NULL CHECK (sequence_no > 0),
  status VARCHAR(24) NOT NULL CHECK (status IN ('assigned','departed','arrived','signed','failed','cancelled')),
  proof JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by VARCHAR(32) NOT NULL,
  UNIQUE (company_code,delivery_task_id,sequence_no)
);
