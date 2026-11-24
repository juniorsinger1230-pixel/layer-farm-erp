$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$dockerExe = 'C:\Users\龚\AppData\Local\Programs\DockerDesktop\resources\bin\docker.exe'
$postgresContainer = 'layer-farm-erp-postgres-1'
$sourceDatabase = 'layer_erp_real23'
$targetDatabase = 'layer_erp_real24'
$backupPath = Join-Path $projectRoot 'local-logical-backup-real23.json'

$envFile = Join-Path $projectRoot 'deploy\compose\.env'
$composeEnv = @{}
Get-Content -LiteralPath $envFile | ForEach-Object {
  if ($_ -match '^\s*([A-Z_]+)\s*=\s*(.*)$') { $composeEnv[$matches[1]] = $matches[2].Trim() }
}
$pgPort = $composeEnv['POSTGRES_PORT']
$pgPassword = $composeEnv['POSTGRES_PASSWORD']

$targetExists = & $dockerExe exec -e PGPASSWORD="$pgPassword" $postgresContainer psql -U erp -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$targetDatabase'"
if ($targetExists -eq '1') { throw "Target database $targetDatabase already exists; refusing to overwrite" }
& $dockerExe exec -e PGPASSWORD="$pgPassword" $postgresContainer psql -U erp -d postgres -c "CREATE DATABASE $targetDatabase"
if ($LASTEXITCODE -ne 0) { throw "Failed to create $targetDatabase" }

$env:DATABASE_URL = "postgresql://erp:$pgPassword@127.0.0.1:$pgPort/$targetDatabase"
node (Join-Path $projectRoot 'scripts\run-migrations.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Failed to migrate restore target' }

$env:DATABASE_URL = "postgresql://erp:$pgPassword@127.0.0.1:$pgPort/$sourceDatabase"
node (Join-Path $projectRoot 'scripts\backup-database.mjs') $backupPath
if ($LASTEXITCODE -ne 0) { throw 'Backup failed' }

$env:DATABASE_URL = "postgresql://erp:$pgPassword@127.0.0.1:$pgPort/$targetDatabase"
node (Join-Path $projectRoot 'scripts\restore-database.mjs') $backupPath
if ($LASTEXITCODE -ne 0) { throw 'Restore failed' }

$env:SOURCE_DATABASE_URL = "postgresql://erp:$pgPassword@127.0.0.1:$pgPort/$sourceDatabase"
$env:TARGET_DATABASE_URL = "postgresql://erp:$pgPassword@127.0.0.1:$pgPort/$targetDatabase"
node (Join-Path $projectRoot 'scripts\verify-backup-restore-counts.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Backup/restore count verification failed' }
