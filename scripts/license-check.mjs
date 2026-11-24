import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));
const allowed = /^(MIT|ISC|Apache-2\.0|BSD-2-Clause|BSD-3-Clause|0BSD|CC0-1\.0|CC-BY-4\.0|BlueOak-1\.0\.0|Python-2\.0|Zlib)$/;
const isAllowedExpression = (value) => {
  const expression = String(value).trim();
  if (!/^[A-Za-z0-9.()\-\s]+$/.test(expression)) return false;
  const tokens = expression.replace(/[()]/g, ' ').split(/\s+/).filter(Boolean);
  return tokens.length > 0 && tokens.every((token) => token === 'AND' || token === 'OR' || allowed.test(token));
};
const findings = [];
const components = [];
for (const [path, meta] of Object.entries(lock.packages)) {
  if (!path.startsWith('node_modules/') || meta.link) continue;
  const manifestPath = join(root, path, 'package.json');
  let manifest;
  if (existsSync(manifestPath)) {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } else if (meta.optional && meta.version && meta.license) {
    manifest = { name: path.slice(path.lastIndexOf('node_modules/') + 'node_modules/'.length), version: meta.version, license: meta.license };
  } else {
    findings.push({ package: path, issue: 'MISSING_PACKAGE_MANIFEST' });
    continue;
  }
  let licenses = Array.isArray(manifest.license)
    ? manifest.license.map((item) => item.type ?? String(item))
    : [typeof manifest.license === 'object' ? manifest.license?.type : manifest.license ?? manifest.licenses];
  const licenseFile = join(root, path, 'LICENSE');
  if (licenses.flat().filter(Boolean).length === 0 && existsSync(licenseFile) && readFileSync(licenseFile, 'utf8').startsWith('MIT License')) licenses = ['MIT'];
  for (const license of licenses.flat().filter(Boolean)) {
    if (!isAllowedExpression(license)) findings.push({ package: `${manifest.name}@${manifest.version}`, license });
  }
  if (licenses.flat().filter(Boolean).length === 0) findings.push({ package: path, issue: 'UNKNOWN_LICENSE' });
  components.push({ name: manifest.name, version: manifest.version, licenses: licenses.flat().filter(Boolean), integrity: meta.integrity ?? null });
}
const result = { dependencyCount: components.length, findings, pass: findings.length === 0 };
writeFileSync(join(root, 'license-check-result.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ dependencyCount: components.length, findingCount: findings.length, pass: result.pass }, null, 2));
if (findings.length > 0) process.exitCode = 1;
