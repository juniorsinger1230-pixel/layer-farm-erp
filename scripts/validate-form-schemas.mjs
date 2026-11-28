import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.argv[2] ?? '.');
const openapi = JSON.parse(await readFile(resolve(root, 'contracts/openapi.json'), 'utf8'));
const forms = JSON.parse(await readFile(resolve(root, 'apps/web/src/generated/form-schemas.json'), 'utf8'));
const controls = new Set(['text', 'textarea', 'number', 'select', 'reference', 'switch', 'date', 'date-time', 'json']);
const forbidden = new Set(['id', 'company_code', 'created_by', 'created_at', 'updated_by', 'updated_at']);
let referenceCount = 0;

for (const [pageId, page] of Object.entries(forms.pages)) {
  if (!openapi.paths[page.path]?.post) throw new Error(`Missing POST contract for ${pageId}`);
  if (page.fields.length === 0) throw new Error(`No visible fields for ${pageId}`);
  for (const field of page.fields) {
    if (!controls.has(field.control)) throw new Error(`Invalid control ${pageId}.${field.name}`);
    if (forbidden.has(field.name)) throw new Error(`Forbidden visible field ${pageId}.${field.name}`);
    if (field.control === 'select' && (!Array.isArray(field.enum) || field.enum.length === 0)) {
      throw new Error(`Select field missing options ${pageId}.${field.name}`);
    }
    if (field.control === 'reference') {
      referenceCount += 1;
      if (!openapi.paths[field.reference.path]?.get) {
        throw new Error(`Missing reference GET contract for ${pageId}.${field.name}: ${field.reference.path}`);
      }
    }
  }
}
if (forms.summary.pageCount !== Object.keys(forms.pages).length) throw new Error('Page count mismatch');
if (forms.summary.referenceFieldCount !== referenceCount) throw new Error('Reference count mismatch');
console.log(`Validated ${forms.summary.pageCount} forms, ${forms.summary.totalVisibleFields} fields, ${referenceCount} references`);
