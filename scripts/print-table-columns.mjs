import fs from 'node:fs';

const names = process.argv.slice(3);
const text = fs.readFileSync(process.argv[2], 'utf8');

for (const name of names) {
  const marker = `"tableName": "${name}"`;
  const start = text.indexOf(marker);
  if (start < 0) {
    console.log(`${name}: not found`);
    continue;
  }
  const end = text.indexOf('\n  },', start);
  const block = text.slice(start, end);
  const columns = [...block.matchAll(/"name": "([^"]+)"/g)].map((match) => match[1]);
  console.log(`${name}: ${columns.join(', ')}`);
}
