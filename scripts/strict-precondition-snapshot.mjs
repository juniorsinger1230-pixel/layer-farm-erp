import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';

export const runtimeMode = process.env.STRICT_RUNTIME_MODE === 'native' ? 'native' : 'compose';

function run(executable, args, options = {}) {
  return execFileSync(executable, args, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, ...options }).trim();
}

function sanitizeUrl(value) {
  try {
    const url = new URL(value);
    if (url.password) url.password = '***';
    return url.toString();
  } catch {
    return value;
  }
}

export function captureSource(root, gitPath) {
  const git = (args) => run(gitPath, ['-C', root, ...args]);
  const status = git(['status', '--porcelain']);
  return {
    commitSha: git(['rev-parse', 'HEAD']),
    treeSha: git(['rev-parse', 'HEAD^{tree}']),
    branch: git(['branch', '--show-current']),
    worktreeClean: status === '',
    worktreeStatus: status ? status.split(/\r?\n/) : [],
  };
}

export function captureComposeServices(dockerPath, composeFile, projectName) {
  const output = run(dockerPath, ['compose', '-p', projectName, '-f', composeFile, 'ps', '--format', '{{json .}}']);
  return output.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

export function captureNativeServices() {
  const apiBaseUrl = process.env.API_BASE_URL ?? 'http://127.0.0.1:3100';
  const webBaseUrl = process.env.WEB_BASE_URL ?? 'http://127.0.0.1:8088';
  return [
    {
      name: 'postgres',
      type: 'postgresql',
      status: 'configured',
      url: process.env.DATABASE_URL ? sanitizeUrl(process.env.DATABASE_URL) : null,
    },
    {
      name: 'valkey',
      type: 'redis-protocol',
      status: 'configured',
      url: process.env.VALKEY_URL ? sanitizeUrl(process.env.VALKEY_URL) : null,
    },
    { name: 'api', type: 'node-hono', status: 'configured', url: apiBaseUrl },
    { name: 'web', type: 'caddy-static', status: 'configured', url: webBaseUrl },
  ];
}

export function psql(dockerPath, projectName, sql) {
  return run(dockerPath, [
    'exec',
    `${projectName}-postgres-1`,
    'psql',
    '-U',
    'erp',
    '-d',
    'layer_farm',
    '-t',
    '-A',
    '-c',
    sql,
  ]);
}

export function captureDatabaseState(dockerPath, projectName) {
  const tableCountsSql = `
    SELECT json_agg(
      json_build_object(
        'schema', schemaname,
        'table', relname,
        'rowCount', (xpath('/row/cnt/text()', query_to_xml(format('SELECT count(*) AS cnt FROM %I.%I', schemaname, relname), false, true, '')))[1]::text::int
      ) ORDER BY schemaname, relname
    )
    FROM pg_stat_user_tables;
  `;
  const tableCounts = JSON.parse(psql(dockerPath, projectName, tableCountsSql));
  const migrationCount = Number(psql(dockerPath, projectName, 'SELECT count(*) FROM schema_migration;'));
  return { capturedAt: new Date().toISOString(), migrationCount, tableCounts };
}

export async function captureNativeDatabaseState(databaseUrl) {
  if (!databaseUrl) throw new Error('DATABASE_URL is required in native strict runtime');
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 });
  try {
    const tableCountsSql = `
      SELECT COALESCE(json_agg(
        json_build_object(
          'schema', schemaname,
          'table', relname,
          'rowCount', (xpath('/row/cnt/text()', query_to_xml(format('SELECT count(*) AS cnt FROM %I.%I', schemaname, relname), false, true, '')))[1]::text::int
        ) ORDER BY schemaname, relname
      ), '[]'::json)
      FROM pg_stat_user_tables;
    `;
    const tableCounts = (await pool.query(tableCountsSql)).rows[0].coalesce;
    const migrationCount = (await pool.query('SELECT count(*)::int AS count FROM schema_migration;')).rows[0].count;
    return { capturedAt: new Date().toISOString(), migrationCount, tableCounts };
  } finally {
    await pool.end();
  }
}

export async function captureReadyState(apiBaseUrl) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(`${apiBaseUrl}/health/ready`);
      return { status: response.status, body: await response.json(), attempt };
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw lastError;
}

export async function captureCasePrecondition({
  caseDefinition,
  root,
  targetDirectory,
  gitPath,
  dockerPath,
  composeFile,
  projectName,
  apiBaseUrl,
}) {
  mkdirSync(targetDirectory, { recursive: true });
  const services = runtimeMode === 'native'
    ? captureNativeServices()
    : captureComposeServices(dockerPath, composeFile, projectName);
  const database = runtimeMode === 'native'
    ? await captureNativeDatabaseState(process.env.DATABASE_URL)
    : captureDatabaseState(dockerPath, projectName);
  const payload = {
    capturedAt: new Date().toISOString(),
    runtimeMode,
    caseId: caseDefinition.id,
    caseDefinition: {
      id: caseDefinition.id,
      stage: caseDefinition.stage,
      pageId: caseDefinition.pageId,
      pageType: caseDefinition.pageType,
      operation: caseDefinition.operation,
      precondition: caseDefinition.precondition,
      apiPath: caseDefinition.apiPath,
    },
    source: captureSource(root, gitPath),
    services,
    database,
    readiness: await captureReadyState(apiBaseUrl),
    companyCode: 'THL',
  };
  const formSchemaPath = path.join(root, 'apps/web/src/generated/form-schemas.json');
  if (existsSync(formSchemaPath)) payload.formSchema = { path: 'apps/web/src/generated/form-schemas.json' };
  const target = path.join(targetDirectory, `${caseDefinition.id}.json`);
  writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`);
  return target;
}
