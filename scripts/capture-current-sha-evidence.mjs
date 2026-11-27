import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSourceRevision, sha256File } from './source-revision.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const options = parseArgs(process.argv.slice(2));
const logPath = resolve(root, options['test-log'] ?? 'gate-local-step7.txt');
const evidenceDir = resolve(root, options.out ?? 'current-sha-evidence');
const coveragePath = join(root, 'coverage', 'coverage-summary.json');
const contractPath = join(root, 'openapi-contract-check-result.json');
const source = getSourceRevision(root);
const coverage = JSON.parse(readFileSync(coveragePath, 'utf8'));
const contract = JSON.parse(readFileSync(contractPath, 'utf8'));
const testLog = readFileSync(logPath, 'utf8');
const tests = Object.fromEntries(['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo'].map((name) => [name, readCount(testLog, name)]));
const provenancePass = source.trackedWorktreeClean && contract.sourceRevision?.sha === source.sha && contract.sourceRevision?.trackedWorktreeClean === true;
const testsPass = tests.tests > 0 && tests.pass === tests.tests && tests.fail === 0 && tests.cancelled === 0;
const manifest = {
  generatedAt: new Date().toISOString(),
  sourceRevision: source,
  status: provenancePass && testsPass && contract.status === 'pass' ? 'pass' : 'fail',
  commands: [
    'npm run contract:check',
    'npm run contract:report',
    'npm run test:coverage',
    'npm run evidence:current-sha -- --test-log=gate-local-step7.txt',
  ],
  tests,
  coverage: {
    scope: 'Only apps/api/src and packages files loaded by tests; apps/web and unloaded files are excluded. This is not full-system or functional coverage.',
    summarySha256: sha256File(coveragePath),
    total: coverage.total,
  },
  contract: {
    resultSha256: sha256File(contractPath),
    status: contract.status,
    checkedAt: contract.checkedAt,
    authoritativeOperations: contract.authoritative.operations,
    implementationOperations: contract.implementation.totalApiOperations,
    matchedOperations: contract.matched.operations,
    coverage: contract.matched.coverage,
    missing: contract.route.missingContractOperations.length,
    undocumented: contract.route.undocumentedOperations.length,
    readOnlyWriteExposures: contract.route.readOnlyWriteExposures.length,
    schemaErrors: contract.fieldSchema.errors.length,
    parameterErrors: contract.fieldSchema.parameterErrors.length,
    statusErrors: contract.statusCodes.errors.length,
  },
  excludedHistoricalMetrics: ['58 REAL + 29 GAP', '481 operations', 'historical coverage snapshots'],
};
mkdirSync(evidenceDir, { recursive: true });
copyFileSync(coveragePath, join(evidenceDir, 'coverage-summary.json'));
copyFileSync(contractPath, join(evidenceDir, 'openapi-contract-check-result.json'));
copyFileSync(logPath, join(evidenceDir, 'test-coverage-output.txt'));
writeFileSync(join(evidenceDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest, null, 2));
if (manifest.status !== 'pass') process.exitCode = 1;

function readCount(text, name) {
  const match = text.match(new RegExp(`^# ${name} (\\d+)$`, 'm'));
  if (!match) throw new Error(`Missing Node test summary field: ${name}`);
  return Number(match[1]);
}

function parseArgs(args) {
  const parsed = {};
  for (const arg of args) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
