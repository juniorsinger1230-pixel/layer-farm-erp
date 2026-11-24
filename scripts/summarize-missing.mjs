import fs from 'node:fs';

const result = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const groups = new Map();
for (const item of result.missingContractOperations) {
  const id = item.requirement?.requirementId ?? 'unknown';
  if (!groups.has(id)) groups.set(id, []);
  groups.get(id).push(`${item.method} ${item.path}`);
}
for (const [id, operations] of [...groups].sort()) {
  console.log(`${id} (${operations.length}): ${operations.join(' | ')}`);
}
