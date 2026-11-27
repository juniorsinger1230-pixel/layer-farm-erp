import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

function run(executable, args, options = {}) {
  return execFileSync(executable, args, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, ...options }).trim();
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
  const payload = {
    capturedAt: new Date().toISOString(),
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
    services: captureComposeServices(dockerPath, composeFile, projectName),
    database: captureDatabaseState(dockerPath, projectName),
    readiness: await captureReadyState(apiBaseUrl),
    companyCode: 'THL',
  };
  const formSchemaPath = path.join(root, 'apps/web/src/generated/form-schemas.json');
  if (existsSync(formSchemaPath)) payload.formSchema = { path: 'apps/web/src/generated/form-schemas.json' };
  const target = path.join(targetDirectory, `${caseDefinition.id}.json`);
  writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`);
  return target;
}
