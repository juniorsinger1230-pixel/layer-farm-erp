CREATE TABLE IF NOT EXISTS schema_migration (
  id TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  checksum TEXT NOT NULL,
  CONSTRAINT schema_migration_checksum_sha256 CHECK (checksum ~ '^[0-9a-f]{64}$')
);

COMMENT ON TABLE schema_migration IS 'Technical migration registry; PostgreSQL adapter is implemented in WP-01.';
