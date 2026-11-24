import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateCoverage, loadPolicy, validateWaivers } from './quality-policy-lib.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const policy = loadPolicy(root);
const coverageSummary = JSON.parse(readFileSync(join(root, 'coverage', 'coverage-summary.json'), 'utf8'));
const sca = JSON.parse(readFileSync(join(root, 'sca-scan-result.json'), 'utf8'));
const sbom = JSON.parse(readFileSync(join(root, 'sbom', 'sbom.cdx.json'), 'utf8'));
const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));
const expectedComponents = Object.keys(lock.packages)
  .filter((path) => path.startsWith('node_modules/') && lock.packages[path].version && !lock.packages[path].link)
  .length;
const waiverErrors = validateWaivers(policy);
const coverage = evaluateCoverage(policy, coverageSummary.total);
const sbomChecks = {
  expectedComponents,
  actualComponents: sbom.components?.length ?? 0,
  format: sbom.bomFormat,
  specVersion: sbom.specVersion,
  pass: sbom.components?.length === expectedComponents && sbom.bomFormat === 'CycloneDX',
};
const result = {
  evaluatedAt: new Date().toISOString(),
  coverage,
  sca: { pass: sca.pass === true, highRiskTracking: sca.highRiskTracking, waived: sca.waived },
  sbom: sbomChecks,
  waiverErrors,
  pass: coverage.pass && sca.pass === true && sbomChecks.pass && waiverErrors.length === 0,
};
writeFileSync(join(root, 'quality-gate-result.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
if (!result.pass) process.exitCode = 1;
