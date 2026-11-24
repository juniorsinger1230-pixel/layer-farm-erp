import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const targets = ['apps', 'packages', 'migrations'];
const findings = [];
const rules = [
  { id: 'SAST-EVAL', regex: /\beval\s*\(|new\s+Function\s*\(/ },
  { id: 'SAST-TS-BYPASS', regex: /@ts-ignore|@ts-nocheck|\bas\s+any\b/ },
  { id: 'SAST-RAW-HTML', regex: /dangerouslySetInnerHTML|\.innerHTML\s*=/ },
  { id: 'SECRET-PRIVATE-KEY', regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { id: 'SECRET-AWS', regex: /AKIA[0-9A-Z]{16}/ },
];

function walk(path) {
  for (const entry of readdirSync(path)) {
    if (entry === 'node_modules' || entry === 'dist') continue;
    const absolute = join(path, entry);
    if (statSync(absolute).isDirectory()) walk(absolute);
    else if (/\.(?:ts|tsx|js|mjs|json|sql|md)$/.test(entry)) {
      const text = readFileSync(absolute, 'utf8');
      for (const rule of rules) if (rule.regex.test(text)) findings.push({ file: relative(root, absolute), rule: rule.id });
    }
  }
}
for (const target of targets) walk(join(root, target));
const result = { scannedRoots: targets, ruleCount: rules.length, findings, pass: findings.length === 0 };
writeFileSync(join(root, 'security-check-result.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
if (findings.length > 0) process.exitCode = 1;
