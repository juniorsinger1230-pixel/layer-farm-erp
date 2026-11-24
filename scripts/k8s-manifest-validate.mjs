import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const manifestUrl = new URL('../deploy/k8s/local-acceptance.yaml', import.meta.url);
const outputUrl = new URL('../k8s-manifest-validate-result.json', import.meta.url);
const manifestPath = decodeURIComponent(manifestUrl.pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const manifest = readFileSync(manifestPath, 'utf8');
const checks = [];
const commands = [];

function check(name, condition, detail = '') {
  checks.push({ name, ok: Boolean(condition), detail });
  if (!condition) throw new Error(`${name} failed: ${detail}`);
}

function run(name, args, acceptNonZero = false) {
  try {
    const stdout = execFileSync('kubectl', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    commands.push({ name, args, ok: true, stdout: stdout.trim() });
    checks.push({ name, ok: true });
    return stdout;
  } catch (error) {
    if (acceptNonZero) {
      commands.push({ name, args, ok: true, acceptedExitCode: error.status, stdout: error.stdout?.toString().trim(), stderr: error.stderr?.toString().trim() });
      checks.push({ name, ok: true, acceptedExitCode: error.status });
      return error.stdout?.toString() ?? '';
    }
    commands.push({ name, args, ok: false, stdout: error.stdout?.toString().trim(), stderr: error.stderr?.toString().trim(), message: error.message });
    checks.push({ name, ok: false, error: error.stderr?.toString() ?? error.message });
    throw error;
  }
}

try {
  run('kubectl client dry-run', ['apply', '--dry-run=client', '-f', manifestPath]);
  const serverJson = run('kubectl server dry-run', ['apply', '--dry-run=server', '-o', 'json', '-f', manifestPath]);
  run('kubectl diff', ['diff', '-f', manifestPath], true);
  const objects = JSON.parse(serverJson).items ?? [];
  const kinds = objects.map((item) => item.kind);
  const requiredKinds = ['Namespace', 'Service', 'StatefulSet', 'Job', 'Deployment', 'PersistentVolumeClaim', 'PodDisruptionBudget'];
  for (const kind of requiredKinds) check(`manifest includes ${kind}`, kinds.includes(kind));
  check('no Secret object in manifest', !kinds.includes('Secret'));
  check('no latest image tag', !manifest.includes(':latest') && !manifest.includes('image: latest'));
  check('no literal password field', !/password\s*:\s*(?!\s*valueFrom)/i.test(manifest));
  check('automount tokens disabled', (manifest.match(/automountServiceAccountToken:\s*false/g) ?? []).length >= 4);
  check('non-root security contexts present', manifest.includes('runAsNonRoot: true'));
  check('default seccomp profiles present', manifest.includes('type: RuntimeDefault'));
  check('capabilities dropped', manifest.includes('drop: [ALL]'));
  check('readiness probes present', (manifest.match(/readinessProbe:/g) ?? []).length >= 4);
  check('liveness probes present', (manifest.match(/livenessProbe:/g) ?? []).length >= 4);
  check('PDB objects present', kinds.filter((kind) => kind === 'PodDisruptionBudget').length >= 2);
  check('resource limits present', manifest.includes('resources:') && manifest.includes('limits:'));
  check('secret references used', manifest.includes('secretKeyRef:'));
  const result = {
    event: 'k8s_manifest_validation_passed',
    checkedAt: new Date().toISOString(),
    manifest: manifestPath,
    objectCount: objects.length,
    kindCounts: Object.fromEntries(requiredKinds.map((kind) => [kind, kinds.filter((item) => item === kind).length])),
    checks,
    commands,
  };
  writeFileSync(outputUrl, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({ event: result.event, objectCount: result.objectCount, totalChecks: checks.length }));
} catch (error) {
  const result = {
    event: 'k8s_manifest_validation_failed',
    checkedAt: new Date().toISOString(),
    manifest: manifestPath,
    checks,
    commands,
    error: error.message,
  };
  writeFileSync(outputUrl, `${JSON.stringify(result, null, 2)}\n`);
  console.error(error.message);
  process.exitCode = 1;
}
