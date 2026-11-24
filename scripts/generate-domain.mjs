import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const project = path.resolve(root, '../../..');
const tables = JSON.parse(readFileSync(path.join(project, '数据库与数据设计_活动②_表结构与索引设计_V1.0.0/table-index-structure-catalog.json'), 'utf8')).tableStructureContracts;
const openapi = JSON.parse(readFileSync(path.join(project, 'SRS_需求规格化与基线/SRS08_OpenAPI3.1初版.json'), 'utf8'));
const kebab = (value) => value.replaceAll('_', '-');
const modulePermissions = { ORG: 'org', FARM: 'production', VET: 'vet', PROC: 'purchase', INV: 'inventory', SALES: 'sales', LOG: 'delivery', FIN: 'finance', EQP: 'equipment', RPT: 'report', PRINT: 'print', TRACE: 'audit', PLAT: 'platform' };
const permissionOverrides = { company: 'org', material: 'master', supplier: 'supplier', customer: 'customer', house_pen: 'production', system_role: 'rbac', data_permission: 'rbac', audit_log: 'audit', version_history: 'audit', outbox_event: 'platform', idempotency_consumption: 'platform', task_status: 'platform' };
const pathOverrides = {
  company: '/api/v1/org/organizations', organization_unit: '/api/v1/org/organization-units', position: '/api/v1/org/positions', employee: '/api/v1/org/employee-accounts', system_role: '/api/v1/org/system-roles', data_permission: '/api/v1/org/data-scopes',
  farm_batch: '/api/v1/farm/flock-batches', house_pen: '/api/v1/farm/houses-and-pens', chick_receipt: '/api/v1/farm/chick-arrival-inspections', feeding_record: '/api/v1/farm/feeding-management', environment_record: '/api/v1/farm/environment-shift-records', beak_trimming_record: '/api/v1/farm/beak-trimming', weighing_record: '/api/v1/farm/weighing-uniformity', transfer_record: '/api/v1/farm/flock-transfers', mortality_cull_record: '/api/v1/farm/mortality-disposal',
  vaccination_program: '/api/v1/vet/vaccination-program-versions', vaccination_task: '/api/v1/vet/vaccination-tasks', vaccination_execution: '/api/v1/vet/vaccination-records', vaccine_requisition: '/api/v1/vet/vaccine-issues', medication_prescription: '/api/v1/vet/medication-prescriptions', withdrawal_period_record: '/api/v1/vet/withdrawal-sale-controls', quarantine_certificate: '/api/v1/vet/quarantine-certificates',
  purchase_requisition: '/api/v1/proc/purchase-requisitions', purchase_order: '/api/v1/proc/purchase-orders', supplier: '/api/v1/proc/suppliers', goods_receipt: '/api/v1/proc/receipt-inspections',
  material: '/api/v1/inv/materials', inventory_ledger: '/api/v1/inv/inventory-ledger', inbound_record: '/api/v1/inv/stock-receipts', outbound_record: '/api/v1/inv/stock-issues', warehouse_location: '/api/v1/inv/stock-locations', stocktake_record: '/api/v1/inv/stock-counts', batch_expiry: '/api/v1/inv/batch-expiry-fefo', safety_stock: '/api/v1/inv/safety-stock-alerts',
  customer: '/api/v1/sales/customers', price_list: '/api/v1/sales/price-lists', sales_order: '/api/v1/sales/sales-orders', credit_limit: '/api/v1/sales/credit-checks',
  vehicle_route: '/api/v1/log/vehicles', delivery_task: '/api/v1/log/routes-delivery-plans', delivery_receipt: '/api/v1/log/delivery-signoffs', delivery_exception: '/api/v1/log/delivery-exceptions',
  payable: '/api/v1/fin/payables', receivable: '/api/v1/fin/receivables', payment_record: '/api/v1/fin/payment-executions', receipt_record: '/api/v1/fin/receipts-and-cash', cash_checkbook: '/api/v1/fin/payments-and-checks', cost_allocation: '/api/v1/fin/expense-allocations', disbursement_voucher: '/api/v1/fin/disbursement-vouchers',
  equipment: '/api/v1/eqp/equipment', equipment_check: '/api/v1/eqp/equipment-inspections', maintenance_work_order: '/api/v1/eqp/equipment-maintenance', spare_part: '/api/v1/eqp/spare-parts-cross-company-support',
  notification: '/api/v1/plat/notifications', attachment: '/api/v1/plat/attachments-import-export', term_enum: '/api/v1/plat/language-resources', printer_device: '/api/v1/print/printer-paper-adaptation', audit_log: '/api/v1/trace/operation-audit-logs', traceability_link: '/api/v1/trace/material-vaccination-trace', version_history: '/api/v1/trace/document-archives',
};
const resources = tables.filter((table) => !table.tableName.startsWith('rm_')).map((table) => {
  const fallback = `/api/v1/${table.moduleCode.toLowerCase()}/${kebab(table.tableName)}`;
  const apiPath = pathOverrides[table.tableName] ?? fallback;
  return { table: table.tableName, path: apiPath, module: table.moduleCode, permission: permissionOverrides[table.tableName] ?? modulePermissions[table.moduleCode], companyScope: table.companyScope, contractPath: Object.hasOwn(openapi.paths, apiPath) };
});
const content = `// 由权威表结构和 OpenAPI 路径生成；业务规则在 rules.ts 中显式实现。\nexport type ResourceDefinition = { table: string; path: string; module: string; permission: string; companyScope: boolean; contractPath: boolean };\nexport const resources = ${JSON.stringify(resources, null, 2)} as const satisfies readonly ResourceDefinition[];\nexport const resourceByTable = new Map<string, ResourceDefinition>(resources.map((resource) => [resource.table, resource]));\n`;
writeFileSync(path.join(root, 'packages/domain/src/generated/resources.ts'), content);
console.log(`resources=${resources.length}`);
