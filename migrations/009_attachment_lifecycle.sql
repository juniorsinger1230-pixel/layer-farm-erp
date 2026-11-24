ALTER TABLE app.attachment
  ADD COLUMN retention_until TIMESTAMPTZ,
  ADD COLUMN destroyed_at TIMESTAMPTZ;

ALTER TABLE app.attachment
  ADD CONSTRAINT attachment_destroy_after_retention_check
  CHECK (destroyed_at IS NULL OR (retention_until IS NOT NULL AND destroyed_at >= retention_until));

CREATE INDEX attachment_retention_pending_idx
  ON app.attachment (retention_until, company_code)
  WHERE destroyed_at IS NULL AND retention_until IS NOT NULL;
