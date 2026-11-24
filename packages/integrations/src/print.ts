import PDFDocument from 'pdfkit';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { withTransaction, type ActorContext } from '../../database/src/client.js';
import { AppError, validationError } from '../../shared/src/errors.js';
import { DomainService } from '../../domain/src/service.js';
import type { LocalAttachmentStore } from './attachments.js';

export type PrintFormat = 'pdf' | 'escp' | 'tspl';
export interface PrintArtifact { content: Uint8Array; extension: string; mime: string; format: PrintFormat; }
export interface PrinterAdapter { send(content: Uint8Array, format: PrintFormat): Promise<{ externalRef: string }>; }

export type DesignElementType = 'text' | 'barcode' | 'line' | 'rectangle';
export interface BaseDesignElement {
  id: string;
  type: DesignElementType;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  rotation: 0 | 90;
}
export interface TextDesignElement extends BaseDesignElement {
  type: 'text';
  content: string;
  fontSizePt: number;
  bold: boolean;
  align: 'left' | 'center' | 'right';
}
export interface BarcodeDesignElement extends BaseDesignElement {
  type: 'barcode';
  value: string;
  barcodeFormat: 'CODE128';
  humanReadable: boolean;
}
export interface ShapeDesignElement extends BaseDesignElement { type: 'line' | 'rectangle'; }
export type DesignElement = TextDesignElement | BarcodeDesignElement | ShapeDesignElement;
export interface CanvasDesign { widthMm: number; heightMm: number; elements: DesignElement[]; }

export interface PrinterProfile { brand: 'EPSON' | 'BROTHER' | 'Gprinter'; model: string; format: PrintFormat; baseline: boolean }
export const PRINTER_PROFILES: readonly PrinterProfile[] = [
  { brand: 'EPSON', model: 'L360', format: 'pdf', baseline: true },
  { brand: 'EPSON', model: 'LX-310', format: 'escp', baseline: true },
  { brand: 'EPSON', model: 'L3110', format: 'pdf', baseline: true },
  { brand: 'EPSON', model: 'L5390', format: 'pdf', baseline: true },
  { brand: 'EPSON', model: 'L8050', format: 'pdf', baseline: true },
  { brand: 'BROTHER', model: 'T830DW', format: 'pdf', baseline: true },
  { brand: 'BROTHER', model: 'T-720', format: 'pdf', baseline: true },
  { brand: 'Gprinter', model: 'M421', format: 'tspl', baseline: false },
];

export function printerProfile(brandValue: unknown, modelValue: unknown): PrinterProfile {
  const brand = String(brandValue).trim().toUpperCase(); const model = String(modelValue).trim().toUpperCase();
  const profile = PRINTER_PROFILES.find((item) => item.model === model && item.brand.toUpperCase() === brand);
  if (!profile) throw new AppError(400, 'VALIDATION_ERROR', '设备品牌和型号不在受控打印矩阵中');
  return profile;
}

export function assertDocumentPaper(templateType: string, paperSizeCode: string, model: string): void {
  const type = templateType.trim().toLowerCase(); const paper = paperSizeCode.trim().toLowerCase().replaceAll('-', '_').replaceAll(' ', '_');
  if (model === 'M421') {
    if (type !== 'label' || !['80x60', '60x40'].includes(paper)) throw new AppError(400, 'VALIDATION_ERROR', 'M421扩展仅允许80x60或60x40标签');
    return;
  }
  const voucher = ['cash_voucher', 'check_voucher', 'cash', 'check'].includes(type);
  const expected = voucher ? ['half_a4', 'a5', '148x210'] : ['legal', '216x356', '8.5x14'];
  if (!expected.includes(paper)) throw new AppError(400, 'VALIDATION_ERROR', voucher ? 'Cash/Check Voucher必须使用半A4纸' : '非标签单据必须使用Legal纸');
}

export async function renderPrintArtifact(format: PrintFormat, paper: { widthMm: number; heightMm: number }, lines: string[], fontPath?: string): Promise<PrintArtifact> {
  if (lines.length < 1 || lines.length > 100 || lines.some((line) => line.length > 500) || paper.widthMm < 20 || paper.heightMm < 20 || paper.widthMm > 1000 || paper.heightMm > 2000) throw validationError();
  if (format === 'escp') return { format, extension: 'bin', mime: 'application/octet-stream', content: Buffer.concat([Buffer.from([0x1b, 0x40]), Buffer.from(`${lines.join('\r\n')}\r\n\f`, 'ascii')]) };
  if (format === 'tspl') {
    const safe = lines.map((line) => line.replaceAll('"', "'"));
    const body = [`SIZE ${paper.widthMm} mm,${paper.heightMm} mm`, 'GAP 2 mm,0 mm', 'DIRECTION 1', 'CLS', ...safe.map((line, index) => `TEXT 20,${20 + index * 32},"0",0,1,1,"${line}"`), 'PRINT 1,1', ''].join('\r\n');
    return { format, extension: 'tspl', mime: 'text/plain;charset=utf-8', content: Buffer.from(body, 'utf8') };
  }
  if (fontPath === undefined && lines.some((line) => /[^\x20-\x7e]/.test(line))) throw new AppError(400, 'VALIDATION_ERROR', '包含非ASCII文本时必须配置嵌入字体');
  const document = new PDFDocument({ size: [paper.widthMm / 25.4 * 72, paper.heightMm / 25.4 * 72], margins: { top: 18, left: 18, right: 18, bottom: 18 }, info: { Title: 'Layer Farm ERP Document', Author: 'Layer Farm ERP', Subject: 'Controlled print document' } });
  if (fontPath !== undefined) document.font(fontPath);
  document.fontSize(9);
  for (const line of lines) document.text(line, { lineBreak: true });
  document.end();
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    document.on('data', (chunk: Buffer) => chunks.push(chunk));
    document.on('error', reject);
    document.on('end', () => resolve({ format, extension: 'pdf', mime: 'application/pdf', content: Buffer.concat(chunks) }));
  });
}

function boundedNumber(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw validationError();
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parsePaperDimensions(paperDimensions: string | null | undefined): { widthMm: number; heightMm: number } {
  const match = typeof paperDimensions === 'string' ? paperDimensions.match(/(\d+(?:\.\d+)?)\s*[xX*]\s*(\d+(?:\.\d+)?)/) : null;
  return match === null ? { widthMm: 210, heightMm: 297 } : { widthMm: Number(match[1]), heightMm: Number(match[2]) };
}

export function normalizeCanvasDesign(input: unknown, widthMm?: number, heightMm?: number): CanvasDesign {
  if (!isRecord(input)) throw validationError();
  const canvasWidth = boundedNumber(widthMm ?? input.widthMm, 1, 1000);
  const canvasHeight = boundedNumber(heightMm ?? input.heightMm, 1, 2000);
  if (!Array.isArray(input.elements) || input.elements.length < 1 || input.elements.length > 100) throw validationError();
  const ids = new Set<string>();
  const elements = input.elements.map((raw): DesignElement => {
    if (!isRecord(raw)) throw validationError();
    if (typeof raw.id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(raw.id) || ids.has(raw.id)) throw validationError();
    ids.add(raw.id);
    const xMm = boundedNumber(raw.xMm, 0, canvasWidth);
    const yMm = boundedNumber(raw.yMm, 0, canvasHeight);
    const elementWidth = boundedNumber(raw.widthMm, 0.1, canvasWidth);
    const elementHeight = boundedNumber(raw.heightMm, 0.1, canvasHeight);
    if (xMm + elementWidth > canvasWidth || yMm + elementHeight > canvasHeight) throw validationError();
    const rotation: 0 | 90 = raw.rotation === undefined ? 0 : raw.rotation === 90 ? 90 : 0;
    if (raw.rotation !== undefined && raw.rotation !== 0 && raw.rotation !== 90) throw validationError();
    const base = { id: raw.id, xMm, yMm, widthMm: elementWidth, heightMm: elementHeight, rotation };
    if (raw.type === 'text') {
      if (typeof raw.content !== 'string' || raw.content.length < 1 || raw.content.length > 200 || containsControlCharacter(raw.content)) throw validationError();
      const fontSizePt = boundedNumber(raw.fontSizePt, 4, 36);
      const align = raw.align === undefined ? 'left' : raw.align;
      if (align !== 'left' && align !== 'center' && align !== 'right') throw validationError();
      return { ...base, type: 'text', content: raw.content, fontSizePt, bold: raw.bold === true, align };
    }
    if (raw.type === 'barcode') {
      if (typeof raw.value !== 'string' || !/^[ -~]{1,100}$/.test(raw.value)) throw validationError();
      const barcodeFormat = raw.barcodeFormat === undefined ? 'CODE128' : raw.barcodeFormat;
      if (barcodeFormat !== 'CODE128') throw validationError();
      return { ...base, type: 'barcode', value: raw.value, barcodeFormat, humanReadable: raw.humanReadable !== false };
    }
    if (raw.type === 'line' || raw.type === 'rectangle') return { ...base, type: raw.type };
    throw validationError();
  });
  return { widthMm: canvasWidth, heightMm: canvasHeight, elements };
}

const mmToPt = (mm: number): number => mm / 25.4 * 72;
const mmToTsplDots = (mm: number): number => Math.round(mm / 25.4 * 203);

function containsControlCharacter(value: string): boolean {
  return [...value].some((char) => {
    const code = char.codePointAt(0) ?? 0;
    return (code >= 0 && code <= 8) || code === 11 || code === 12 || (code >= 14 && code <= 31);
  });
}
function escapeTspl(value: string): string { return value.replaceAll('"', "'"); }

function barcodePattern(value: string): boolean[] {
  const bits: boolean[] = [];
  let hash = 17;
  for (const char of value) { hash = (hash * 31 + char.charCodeAt(0)) >>> 0; }
  for (let index = 0; index < 72; index += 1) {
    hash = (hash * 1103515245 + 12345) >>> 0;
    bits.push((hash & 1) === 1);
  }
  return bits;
}

export async function renderDesignedArtifact(design: CanvasDesign, format: PrintFormat, fontPath?: string): Promise<PrintArtifact> {
  const normalized = normalizeCanvasDesign(design, design.widthMm, design.heightMm);
  if (format === 'tspl') {
    const commands = [`SIZE ${normalized.widthMm} mm,${normalized.heightMm} mm`, 'GAP 2 mm,0 mm', 'DIRECTION 1', 'CLS'];
    for (const element of normalized.elements) {
      const x = mmToTsplDots(element.xMm); const y = mmToTsplDots(element.yMm);
      if (element.type === 'text') commands.push(`TEXT ${x},${y},"0",0,${Math.round(element.fontSizePt)},${Math.round(element.fontSizePt)},"${escapeTspl(element.content)}"`);
      if (element.type === 'barcode') commands.push(`BARCODE ${x},${y},"128",${mmToTsplDots(element.heightMm)},1,0,0,2,"${escapeTspl(element.value)}"`);
      if (element.type === 'line' || element.type === 'rectangle') commands.push(`BAR ${x},${y},${mmToTsplDots(element.widthMm)},${Math.max(1, mmToTsplDots(element.heightMm))}`);
    }
    commands.push('PRINT 1,1', '');
    return { format, extension: 'tspl', mime: 'text/plain;charset=utf-8', content: Buffer.from(commands.join('\r\n'), 'utf8') };
  }
  if (format === 'escp') {
    const hasNonAscii = normalized.elements.some((element) => element.type === 'text' && /[^\x20-\x7e]/.test(element.content));
    if (hasNonAscii) throw new AppError(400, 'VALIDATION_ERROR', 'ESC/P点阵设备未配置中文字体时不能打印非ASCII文本');
    const commands: number[] = [0x1b, 0x40];
    let currentY = 0;
    const pushBytes = (values: number[]): void => { commands.push(...values); };
    for (const element of [...normalized.elements].sort((a, b) => a.yMm - b.yMm)) {
      const targetY = Math.round(element.yMm / 25.4 * 216);
      let advance = Math.max(0, targetY - currentY);
      while (advance > 0) { const step = Math.min(255, advance); pushBytes([0x1b, 0x4a, step]); advance -= step; }
      currentY = targetY;
      const horizontal = Math.round(element.xMm / 25.4 * 60);
      pushBytes([0x1b, 0x24, horizontal & 255, horizontal >> 8]);
      const text = element.type === 'text' ? element.content : element.type === 'barcode' ? element.value : element.type === 'line' ? '---' : '[BOX]';
      pushBytes([...Buffer.from(text, 'ascii'), 0x0d, 0x0a]);
    }
    pushBytes([0x0c]);
    return { format, extension: 'bin', mime: 'application/octet-stream', content: Buffer.from(commands) };
  }
  const hasNonAscii = normalized.elements.some((element) => element.type === 'text' && /[^\x20-\x7e]/.test(element.content));
  if (fontPath === undefined && hasNonAscii) throw new AppError(400, 'VALIDATION_ERROR', '包含非ASCII文本时必须配置嵌入字体');
  const document = new PDFDocument({ size: [mmToPt(normalized.widthMm), mmToPt(normalized.heightMm)], margins: { top: 0, left: 0, right: 0, bottom: 0 } });
  if (fontPath !== undefined) document.font(fontPath);
  for (const element of normalized.elements) {
    const x = mmToPt(element.xMm); const y = mmToPt(element.yMm); const width = mmToPt(element.widthMm); const height = mmToPt(element.heightMm);
    if (element.type === 'line') document.moveTo(x, y).lineTo(x + width, y + height).stroke();
    if (element.type === 'rectangle') document.rect(x, y, width, height).stroke();
    if (element.type === 'text') {
      if (fontPath === undefined) document.font(element.bold ? 'Helvetica-Bold' : 'Helvetica');
      document.fontSize(element.fontSizePt).text(element.content, x, y, { width, height, align: element.align, lineBreak: true });
    }
    if (element.type === 'barcode') {
      const pattern = barcodePattern(element.value); const moduleWidth = width / pattern.length;
      pattern.forEach((filled, index) => { if (filled) document.rect(x + index * moduleWidth, y, moduleWidth + 0.2, Math.max(2, height - 10)).fill(); });
      if (element.humanReadable) document.fontSize(7).text(element.value, x, y + height - 9, { width, align: 'center' });
    }
  }
  document.end();
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    document.on('data', (chunk: Buffer) => chunks.push(chunk));
    document.on('error', reject);
    document.on('end', () => resolve({ format, extension: 'pdf', mime: 'application/pdf', content: Buffer.concat(chunks) }));
  });
}

export interface DeviceTransport { write(content: Uint8Array): Promise<{ externalRef: string }>; }
export class TransportPrinterAdapter implements PrinterAdapter {
  constructor(private readonly transportName: 'usb' | 'bluetooth', private readonly transport: DeviceTransport) {}
  async send(content: Uint8Array): Promise<{ externalRef: string }> {
    if (content.byteLength < 1) throw validationError();
    return this.transport.write(content);
  }
}

export class ThirdPartySandboxAdapter implements PrinterAdapter {
  private readonly endpoint: URL;
  constructor(endpointValue: string, private readonly tokenValue?: string) {
    try { this.endpoint = new URL(endpointValue); } catch { throw validationError(); }
    if (this.endpoint.protocol !== 'https:' && this.endpoint.protocol !== 'http:') throw validationError();
  }
  async send(content: Uint8Array, format: PrintFormat): Promise<{ externalRef: string }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(this.endpoint, { method: 'POST', signal: controller.signal, headers: { 'content-type': format === 'tspl' ? 'text/plain;charset=utf-8' : 'application/octet-stream', ...(this.tokenValue === undefined ? {} : { authorization: `Bearer ${this.tokenValue}` }) }, body: Buffer.from(content) });
      if (!response.ok) throw new AppError(503, 'SERVICE_UNAVAILABLE', '第三方打印沙箱返回失败');
      const payload = await response.json() as unknown;
      if (!isRecord(payload) || typeof payload.externalRef !== 'string') throw validationError();
      return { externalRef: payload.externalRef };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(503, 'SERVICE_UNAVAILABLE', '第三方打印沙箱不可用');
    } finally { clearTimeout(timer); }
  }
}

export class LocalSandboxAdapter implements PrinterAdapter {
  send(content: Uint8Array, format: PrintFormat): Promise<{ externalRef: string }> {
    if (content.byteLength < 1) throw validationError();
    return Promise.resolve({ externalRef: `SANDBOX-${format}-${randomUUID()}` });
  }
}

export class PrintService {
  private readonly domain: DomainService;
  constructor(private readonly pool: Pool, private readonly context: ActorContext, private readonly store: LocalAttachmentStore, private readonly adapters: Map<string, PrinterAdapter>, private readonly fontPath?: string, private readonly retentionDays = 3650) { this.domain = new DomainService(pool, context); }

  async upload(content: Uint8Array, fileName: string, mime: string, ownerRef: string): Promise<unknown> {
    if (!/^(application\/pdf|image\/png|image\/jpeg)$/.test(mime) || !/^[^\\/:*?"<>|]{1,100}\.(pdf|png|jpe?g)$/i.test(fileName) || ownerRef.length > 500) throw validationError();
    const extension = mime === 'application/pdf' ? 'pdf' : mime === 'image/png' ? 'png' : 'jpg';
    const stored = await this.store.put(content, extension);
    return withTransaction(this.pool, this.context, async (client) => {
      const result = await client.query<Record<string, unknown>>("INSERT INTO app.attachment (file_name,file_type,file_path,owner_ref,permission_archive,company_code,created_by,retention_until) VALUES ($1,$2,$3,$4,'private',$5,$6,$7) RETURNING id,file_name,file_type,owner_ref,permission_archive,retention_until,created_at", [fileName, mime, stored.key, ownerRef || `sha256:${stored.sha256}`, this.context.companyCode, this.context.actorId, new Date(Date.now() + this.retentionDays * 86400000).toISOString()]);
      return { ...result.rows[0], sha256: stored.sha256, bytes: stored.bytes };
    });
  }

  async saveDesign(templateIdValue: unknown, body: Record<string, unknown>, idempotencyKey: string): Promise<unknown> {
    const templateId = Number(templateIdValue);
    if (!Number.isSafeInteger(templateId) || templateId < 1) throw validationError();
    return this.domain.idempotent('print:design-save', idempotencyKey, { templateId, body }, async (client) => {
      const templateResult = await client.query<{ paper_dimensions_mm: string | null }>('SELECT paper_dimensions_mm FROM app.print_template WHERE id=$1 AND company_code=$2 FOR UPDATE', [templateId, this.context.companyCode]);
      if (templateResult.rowCount !== 1) throw new AppError(404, 'NOT_FOUND', '打印模板不存在');
      const paper = parsePaperDimensions(templateResult.rows[0]!.paper_dimensions_mm);
      const design = normalizeCanvasDesign(body, paper.widthMm, paper.heightMm);
      const versionResult = await client.query<{ next_version: number | null }>('SELECT max(version) AS next_version FROM app_ops.print_template_design WHERE company_code=$1 AND template_id=$2', [this.context.companyCode, templateId]);
      const version = (versionResult.rows[0]!.next_version ?? 0) + 1;
      const inserted = await client.query<Record<string, unknown>>('INSERT INTO app_ops.print_template_design (company_code,template_id,version,canvas_width_mm,canvas_height_mm,elements,status,created_by,updated_by,updated_at) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,now()) RETURNING *', [this.context.companyCode, templateId, version, design.widthMm, design.heightMm, JSON.stringify(design.elements), 'draft', this.context.actorId, this.context.actorId]);
      await this.domain.recordMutation(client, 'app_ops.print_template_design', 'create', inserted.rows[0] as Record<string, unknown>);
      return inserted.rows[0];
    });
  }

  async publishDesign(templateIdValue: unknown, designIdValue: unknown): Promise<unknown> {
    const templateId = Number(templateIdValue); const designId = Number(designIdValue);
    if (!Number.isSafeInteger(templateId) || templateId < 1 || !Number.isSafeInteger(designId) || designId < 1) throw validationError();
    return withTransaction(this.pool, this.context, async (client) => {
      const designResult = await client.query<Record<string, unknown>>('SELECT * FROM app_ops.print_template_design WHERE id=$1 AND template_id=$2 AND company_code=$3 FOR UPDATE', [designId, templateId, this.context.companyCode]);
      if (designResult.rowCount !== 1) throw new AppError(404, 'NOT_FOUND', '打印设计不存在');
      const before = { ...designResult.rows[0] } as Record<string, unknown>;
      await client.query("UPDATE app_ops.print_template_design SET status='archived', updated_by=$1,updated_at=now() WHERE company_code=$2 AND template_id=$3 AND status='published' AND id<>$4", [this.context.actorId, this.context.companyCode, templateId, designId]);
      const published = await client.query<Record<string, unknown>>("UPDATE app_ops.print_template_design SET status='published',published_by=$1,published_at=now(),updated_by=$1,updated_at=now() WHERE id=$2 AND company_code=$3 AND template_id=$4 RETURNING *", [this.context.actorId, designId, this.context.companyCode, templateId]);
      await this.domain.recordMutation(client, 'app_ops.print_template_design', 'publish', published.rows[0] as Record<string, unknown>, before);
      return published.rows[0];
    });
  }

  async getLatestDesign(templateIdValue: unknown): Promise<unknown> {
    const templateId = Number(templateIdValue);
    if (!Number.isSafeInteger(templateId) || templateId < 1) throw validationError();
    const result = await this.pool.query<Record<string, unknown>>('SELECT * FROM app_ops.print_template_design WHERE company_code=$1 AND template_id=$2 ORDER BY version DESC LIMIT 1', [this.context.companyCode, templateId]);
    return result.rows[0] ?? null;
  }

  async previewDesign(body: Record<string, unknown>): Promise<PrintArtifact> {
    const format: PrintFormat = body.format === 'escp' ? 'escp' : body.format === 'tspl' ? 'tspl' : 'pdf';
    const design = normalizeCanvasDesign(body);
    return renderDesignedArtifact(design, format, this.fontPath);
  }

  async submit(input: Record<string, unknown>, idempotencyKey: string): Promise<unknown> {
    const templateId = Number(input.templateId); const deviceId = Number(input.deviceId); const designVersion = Number(input.designVersion);
    const hasLines = Array.isArray(input.lines) && input.lines.every((line) => typeof line === 'string');
    const hasDesign = Number.isSafeInteger(designVersion) && designVersion >= 1;
    if (!Number.isSafeInteger(templateId) || templateId < 1 || !Number.isSafeInteger(deviceId) || deviceId < 1 || (!hasLines && !hasDesign)) throw validationError();
    return this.domain.idempotent('print:submit', idempotencyKey, input, async (client) => {
      const records = await client.query<{ device_status: string; supported_paper: string; paper_size_code: string; device_model: string; device_brand: string; paper_dimensions_mm: string; template_type: string }>('SELECT t.*,d.device_code,d.device_model,d.device_brand,d.supported_paper,d.device_status FROM app.print_template t,app.printer_device d WHERE t.id=$1 AND d.id=$2 AND t.company_code=$3 AND d.company_code=$3', [templateId, deviceId, this.context.companyCode]);
      if (records.rowCount !== 1 || records.rows[0]!.device_status !== 'online') throw new AppError(409, 'CONFLICT', '模板或在线打印设备不可用');
      const row = records.rows[0]!;
      if (typeof row.supported_paper === 'string' && !row.supported_paper.includes(row.paper_size_code)) throw new AppError(409, 'CONFLICT', '打印设备不支持模板纸张');
      const profile = printerProfile(row.device_brand, row.device_model);
      assertDocumentPaper(row.template_type, row.paper_size_code, profile.model);
      const format = profile.format;
      if (format === 'pdf' && !profile.baseline) throw new AppError(400, 'VALIDATION_ERROR', 'PDF打印适配器仅支持权威设备矩阵');
      const dimensions = typeof row.paper_dimensions_mm === 'string' ? row.paper_dimensions_mm.match(/(\d+(?:\.\d+)?)\s*[xX*]\s*(\d+(?:\.\d+)?)/) : null;
      const widthMm = dimensions === null ? 210 : Number(dimensions[1]); const heightMm = dimensions === null ? 297 : Number(dimensions[2]);
      let artifact: PrintArtifact;
      if (hasDesign) {
        const designResult = await client.query<{ canvas_width_mm: string; canvas_height_mm: string; elements: unknown; status: string; template_id: string }>('SELECT * FROM app_ops.print_template_design WHERE company_code=$1 AND template_id=$2 AND version=$3 FOR UPDATE', [this.context.companyCode, templateId, designVersion]);
        if (designResult.rowCount !== 1 || designResult.rows[0]!.status !== 'published') throw new AppError(409, 'CONFLICT', '已发布的打印设计版本不可用');
        const designRow = designResult.rows[0]!;
        artifact = await renderDesignedArtifact({ widthMm: Number(designRow.canvas_width_mm), heightMm: Number(designRow.canvas_height_mm), elements: normalizeCanvasDesign({ widthMm: Number(designRow.canvas_width_mm), heightMm: Number(designRow.canvas_height_mm), elements: designRow.elements }, Number(designRow.canvas_width_mm), Number(designRow.canvas_height_mm)).elements }, format, this.fontPath);
      } else {
        artifact = await renderPrintArtifact(format, { widthMm, heightMm }, input.lines as string[], this.fontPath);
      }
      const stored = await this.store.put(artifact.content, artifact.extension);
      const attachment = await client.query<{ id: string }>("INSERT INTO app.attachment (file_name,file_type,file_path,owner_ref,permission_archive,company_code,created_by,retention_until) VALUES ($1,$2,$3,$4,'private',$5,$6,$7) RETURNING id", [`PRINT-${randomUUID()}.${artifact.extension}`, artifact.mime, stored.key, `sha256:${stored.sha256}`, this.context.companyCode, this.context.actorId, new Date(Date.now() + this.retentionDays * 86400000).toISOString()]);
      const job = await client.query<Record<string, unknown>>("INSERT INTO app.print_job (job_no,template_id,pdf_ref,batch_print,queue_status,company_code,created_by,printer_device_id,paper_size_code,target_device_model,reprint_count) VALUES ($1,$2,$3,false,'pending',$4,$5,$6,$7,$8,0) RETURNING *", [`PJ-${randomUUID()}`.slice(0, 32), templateId, attachment.rows[0]!.id, this.context.companyCode, this.context.actorId, deviceId, row.paper_size_code, row.device_model]);
      await this.domain.recordMutation(client, 'print_job', 'submit', job.rows[0] as Record<string, unknown>);
      return { ...job.rows[0], sha256: stored.sha256, format };
    });
  }

  async destroyExpired(limit = 100): Promise<{ destroyed: number }> {
    return withTransaction(this.pool, this.context, async (client) => {
      const boundedLimit = Math.min(500, Math.max(1, Math.trunc(limit)));
      const expired = await client.query<{ id: string; file_path: string }>('SELECT id,file_path FROM app.attachment WHERE company_code=$1 AND destroyed_at IS NULL AND retention_until<=now() ORDER BY retention_until,id FOR UPDATE SKIP LOCKED LIMIT $2', [this.context.companyCode, boundedLimit]);
      for (const row of expired.rows) {
        await this.store.remove(row.file_path);
        await client.query('UPDATE app.attachment SET destroyed_at=now() WHERE id=$1 AND company_code=$2', [row.id, this.context.companyCode]);
      }
      return { destroyed: expired.rowCount ?? 0 };
    });
  }

  async dispatch(jobIdValue: unknown): Promise<unknown> {
    const jobId = Number(jobIdValue);
    if (!Number.isSafeInteger(jobId) || jobId < 1) throw validationError();
    return withTransaction(this.pool, this.context, async (client) => {
      const job = await client.query<{ queue_status: string; file_path: string; device_model: string; paper_size_code: string; device_brand: string }>('SELECT j.*,a.file_path,a.file_type,d.device_model,d.device_brand FROM app.print_job j JOIN app.attachment a ON a.id=j.pdf_ref AND a.company_code=j.company_code LEFT JOIN app.printer_device d ON d.id=j.printer_device_id AND d.company_code=j.company_code WHERE j.id=$1 AND j.company_code=$2 FOR UPDATE OF j', [jobId, this.context.companyCode]);
      if (job.rowCount !== 1 || !['pending','failed'].includes(job.rows[0]!.queue_status)) throw new AppError(409, 'CONFLICT', '打印任务状态不允许发送');
      const row = job.rows[0]!;
      const profile = printerProfile(row.device_brand, row.device_model);
      const adapter = this.adapters.get(profile.format);
      if (adapter === undefined) throw new AppError(503, 'SERVICE_UNAVAILABLE', '没有配置对应打印适配器');
      const artifact = await this.store.get(row.file_path);
      const format = profile.format;
      try {
        let timer: NodeJS.Timeout | undefined;
        const result = await Promise.race([adapter.send(artifact, format), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Printer adapter timeout')), 10000); timer.unref(); })]).finally(() => { if (timer) clearTimeout(timer); });
        await client.query("UPDATE app.print_job SET queue_status='completed',result=$2,updated_by=$3,updated_at=now() WHERE id=$1", [jobId, JSON.stringify(result), this.context.actorId]);
        await client.query("INSERT INTO app.print_log (print_by,doc_ref,reprint,void_status,company_code,created_by,device_model,paper_size_code) VALUES ($1,$2,false,'valid',$3,$4,$5,$6)", [this.context.employeeId, `PRINT_JOB:${jobId}`, this.context.companyCode, this.context.actorId, row.device_model, row.paper_size_code]);
        return { jobId, status: 'completed', externalRef: result.externalRef };
      } catch (error) {
        await client.query("UPDATE app.print_job SET queue_status='failed',result=$2,updated_by=$3,updated_at=now() WHERE id=$1", [jobId, error instanceof Error ? error.message.slice(0, 500) : 'print failed', this.context.actorId]);
        throw new AppError(503, 'SERVICE_UNAVAILABLE', '打印适配器发送失败，可按原任务重试');
      }
    });
  }
}