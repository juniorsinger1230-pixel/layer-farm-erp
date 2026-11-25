import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, statfsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import pg from 'pg';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '..');
const mainDir = resolve(scriptDir, '../../../..');
const evidenceDir = resolve(mainDir, 'S0预检证据');
const composeDir = resolve(projectRoot, 'deploy/compose');
const composeFile = resolve(composeDir, 'docker-compose.yml');
const envFile = resolve(composeDir, '.env');
const applicationBaselineCommit = '4fd2b891eaa496ed73cdef69aa40ca669e476b48';
const sourceDatabase = 'layer_farm';
const projectFilter = 'layer-farm-erp-p2';
const containers = {
  postgres: 'layer-farm-erp-p2-postgres-1',
  valkey: 'layer-farm-erp-p2-valkey-1',
  api: 'layer-farm-erp-p2-api-1',
  web: 'layer-farm-erp-p2-web-1',
};

const now = new Date();
const iso = () => new Date().toISOString();

function parseEnvFile(path) {
  const result = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const index = trimmed.indexOf('=');
    result[trimmed.slice(0, index).trim()] = trimmed.slice(index + 1).trim();
  }
  return result;
}

function run(command, args = []) {
  try {
    return execFileSync(command, args, {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    return {
      __error: error.message,
      status: error.status,
      stdout: error.stdout?.toString().trim(),
      stderr: error.stderr?.toString().trim(),
    };
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function groupBy(items, keyGetter) {
  const result = {};
  for (const item of items) {
    const key = keyGetter(item);
    if (!result[key]) result[key] = [];
    result[key].push(item);
  }
  return result;
}

function unique(values) {
  return [...new Set(values)].sort();
}

function diskInfo(path) {
  const stats = statfsSync(path);
  const blockSize = stats.bsize ?? stats.f_bsize;
  const totalBlocks = stats.blocks ?? stats.f_blocks;
  const availableBlocks = stats.bavail ?? stats.f_bavail;
  return {
    path,
    totalBytes: blockSize * totalBlocks,
    availableBytes: blockSize * availableBlocks,
    availableGB: Number((blockSize * availableBlocks / 1024 ** 3).toFixed(2)),
  };
}

async function httpCheck(url, options = {}) {
  const started = performance.now();
  try {
    const response = await fetch(url, options);
    const text = await response.text();
    return {
      url,
      ok: response.ok,
      status: response.status,
      latencyMs: Number((performance.now() - started).toFixed(1)),
      bodyPreview: text.slice(0, 180),
      checkedAt: iso(),
    };
  } catch (error) {
    return { url, ok: false, error: error.message, checkedAt: iso() };
  }
}

function quoteIdent(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

const composeEnv = parseEnvFile(envFile);
const databaseUrl = `postgresql://erp:${encodeURIComponent(composeEnv.POSTGRES_PASSWORD)}@127.0.0.1:${composeEnv.POSTGRES_PORT ?? '55432'}/${sourceDatabase}`;
const pool = new pg.Pool({ connectionString: databaseUrl, max: 5 });

async function query(text, values = []) {
  return pool.query(text, values);
}

try {
  const nodeVersion = process.version;
  const npmVersion = run('npm', ['--version']);
  const gitCommit = run('git', ['rev-parse', 'HEAD']);
  const gitStatus = run('git', ['status', '--porcelain']);
  const ancestorCheck = run('git', ['merge-base', '--is-ancestor', applicationBaselineCommit, gitCommit]);
  const dockerVersion = run('docker', ['--version']);
  const composeVersion = run('docker', ['compose', 'version', '--short']);
  const dockerInfo = run('docker', ['info', '--format', '{{.ServerVersion}}|{{.Driver}}|{{.OperatingSystem}}']);
  const dockerPsLines = run('docker', ['ps', '-a', '--filter', `name=${projectFilter}`, '--format', '{{json .}}']);
  const dockerContainers = typeof dockerPsLines === 'string' && dockerPsLines
    ? dockerPsLines.split(/\r?\n/).map((line) => JSON.parse(line))
    : [];

  const apiContainerEnv = run('docker', ['inspect', containers.api, '--format', '{{range .Config.Env}}{{println .}}{{end}}']);
  const apiEnvFlags = typeof apiContainerEnv === 'string'
    ? Object.fromEntries(apiContainerEnv.split(/\r?\n/).filter(Boolean).map((line) => {
        const [key, value] = line.split('=');
        if (key === 'MFA_ENABLED') return [key, value];
        return [key, '<redacted>'];
      }))
    : { __error: apiContainerEnv };

  const [liveProbe, readyProbe, webProbe] = await Promise.all([
    httpCheck('http://127.0.0.1:3100/health/live'),
    httpCheck('http://127.0.0.1:3100/health/ready'),
    httpCheck('http://127.0.0.1:8080/'),
  ]);

  const postgresReady = run('docker', ['exec', containers.postgres, 'pg_isready', '-U', 'erp', '-d', sourceDatabase]);
  const valkeyPing = run('docker', ['exec', containers.valkey, 'valkey-cli', 'ping']);

  const migrationsResult = await query('SELECT * FROM public.schema_migration ORDER BY 1');
  const tableListResult = await query(
    `SELECT table_schema, table_name
       FROM information_schema.tables
      WHERE table_schema IN ('app','app_auth','app_ops')
        AND table_type = 'BASE TABLE'
      ORDER BY table_schema, table_name`,
  );

  const tableManifests = [];
  let totalRows = 0;
  for (const table of tableListResult.rows) {
    const qualified = `${quoteIdent(table.table_schema)}.${quoteIdent(table.table_name)}`;
    const countResult = await query(`SELECT count(*)::int AS count FROM ${qualified}`);
    const count = Number(countResult.rows[0].count);
    totalRows += count;
    tableManifests.push({ schema: table.table_schema, table: table.table_name, rowCount: count });
  }

  async function scalarCount(sql) {
    const result = await query(sql);
    return Number(result.rows[0].count);
  }

  const keyCounts = {
    company: await scalarCount('SELECT count(*)::int FROM app.company'),
    employee: await scalarCount('SELECT count(*)::int FROM app.employee'),
    systemRole: await scalarCount('SELECT count(*)::int FROM app.system_role'),
    credential: await scalarCount('SELECT count(*)::int FROM app_auth.credential'),
    session: await scalarCount('SELECT count(*)::int FROM app_auth.session'),
  };

  const schemaTables = groupBy(tableManifests, (item) => item.schema);
  const rowCountFingerprint = sha256(JSON.stringify({
    migrations: migrationsResult.rows,
    tables: tableManifests,
    keyCounts,
  }));

  const pageRegistry = readJson(resolve(projectRoot, 'apps/web/src/data/pageRegistry.json'));
  const pageApiMap = readJson(resolve(projectRoot, 'apps/web/src/generated/page-api-map.json'));
  const openApiContract = readJson(resolve(projectRoot, 'openapi-contract-check-result.json'));
  const accountMatrixPath = resolve(evidenceDir, 'S0_ACCOUNT_MATRIX.json');
  const backupResultPath = resolve(evidenceDir, 'S0_BACKUP_RESTORE_RESULT.json');
  const accountMatrix = readJson(accountMatrixPath);
  const backupResult = readJson(backupResultPath);

  const domainBreakdown = Object.fromEntries(
    Object.entries(groupBy(pageRegistry, (page) => page.domain)).map(([domain, pages]) => [
      domain,
      {
        total: pages.length,
        real: pages.filter((page) => Boolean(pageApiMap.mapped[page.pageId])).length,
        gap: pages.filter((page) => pageApiMap.gap.some((gap) => gap.pageId === page.pageId)).length,
      },
    ]),
  );

  const envBaseline = {
    event: 's0_environment_baseline_generated',
    generatedAt: iso(),
    host: {
      platform: os.platform(),
      arch: os.arch(),
      release: os.release(),
      type: os.type(),
      hostname: os.hostname(),
      cpuCount: os.cpus().length,
      cpuModel: os.cpus()[0]?.model,
      totalMemoryBytes: os.totalmem(),
      freeMemoryBytes: os.freemem(),
    },
    disks: [
      diskInfo('C:\\'),
      diskInfo('D:\\'),
    ],
    versions: {
      node: nodeVersion,
      npm: npmVersion,
      git: run('git', ['--version']),
      docker: dockerVersion,
      dockerCompose: composeVersion,
      dockerInfo,
    },
    git: {
      applicationBaselineCommit,
      actualCommit: gitCommit,
      descendantOfApplicationBaseline: ancestorCheck === '',
      workingTreeClean: typeof gitStatus === 'string' && gitStatus.length === 0,
      status: gitStatus,
    },
    containers: dockerContainers.map((container) => ({
      names: container.Names,
      image: container.Image,
      status: container.Status,
      state: container.State,
      ports: container.Ports,
      running: container.State === 'running',
    })),
    probes: {
      apiLive: liveProbe,
      apiReady: readyProbe,
      web: webProbe,
      postgresReady: typeof postgresReady === 'string' ? postgresReady : postgresReady,
      valkeyPing: typeof valkeyPing === 'string' ? valkeyPing : valkeyPing,
    },
    runtimeFlags: {
      mfa: apiEnvFlags,
      environmentFilePresent: true,
      secretKeysPresent: Object.fromEntries(
        ['POSTGRES_PASSWORD', 'JWT_SIGNING_KEY'].map((key) => [key, Boolean(composeEnv[key])]),
      ),
    },
  };

  const dataManifest = {
    event: 's0_data_manifest_generated',
    generatedAt: iso(),
    database: {
      host: '127.0.0.1',
      port: composeEnv.POSTGRES_PORT ?? '55432',
      name: sourceDatabase,
    },
    migrations: {
      count: migrationsResult.rows.length,
      rows: migrationsResult.rows,
    },
    schemas: Object.fromEntries(
      Object.entries(schemaTables).map(([schema, rows]) => [
        schema,
        { tableCount: rows.length, rowCount: rows.reduce((sum, item) => sum + item.rowCount, 0) },
      ]),
    ),
    tableCount: tableManifests.length,
    totalRows,
    keyCounts,
    tables: tableManifests,
    rowCountFingerprint,
    backup: {
      resultFile: backupResultPath,
      status: backupResult.result,
      backupFile: backupResult.backupFile,
      countVerification: backupResult.countVerification,
    },
  };

  const coverageMatrix = {
    event: 's0_coverage_matrix_generated',
    generatedAt: iso(),
    pages: {
      total: pageRegistry.length,
      domains: unique(pageRegistry.map((page) => page.domain)),
      domainCount: unique(pageRegistry.map((page) => page.domain)).length,
      real: pageApiMap.mappedCount,
      gap: pageApiMap.gapCount,
      priorities: Object.fromEntries(
        Object.entries(groupBy(pageRegistry, (page) => page.priority)).map(([priority, pages]) => [priority, pages.length]),
      ),
      patterns: Object.fromEntries(
        Object.entries(groupBy(pageRegistry, (page) => page.pattern)).map(([pattern, pages]) => [pattern, pages.length]),
      ),
      domainBreakdown,
      gapIds: pageApiMap.gap.map((gap) => gap.pageId),
      gapDetails: pageApiMap.gap,
    },
    openApi: {
      status: openApiContract.status,
      authoritativePaths: openApiContract.authoritative.paths,
      authoritativeOperations: openApiContract.authoritative.operations,
      implementationOperations: openApiContract.implementation.totalApiOperations,
      matchedOperations: openApiContract.matched.operations,
      coverage: openApiContract.matched.coverage,
      sourceResult: resolve(projectRoot, 'openapi-contract-check-result.json'),
    },
    accounts: {
      total: accountMatrix.total,
      passCount: accountMatrix.passCount,
      allPassed: accountMatrix.allPassed,
      negativeAuthBlocked: accountMatrix.negativeAuthBlocked,
    },
  };

  const requiredFiles = [
    'package.json',
    'package-lock.json',
    'Dockerfile',
    'deploy/compose/docker-compose.yml',
    'deploy/compose/.env',
    'apps/web/src/data/pageRegistry.json',
    'apps/web/src/generated/page-api-map.json',
    'openapi-contract-check-result.json',
  ].map((relativePath) => {
    const absolutePath = resolve(projectRoot, relativePath);
    let present = false;
    try {
      readFileSync(absolutePath);
      present = true;
    } catch {
      present = false;
    }
    return { path: relativePath, present };
  });

  const toolchainCheck = {
    event: 's0_toolchain_check_generated',
    generatedAt: iso(),
    versions: envBaseline.versions,
    requiredFiles,
    requiredEnvKeys: ['POSTGRES_PASSWORD', 'JWT_SIGNING_KEY', 'POSTGRES_PORT', 'API_PORT', 'WEB_PORT', 'VALKEY_PORT'].map((key) => ({
      key,
      present: Boolean(composeEnv[key]),
    })),
    commands: [
      { name: 'node', ok: /^v\d+/.test(nodeVersion), version: nodeVersion },
      { name: 'npm', ok: typeof npmVersion === 'string', version: npmVersion },
      { name: 'git', ok: typeof gitCommit === 'string' && gitCommit.length > 0, version: envBaseline.versions.git },
      { name: 'docker', ok: typeof dockerVersion === 'string', version: dockerVersion },
      { name: 'docker compose', ok: typeof composeVersion === 'string', version: composeVersion },
    ],
    serviceCommands: {
      postgresReady: postgresReady,
      valkeyPing,
    },
  };

  const checks = [
    {
      id: 'GIT_BASELINE',
      status: envBaseline.git.descendantOfApplicationBaseline && envBaseline.git.workingTreeClean ? 'PASS' : 'FAIL',
      gateEffect: 'blocking',
      details: envBaseline.git,
    },
    {
      id: 'DOCKER_STACK',
      status: ['postgres', 'valkey', 'api', 'web'].every((key) => dockerContainers.some((item) => item.Names.includes(containers[key]) && item.State === 'running')) ? 'PASS' : 'FAIL',
      gateEffect: 'blocking',
      details: envBaseline.containers,
    },
    {
      id: 'SERVICE_PROBES',
      status: liveProbe.ok && readyProbe.ok && webProbe.ok && String(postgresReady).includes('accepting connections') && valkeyPing === 'PONG' ? 'PASS' : 'FAIL',
      gateEffect: 'blocking',
      details: envBaseline.probes,
    },
    {
      id: 'SECRET_KEYS',
      status: ['POSTGRES_PASSWORD', 'JWT_SIGNING_KEY'].every((key) => Boolean(composeEnv[key])) ? 'PASS' : 'FAIL',
      gateEffect: 'blocking',
      details: envBaseline.runtimeFlags.secretKeysPresent,
    },
    {
      id: 'ACCOUNT_MATRIX',
      status: accountMatrix.allPassed ? 'PASS' : 'FAIL',
      gateEffect: 'blocking',
      details: {
        total: accountMatrix.total,
        passCount: accountMatrix.passCount,
        negativeAuthBlocked: accountMatrix.negativeAuthBlocked,
        source: accountMatrixPath,
      },
    },
    {
      id: 'DATABASE_MANIFEST',
      status: migrationsResult.rows.length === 17 && tableManifests.length === 107 ? 'PASS' : 'FAIL',
      gateEffect: 'blocking',
      details: {
        migrationCount: migrationsResult.rows.length,
        tableCount: tableManifests.length,
        totalRows,
        keyCounts,
        rowCountFingerprint,
      },
    },
    {
      id: 'BACKUP_RESTORE',
      status: backupResult.result === 'passed' ? 'PASS' : 'FAIL',
      gateEffect: 'blocking',
      details: backupResult,
    },
    {
      id: 'OPENAPI_CONTRACT',
      status: openApiContract.status === 'pass' ? 'PASS' : 'FAIL',
      gateEffect: 'blocking',
      details: coverageMatrix.openApi,
    },
    {
      id: 'PAGE_GAP_COVERAGE',
      status: 'WARN',
      gateEffect: 'non-blocking-for-THL-REAL-P0',
      details: {
        total: pageApiMap.total,
        real: pageApiMap.mappedCount,
        gap: pageApiMap.gapCount,
        gapIds: coverageMatrix.pages.gapIds,
        limitation: '不得宣称87个页面全部具备业务闭环能力。',
      },
    },
    {
      id: 'TGE_CROSS_COMPANY',
      status: 'BLOCKED',
      gateEffect: 'blocks-TGE-only-tests',
      details: {
        companyCount: keyCounts.company,
        limitation: '当前仅具备THL范围，TGE第二公司及跨公司隔离用例不可执行。',
      },
    },
    {
      id: 'C_DRIVE_SPACE',
      status: diskInfo('C:\\').availableGB >= 30 ? 'PASS' : 'WARN',
      gateEffect: 'non-blocking-after-successful-build-and-backup',
      details: diskInfo('C:\\'),
    },
    {
      id: 'PHYSICAL_PRINTING',
      status: 'DEFERRED',
      gateEffect: 'customer-site-verification',
      details: '按用户口径，上线后在客户现场验证物理打印、扫码和蓝牙设备。',
    },
    {
      id: 'UAT_AND_RELEASE_AUTHORIZATION',
      status: 'EXCLUDED',
      gateEffect: 'not-part-of-current-gate',
      details: '按用户口径，本轮不考虑业务UAT或最终发布授权。',
    },
  ];

  const blockingFailures = checks.filter((check) => check.status === 'FAIL' && check.gateEffect === 'blocking');
  const preflightResult = {
    event: 's0_preflight_result_generated',
    generatedAt: iso(),
    gateStatus: blockingFailures.length === 0 ? 'PASS_WITH_WARNINGS' : 'FAIL',
    canEnterP0: blockingFailures.length === 0,
    p0Scope: 'THL范围内真实API、认证会话、RBAC、REAL页面和后端服务P0测试',
    p0Executed: false,
    blockingFailures: blockingFailures.map((check) => ({ id: check.id, details: check.details })),
    warningsAndExclusions: checks
      .filter((check) => ['WARN', 'BLOCKED', 'DEFERRED', 'EXCLUDED'].includes(check.status))
      .map((check) => ({ id: check.id, status: check.status, gateEffect: check.gateEffect, details: check.details })),
    checks,
    evidenceFiles: [
      'S0_ENV_BASELINE.json',
      'S0_DATA_MANIFEST.json',
      'S0_ACCOUNT_MATRIX.json',
      'S0_COVERAGE_MATRIX.json',
      'S0_TOOLCHAIN_CHECK.json',
      'S0_BACKUP_RESTORE_RESULT.json',
      'S0_PREFLIGHT_RESULT.json',
    ],
  };

  writeJson(resolve(evidenceDir, 'S0_ENV_BASELINE.json'), envBaseline);
  writeJson(resolve(evidenceDir, 'S0_DATA_MANIFEST.json'), dataManifest);
  writeJson(resolve(evidenceDir, 'S0_COVERAGE_MATRIX.json'), coverageMatrix);
  writeJson(resolve(evidenceDir, 'S0_TOOLCHAIN_CHECK.json'), toolchainCheck);
  writeJson(resolve(evidenceDir, 'S0_PREFLIGHT_RESULT.json'), preflightResult);

  console.log(JSON.stringify({
    event: 's0_evidence_generation_ready',
    evidenceDir,
    gateStatus: preflightResult.gateStatus,
    canEnterP0: preflightResult.canEnterP0,
    blockingFailures: blockingFailures.length,
    warnings: preflightResult.warningsAndExclusions.length,
  }, null, 2));
} finally {
  await pool.end();
}
