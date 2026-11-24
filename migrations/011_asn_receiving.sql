-- Supplier ASN receiving closure; transactional extension in app_ops.
ALTER TABLE app_ops.supplier_asn DROP CONSTRAINT supplier_asn_status_check;
ALTER TABLE app_ops.supplier_asn ADD CONSTRAINT supplier_asn_status_check CHECK (status IN ('submitted','received','rejected','cancelled'));
ALTER TABLE app_ops.supplier_asn ADD COLUMN received_at TIMESTAMPTZ;
ALTER TABLE app_ops.supplier_asn ADD COLUMN goods_receipt_id BIGINT;
CREATE INDEX idx_ops_supplier_asn_receipt ON app_ops.supplier_asn (goods_receipt_id);
