DO $$
DECLARE
  identity_record RECORD;
  current_max BIGINT;
BEGIN
  FOR identity_record IN
    SELECT
      n.nspname AS schema_name,
      c.relname AS table_name,
      a.attname AS column_name,
      pg_get_serial_sequence(quote_ident(n.nspname) || '.' || quote_ident(c.relname), a.attname) AS sequence_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
    WHERE c.relkind = 'r'
      AND a.attidentity IN ('a', 'd')
      AND n.nspname IN ('app', 'app_ops', 'app_auth')
  LOOP
    EXECUTE format('SELECT coalesce(max(%I), 0) FROM %I.%I',
      identity_record.column_name,
      identity_record.schema_name,
      identity_record.table_name)
    INTO current_max;

    IF current_max > 0 THEN
      EXECUTE format('SELECT setval(%L, %s, true)', identity_record.sequence_name, current_max);
    ELSE
      EXECUTE format('SELECT setval(%L, 1, false)', identity_record.sequence_name);
    END IF;
  END LOOP;
END $$;
