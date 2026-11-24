import fs from 'node:fs';

const mapping = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const missingIds = new Set(process.argv.slice(3));
for (const item of mapping.mappings) {
  if (missingIds.has(item.requirement_id)) {
    console.log(JSON.stringify(item, null, 2));
  }
}
