CREATE SCHEMA IF NOT EXISTS app_ops;

CREATE TABLE app_ops.flock_position (
  batch_id BIGINT NOT NULL,
  house_id BIGINT NOT NULL,
  company_code VARCHAR(16) NOT NULL CHECK (company_code IN ('THL','TGE')),
  quantity NUMERIC(14,2) NOT NULL CHECK (quantity >= 0),
  version BIGINT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (batch_id, house_id)
);

CREATE TABLE app_ops.egg_collection (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  collection_no VARCHAR(40) NOT NULL,
  batch_id BIGINT NOT NULL,
  house_id BIGINT NOT NULL,
  material_id BIGINT NOT NULL,
  warehouse_id BIGINT NOT NULL,
  location_id BIGINT NOT NULL,
  collection_date DATE NOT NULL,
  shift VARCHAR(16) NOT NULL CHECK (shift IN ('day','night','morning','evening')),
  good_eggs NUMERIC(14,2) NOT NULL CHECK (good_eggs >= 0),
  broken_eggs NUMERIC(14,2) NOT NULL CHECK (broken_eggs >= 0),
  dirty_eggs NUMERIC(14,2) NOT NULL CHECK (dirty_eggs >= 0),
  grade_detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  device_ref VARCHAR(150),
  company_code VARCHAR(16) NOT NULL CHECK (company_code IN ('THL','TGE')),
  created_by VARCHAR(32) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_code, collection_no)
);

CREATE TABLE app_ops.inventory_movement (
  movement_id UUID PRIMARY KEY,
  company_id BIGINT NOT NULL,
  material_id BIGINT NOT NULL,
  batch_no VARCHAR(32) NOT NULL,
  warehouse_id BIGINT NOT NULL,
  location_id BIGINT NOT NULL,
  movement_type VARCHAR(32) NOT NULL CHECK (movement_type IN ('receipt','egg_collection','issue','sales_issue','transfer_in','transfer_out','adjustment','reservation','release')),
  quantity NUMERIC(14,2) NOT NULL,
  unit_cost NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  source_type VARCHAR(64) NOT NULL,
  source_id VARCHAR(100) NOT NULL,
  idempotency_key VARCHAR(200) NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, source_type, source_id, movement_type, idempotency_key)
);

CREATE TABLE app_ops.inventory_valuation (
  company_id BIGINT NOT NULL,
  material_id BIGINT NOT NULL,
  batch_no VARCHAR(32) NOT NULL,
  warehouse_id BIGINT NOT NULL,
  location_id BIGINT NOT NULL,
  quantity NUMERIC(14,2) NOT NULL CHECK (quantity >= 0),
  unit_cost NUMERIC(14,4) NOT NULL CHECK (unit_cost >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, material_id, batch_no, warehouse_id, location_id)
);

CREATE TABLE app_ops.inventory_reservation (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id BIGINT NOT NULL,
  sales_order_id BIGINT NOT NULL,
  inventory_id BIGINT NOT NULL,
  quantity NUMERIC(14,2) NOT NULL CHECK (quantity > 0),
  status VARCHAR(16) NOT NULL CHECK (status IN ('reserved','released','consumed')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, sales_order_id, inventory_id)
);

CREATE TABLE app_ops.sales_order_line (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id BIGINT NOT NULL,
  sales_order_id BIGINT NOT NULL,
  line_no INTEGER NOT NULL CHECK (line_no > 0),
  material_id BIGINT NOT NULL,
  quantity NUMERIC(14,2) NOT NULL CHECK (quantity > 0),
  uom VARCHAR(32) NOT NULL,
  unit_price NUMERIC(14,2) NOT NULL CHECK (unit_price >= 0),
  line_amount NUMERIC(14,2) NOT NULL CHECK (line_amount >= 0),
  UNIQUE (company_id, sales_order_id, line_no)
);

CREATE INDEX idx_ops_flock_house ON app_ops.flock_position (house_id);
CREATE INDEX idx_ops_egg_batch_date ON app_ops.egg_collection (batch_id, collection_date);
CREATE INDEX idx_ops_movement_fefo ON app_ops.inventory_movement (company_id, material_id, batch_no, occurred_at);
CREATE INDEX idx_ops_reservation_order ON app_ops.inventory_reservation (company_id, sales_order_id, status);
CREATE INDEX idx_ops_sales_line_order ON app_ops.sales_order_line (company_id, sales_order_id);

REVOKE ALL ON SCHEMA app_ops FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA app_ops FROM PUBLIC;
