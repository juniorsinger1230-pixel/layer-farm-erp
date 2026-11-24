import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import http from 'node:http';
import { PGlite } from '@electric-sql/pglite';
import { LocalAttachmentStore } from '../dist/packages/integrations/src/attachments.js';
import {
  PrintService,
  ThirdPartySandboxAdapter,
  TransportPrinterAdapter,
  normalizeCanvasDesign,
  renderDesignedArtifact,
} from '../dist/packages/integrations/src/print.js';

class Pool {
  constructor(db) { this.db = db; }
  query(q, v) { return this.db.query(q, v); }
  async connect() { return { query: (q, v) => this.db.query(q, v), release: () => {} }; }
}

const context = { actorId: 'TEST', employeeId: 1, companyCode: 'THL', companyId: 1 };
const sampleElement = {
  id: 'txt-1', type: 'text', xMm: 5, yMm: 5, widthMm: 45, heightMm: 8, rotation: 0,
  content: 'EGG-001', fontSizePt: 10, bold: false, align: 'left',
};

async function fixture() {
  const db = new PGlite();
  for (const file of readdirSync(new URL('../migrations/', import.meta.url)).filter((name) => name.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), 'utf8').replaceAll('CONCURRENTLY', ''));
  }
  await db.query("SELECT set_config('app.actor_id','TEST',false),set_config('app.company_code','*',false),set_config('app.company_id','0',false)");
  await db.query("INSERT INTO app.company (company_code,company_name,base_currency,status,created_by) VALUES ('THL','Synthetic','PHP','active','TEST')");
  await db.query("SELECT set_config('app.company_code','THL',false),set_config('app.company_id','1',false)");
  const root = await mkdtemp(join(tmpdir(), 'erp-print-designer-'));
  const store = new LocalAttachmentStore(root);
  const pool = new Pool(db);
  const service = new PrintService(pool, context, store, new Map());
  return { db, pool, root, store, service };
}

async function createLabelEnvironment(db) {
  const template = await db.query("INSERT INTO app.print_template (template_code,template_name,template_type,paper_size_code,paper_dimensions_mm,company_code,created_by) VALUES ('TPL-1','Egg Label','label','80x60','80x60','THL','TEST') RETURNING id");
  const device = await db.query("INSERT INTO app.printer_device (device_code,device_brand,device_model,supported_paper,device_status,company_code,created_by) VALUES ('DEV-1','Gprinter','M421','80x60','online','THL','TEST') RETURNING id");
  return { templateId: Number(template.rows[0].id), deviceId: Number(device.rows[0].id) };
}

test('画布元素执行白名单、边界和三格式渲染', async () => {
  const valid = normalizeCanvasDesign({ widthMm: 80, heightMm: 60, elements: [sampleElement] });
  assert.equal(valid.elements.length, 1);
  await assert.rejects(async () => normalizeCanvasDesign({ widthMm: 80, heightMm: 60, elements: [{ ...sampleElement, xMm: 70 }] }));
  await assert.rejects(async () => normalizeCanvasDesign({ widthMm: 80, heightMm: 60, elements: [sampleElement, { ...sampleElement, id: 'txt-1' }] }));
  await assert.rejects(async () => normalizeCanvasDesign({ widthMm: 80, heightMm: 60, elements: [{ ...sampleElement, content: 'bad\u0000value' }] }));
  const design = { widthMm: 80, heightMm: 60, elements: [sampleElement, { id: 'bar-1', type: 'barcode', xMm: 5, yMm: 18, widthMm: 45, heightMm: 16, rotation: 0, value: 'B-1001', barcodeFormat: 'CODE128', humanReadable: true }] };
  const tspl = await renderDesignedArtifact(design, 'tspl');
  assert.match(Buffer.from(tspl.content).toString(), /BARCODE/);
  const escp = await renderDesignedArtifact({ widthMm: 80, heightMm: 60, elements: [sampleElement] }, 'escp');
  assert.equal(escp.content[0], 0x1b);
  const pdf = await renderDesignedArtifact({ widthMm: 216, heightMm: 356, elements: [{ ...sampleElement, widthMm: 120, heightMm: 12 }] }, 'pdf');
  assert.equal(Buffer.from(pdf.content).subarray(0, 4).toString(), '%PDF');
});

test('设计版本可保存、发布且新版本发布时归档旧版本', async () => {
  const f = await fixture();
  const { templateId } = await createLabelEnvironment(f.db);
  const first = await f.service.saveDesign(templateId, { widthMm: 80, heightMm: 60, elements: [sampleElement] }, 'DESIGN-SAVE-1');
  const publishedFirst = await f.service.publishDesign(templateId, first.id);
  assert.equal(publishedFirst.status, 'published');
  const second = await f.service.saveDesign(templateId, { widthMm: 80, heightMm: 60, elements: [{ ...sampleElement, yMm: 10 }] }, 'DESIGN-SAVE-2');
  const publishedSecond = await f.service.publishDesign(templateId, second.id);
  assert.equal(publishedSecond.status, 'published');
  const rows = await f.db.query('SELECT status,count(*) FROM app_ops.print_template_design GROUP BY status');
  const statuses = Object.fromEntries(rows.rows.map((row) => [row.status, Number(row.count)]));
  assert.equal(statuses.published, 1);
  assert.equal(statuses.archived, 1);
  const latest = await f.service.getLatestDesign(templateId);
  assert.equal(latest.version, second.version);
  await f.db.close();
});

test('打印任务按已发布设计生成，并通过USB/蓝牙传输适配器完成', async () => {
  const f = await fixture();
  const { templateId, deviceId } = await createLabelEnvironment(f.db);
  const saved = await f.service.saveDesign(templateId, { widthMm: 80, heightMm: 60, elements: [sampleElement] }, 'DESIGN-PRINT-SAVE');
  await f.service.publishDesign(templateId, saved.id);
  const writes = [];
  const transport = { write: async (content) => { writes.push(content); return { externalRef: 'USB-1' }; } };
  const serviceWithAdapter = new PrintService(f.pool, context, f.store, new Map([['tspl', new TransportPrinterAdapter('usb', transport)]]));
  const job = await serviceWithAdapter.submit({ templateId, deviceId, designVersion: saved.version }, 'DESIGN-PRINT-JOB-1');
  const dispatched = await serviceWithAdapter.dispatch(job.id);
  assert.equal(dispatched.status, 'completed');
  assert.equal(dispatched.externalRef, 'USB-1');
  assert.equal(writes.length, 1);
  await assert.rejects(() => new TransportPrinterAdapter('bluetooth', transport).send(Buffer.alloc(0), 'tspl'));
  await f.db.close();
});

test('第三方打印沙箱通过HTTP返回凭证，异常契约被阻断', async () => {
  const server = http.createServer((req, res) => {
    let body = Buffer.alloc(0);
    req.on('data', (chunk) => { body = Buffer.concat([body, chunk]); });
    req.on('end', () => {
      assert.ok(body.byteLength > 0);
      res.setHeader('content-type', 'application/json');
      res.end(req.url === '/bad' ? '{}' : JSON.stringify({ externalRef: 'SBX-1' }));
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const adapter = new ThirdPartySandboxAdapter(`http://127.0.0.1:${port}/print`);
  const result = await adapter.send(Buffer.from('PRINT'), 'tspl');
  assert.equal(result.externalRef, 'SBX-1');
  const badAdapter = new ThirdPartySandboxAdapter(`http://127.0.0.1:${port}/bad`);
  await assert.rejects(() => badAdapter.send(Buffer.from('PRINT'), 'tspl'));
  assert.throws(() => new ThirdPartySandboxAdapter('ftp://127.0.0.1/print'));
  await new Promise((resolve) => server.close(resolve));
});
