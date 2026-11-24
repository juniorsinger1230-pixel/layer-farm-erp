$ErrorActionPreference = 'Stop'
$dockerExe = 'C:\Users\龚\AppData\Local\Programs\DockerDesktop\resources\bin\docker.exe'
$apiBase = 'http://127.0.0.1:3100'
$results = @()

function Get-HealthStatus($path) {
  try {
    $response = Invoke-WebRequest -Uri "$apiBase$path" -UseBasicParsing -TimeoutSec 5
    return @{ statusCode = $response.StatusCode; body = $response.Content }
  } catch {
    $response = $_.Exception.Response
    if ($response) {
      return @{ statusCode = [int]$response.StatusCode; body = $_.ErrorDetails.Message }
    }
    throw
  }
}
function Wait-ContainerHealthy($container) {
  $deadline = (Get-Date).AddSeconds(60)
  while ((Get-Date) -lt $deadline) {
    $health = & $dockerExe inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' $container
    if ($health -eq 'healthy' -or $health -eq 'running') { return }
    Start-Sleep -Milliseconds 500
  }
  throw "Container $container did not become healthy"
}
function Wait-Ready($expected) {
  $deadline = (Get-Date).AddSeconds(30)
  while ((Get-Date) -lt $deadline) {
    $ready = Get-HealthStatus '/health/ready'
    if ($ready.statusCode -eq $expected) { return $ready }
    Start-Sleep -Milliseconds 500
  }
  throw "Ready endpoint did not reach expected status $expected"
}

$baselineReady = Wait-Ready 200
$results += [pscustomobject]@{ scenario = 'baseline'; live = (Get-HealthStatus '/health/live').statusCode; ready = $baselineReady.statusCode; expected = '200'; result = 'passed' }

& $dockerExe stop layer-farm-erp-valkey-1 | Out-Null
$valkeyDown = Wait-Ready 503
$results += [pscustomobject]@{ scenario = 'valkey stopped'; live = (Get-HealthStatus '/health/live').statusCode; ready = $valkeyDown.statusCode; expected = 'live=200,ready=503'; result = 'passed' }
& $dockerExe start layer-farm-erp-valkey-1 | Out-Null
Wait-ContainerHealthy 'layer-farm-erp-valkey-1'
$valkeyRecovered = Wait-Ready 200
$results += [pscustomobject]@{ scenario = 'valkey recovered'; live = (Get-HealthStatus '/health/live').statusCode; ready = $valkeyRecovered.statusCode; expected = '200'; result = 'passed' }

& $dockerExe stop layer-farm-erp-postgres-1 | Out-Null
$postgresDown = Wait-Ready 503
$results += [pscustomobject]@{ scenario = 'postgres stopped'; live = (Get-HealthStatus '/health/live').statusCode; ready = $postgresDown.statusCode; expected = 'live=200,ready=503'; result = 'passed' }
& $dockerExe start layer-farm-erp-postgres-1 | Out-Null
Wait-ContainerHealthy 'layer-farm-erp-postgres-1'
$postgresRecovered = Wait-Ready 200
$results += [pscustomobject]@{ scenario = 'postgres recovered'; live = (Get-HealthStatus '/health/live').statusCode; ready = $postgresRecovered.statusCode; expected = '200'; result = 'passed' }

$output = [pscustomobject]@{ result = 'passed'; evidence = $results.Count; items = $results }
$output | ConvertTo-Json -Depth 5
