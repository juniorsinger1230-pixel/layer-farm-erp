param([switch]$Clean)
$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$composeEnvPath = Join-Path $root 'deploy\compose\.env'
if (-not (Test-Path -LiteralPath $composeEnvPath)) {
  throw "Missing Compose environment file: $composeEnvPath"
}

$composeEnv = @{}
Get-Content -LiteralPath $composeEnvPath | ForEach-Object {
  if ($_ -match '^\s*([A-Z_]+)\s*=\s*(.*)$') {
    $composeEnv[$matches[1]] = $matches[2].Trim()
  }
}

$pgPassword = $composeEnv['POSTGRES_PASSWORD']
if (-not $pgPassword) { throw 'POSTGRES_PASSWORD is required in Compose .env' }
$pgPort = if ($composeEnv['POSTGRES_PORT']) { $composeEnv['POSTGRES_PORT'] } else { '55432' }
$valkeyPort = if ($composeEnv['VALKEY_PORT']) { $composeEnv['VALKEY_PORT'] } else { '56379' }

$dockerCommand = Get-Command docker -ErrorAction SilentlyContinue
if ($dockerCommand) {
  $dockerExe = $dockerCommand.Source
} else {
  $dockerExe = 'C:\Users\龚\AppData\Local\Programs\DockerDesktop\resources\bin\docker.exe'
}
if (-not (Test-Path -LiteralPath $dockerExe)) { throw 'Docker CLI was not found' }

$postgresContainer = 'layer-farm-erp-postgres-1'
$null = & $dockerExe inspect $postgresContainer
if ($LASTEXITCODE -ne 0) { throw "PostgreSQL container is not available: $postgresContainer" }

if (-not (Test-Path -LiteralPath 'C:\tmp')) {
  New-Item -ItemType Directory -Path 'C:\tmp' | Out-Null
}

$occupiedPorts = 3213..3217 | ForEach-Object {
  Get-NetTCPConnection -LocalPort $_ -ErrorAction SilentlyContinue |
    Where-Object { $_.State -ne 'TimeWait' -and $_.OwningProcess -gt 0 }
}
if ($occupiedPorts) {
  throw 'Required HTTP ports 3213-3217 are not all available'
}

$targets = @(
  [pscustomobject]@{ Database = 'layer_erp_real19'; ValkeyDb = 1; Script = 'real-wp07-http-test.mjs'; Output = 'real19-local-wp07-output.txt' },
  [pscustomobject]@{ Database = 'layer_erp_real20'; ValkeyDb = 2; Script = 'real-wp08-http-test.mjs'; Output = 'real20-local-wp08-output.txt' },
  [pscustomobject]@{ Database = 'layer_erp_real21'; ValkeyDb = 3; Script = 'real-wp09-http-test.mjs'; Output = 'real21-local-wp09-output.txt' },
  [pscustomobject]@{ Database = 'layer_erp_real23'; ValkeyDb = 4; Script = 'real-wp10-http-test.mjs'; Output = 'real23-local-wp10-output.txt' },
  [pscustomobject]@{ Database = 'layer_erp_real25'; ValkeyDb = 5; Script = 'real-wp11-http-test.mjs'; Output = 'real25-local-wp11-output.txt' }
)

$results = @()
foreach ($target in $targets) {
  Write-Host "=== Preparing $($target.Database) ==="
  if ($Clean) {
    & $dockerExe exec -e PGPASSWORD="$pgPassword" $postgresContainer psql -U erp -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$($target.Database)' AND pid <> pg_backend_pid()"
    if ($LASTEXITCODE -ne 0) { throw "Failed to terminate connections to $($target.Database)" }
    & $dockerExe exec -e PGPASSWORD="$pgPassword" $postgresContainer psql -U erp -d postgres -c "DROP DATABASE IF EXISTS `"$($target.Database)`""
    if ($LASTEXITCODE -ne 0) { throw "Failed to drop $($target.Database)" }
  }
  & $dockerExe exec layer-farm-erp-valkey-1 redis-cli -n $target.ValkeyDb FLUSHDB
  if ($LASTEXITCODE -ne 0) { throw "Failed to flush isolated Valkey database $($target.ValkeyDb)" }
  $exists = & $dockerExe exec -e PGPASSWORD="$pgPassword" $postgresContainer psql -U erp -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$($target.Database)'"
  if ($LASTEXITCODE -ne 0) { throw "Failed to query database $($target.Database)" }
  if ([string]::IsNullOrWhiteSpace(($exists -join ''))) {
    & $dockerExe exec -e PGPASSWORD="$pgPassword" $postgresContainer psql -U erp -d postgres -c "CREATE DATABASE `"$($target.Database)`" ENCODING 'UTF8'"
    if ($LASTEXITCODE -ne 0) { throw "Failed to create database $($target.Database)" }
  }

  $databaseUrl = "postgresql://erp:$pgPassword@127.0.0.1:$pgPort/$($target.Database)"
  $valkeyUrl = "redis://127.0.0.1:$valkeyPort/$($target.ValkeyDb)"
  $env:DATABASE_URL = $databaseUrl
  $env:VALKEY_URL = $valkeyUrl

  Write-Host "=== Migrating $($target.Database) ==="
  node (Join-Path $root 'scripts\run-migrations.mjs')
  if ($LASTEXITCODE -ne 0) { throw "Migration failed for $($target.Database)" }

  Write-Host "=== Running $($target.Script) ==="
  $outputPath = Join-Path $root $target.Output
  node (Join-Path $root "scripts\$($target.Script)") *>&1 | Tee-Object -FilePath $outputPath
  if ($LASTEXITCODE -ne 0) { throw "Real HTTP regression failed: $($target.Script)" }

  $results += [pscustomobject]@{
    Database = $target.Database
    Script = $target.Script
    Output = $target.Output
    Status = 'passed'
  }
}

$results | Format-Table -AutoSize
