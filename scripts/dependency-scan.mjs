import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  evaluateDependencies,
  loadPolicy,
  normalizeAuditVulnerabilities,
  validateWaivers,
} from './quality-policy-lib.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const now = new Date();
const policy = loadPolicy(root);
const waiverErrors = validateWaivers(policy, now);
const audit = spawnSync(
  'npm',
  ['audit', '--registry', policy.dependencyScan.registry, '--json'],
  {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    shell: process.platform === 'win32',
  },
);
if (!audit.stdout) {
  throw new Error(audit.error?.message ?? 'npm audit returned no machine-readable result');
}
const auditJson = JSON.parse(audit.stdout);
const vulnerabilities = normalizeAuditVulnerabilities(auditJson);
const evaluation = evaluateDependencies(policy, vulnerabilities, now);
const result = {
  scannedAt: now.toISOString(),
  registry: policy.dependencyScan.registry,
  failOnSeverity: policy.dependencyScan.failOnSeverity,
  metadata: auditJson.metadata,
  vulnerabilities,
  waived: evaluation.waived,
  highRiskTracking: evaluation.highRiskTracking,
  waiverErrors,
  pass: evaluation.pass && waiverErrors.length === 0,
};
writeFileSync(join(root, 'sca-scan-result.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify({
  output: 'sca-scan-result.json',
  vulnerabilities: vulnerabilities.length,
  unresolved: evaluation.unresolved.length,
  waived: evaluation.waived.length,
  highRisk: evaluation.highRiskTracking.length,
  pass: result.pass,
}, null, 2));
if (!result.pass) process.exitCode = 1;
