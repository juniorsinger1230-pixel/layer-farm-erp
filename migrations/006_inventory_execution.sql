CREATE TABLE app_ops.material_uom_conversion (
  company_id BIGINT NOT NULL,
  material_id BIGINT NOT NULL,
  base_uom VARCHAR(32) NOT NULL,
  pack_uom VARCHAR(100) NOT NULL,
  units_per_pack NUMERIC(14,4) NOT NULL CHECK (units_per_pack > 0),
  effective_from DATE NOT NULL,
  effective_to DATE,
  created_by VARCHAR(32) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, material_id, effective_from),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE TABLE app_ops.stocktake_line (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id BIGINT NOT NULL,
  stocktake_id BIGINT NOT NULL,
  inventory_id BIGINT NOT NULL,
  book_quantity NUMERIC(14,2) NOT NULL CHECK (book_quantity >= 0),
  actual_quantity NUMERIC(14,2) NOT NULL CHECK (actual_quantity >= 0),
  difference NUMERIC(14,2) NOT NULL,
  UNIQUE (company_id, stocktake_id, inventory_id)
);

ALTER TABLE app_ops.inventory_movement
  ADD COLUMN pack_quantity NUMERIC(14,2),
  ADD COLUMN units_per_pack NUMERIC(14,4);

CREATE INDEX idx_ops_stocktake_header ON app_ops.stocktake_line (company_id, stocktake_id);
