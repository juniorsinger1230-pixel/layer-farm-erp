import fs from 'node:fs';

const ids = [
  'ORG-004', 'ORG-006', 'FARM-001', 'FARM-011', 'FARM-012', 'VET-008',
  'PROC-005', 'PROC-006', 'SALES-005', 'SALES-006', 'SALES-007', 'LOG-003',
  'LOG-006', 'FIN-006', 'FIN-007', 'FIN-008', 'EQP-004', 'PRINT-001',
  'PRINT-002', 'PRINT-003', 'PRINT-004', 'PRINT-005', 'RPT-001', 'RPT-002',
  'RPT-003', 'RPT-004', 'RPT-005', 'TRACE-001', 'PLAT-001',
];

const text = fs.readFileSync(process.argv[2], 'utf8');
const sections = text.split(/\n(?=#### )/);

for (const section of sections) {
  const id = ids.find((item) => section.includes(`SRS-FR-${item}`));
  if (!id) continue;
  const lines = section.split(/\r?\n/);
  console.log(`\n### ${lines[0]}`);
  for (const line of lines) {
    if (/必备数据|规则[:：]|状态[:：]|权限[:：]|数据唯一性|追溯|异常|禁止|必须|自动|触发/.test(line)) {
      console.log(line);
    }
  }
}
