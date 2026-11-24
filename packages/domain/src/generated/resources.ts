// 由权威表结构和 OpenAPI 路径生成；业务规则在 rules.ts 中显式实现。
export type ResourceDefinition = { table: string; path: string; module: string; permission: string; companyScope: boolean; contractPath: boolean };
export const resources = [
  {
    "table": "company",
    "path": "/api/v1/org/organizations",
    "module": "ORG",
    "permission": "org",
    "companyScope": true,
    "contractPath": true
  },
  {
    "table": "organization_unit",
    "path": "/api/v1/org/organization-units",
    "module": "ORG",
    "permission": "org",
    "companyScope": true,
    "contractPath": false
  },
  {
    "table": "position",
    "path": "/api/v1/org/positions",
    "module": "ORG",
    "permission": "org",
    "companyScope": true,
    "contractPath": false
  },
  {
    "table": "employee",
    "path": "/api/v1/org/employee-accounts",
    "module": "ORG",
    "permission": "org",
    "companyScope": true,
    "contractPath": true
  },
  {
    "table": "system_role",
    "path": "/api/v1/org/system-roles",
    "module": "ORG",
    "permission": "rbac",
    "companyScope": true,
    "contractPath": true
  },
  {
    "table": "data_permission",
    "path": "/api/v1/org/data-scopes",
    "module": "ORG",
    "permission": "rbac",
    "companyScope": true,
    "contractPath": true
  },
  {
    "table": "farm_batch",
    "path": "/api/v1/farm/flock-batches",
    "module": "FARM",
    "permission": "production",
    "companyScope": true,
    "contractPath": true
  },
  {
    "table": "house_pen",
    "path": "/api/v1/farm/houses-and-pens",
    "module": "FARM",
    "permission": "production",
    "companyScope": true,
    "contractPath": true
  },
  {
    "table": "chick_receipt",
    "path": "/api/v1/farm/chick-arrival-inspections",
    "module": "FARM",
    "permission": "production",
    "companyScope": true,
    "contractPath": true
  },
  {
    "table": "feeding_record",
    "path": "/api/v1/farm/feeding-management",
    "module": "FARM",
    "permission": "production",
    "companyScope": true,
    "contractPath": true
  },
  {
    "table": "environment_record",
    "path": "/api/v1/farm/environment-shift-records",
    "module": "FARM",
    "permission": "production",
    "companyScope": true,
    "contractPath": true
  },
  {
    "table": "beak_trimming_record",
    "path": "/api/v1/farm/beak-trimming",
    "module": "FARM",
    "permission": "production",
    "companyScope": true,
    "contractPath": true
  },
  {
    "table": "weighing_record",
    "path": "/api/v1/farm/weighing-uniformity",
    "module": "FARM",
    "permission": "production",
    "companyScope": true,
    "contractPath": true
  },
  {
    "table": "transfer_record",
    "path": "/api/v1/farm/flock-transfers",
    "module": "FARM",
    "permission": "production",
    "companyScope": true,
    "contractPath": true
  },
  {
    "table": "mortality_cull_record",
    "path": "/api/v1/farm/mortality-disposal",
    "module": "FARM",
    "permission": "production",
    "companyScope": true,
    "contractPath": true
  },
  {
    "table": "vaccination_program",
    "path": "/api/v1/vet/vaccination-program-versions",
    "module": "VET",
    "permission": "vet",
    "companyScope": true,
    "contractPath": true
  },
  {
    "table": "vaccination_task",
    "path": "/api/v1/vet/vaccination-tasks",
    "module": "VET",
    "permission": "vet",
    "companyScope": true,
    "contractPath": true
  },
  {
    "table": "vaccination_execution",
    "path": "/api/v1/vet/vaccination-records",
    "module": "VET",
    "permission": "vet",
    "companyScope": true,
    "contractPath": true
  },
  {
    "table": "vaccine_requisition",
    "path": "/api/v1/vet/vaccine-issues",
    "module": "VET",
    "permission": "vet",
    "companyScope": true,
    "contractPath": true
  },
  {
    "table": "medication_prescription",
    "path": "/api/v1/vet/medication-prescriptions",
    "module": "VET",
    "permission": "vet",
    "companyScope": true,
    "contractPath": true
  },
  {
    "table": "withdrawal_period_record",
    "path": "/api/v1/vet/withdrawal-sale-controls",
    "module": "VET",
    "permission": "vet",
    "companyScope": true,
    "contractPath": true
  },
  {
    "table": "quarantine_certificate",
    "path": "/api/v1/vet/quarantine-certificates",
    "module": "VET",
    "permission": "vet",
    "companyScope": true,
    "contractPath": true
  },
  {
    "table": "purchase_requisition",
    "path": "/api/v1/proc/purchase-requisitions",
    "module": "PROC",
    "permission": "purchase",
    "companyScope": true,
    "contractPath": true
  },
  {
    "table": "purchase_order",
    "path": "/api/v1/proc/purchase-orders",
    "module": "PROC",
    "permission": "purchase",
    "companyScope": true,
    "contractPath": true
  },
  {
    "table": "supplier",
    "path": "/api/v1/proc/suppliers",
    "module": "PROC",
    "permission": "supplier",
    "companyScope": true,
    "contractPath": true
  },
  {
    "table": "goods_receipt",
    "path": "/api/v1/proc/receipt-inspections",
    "module": "PROC",
    "permission": "purchase",
    "companyScope": true,
    "contractPath": true
  },
  {
    "table": "material",
    "path": "/api/v1/inv/materials",
    "module": "INV",
    "permission": "master",
    "companyScope": true,
    "contractPath": true
  },
  {
    "table": "inventory_ledger",
    "path": "/api/v1/inv/inventory-ledger",
    "module": "INV",
    "permission": "inventory",
    "companyScope": true,
    "contractPath": true
  },
  {
    "table": "inbound_record",
    "path": "/api/v1/inv/stock-receipts",
    "module": "INV",
    "permission": "inventory",
    "companyScope": true,
    "contractPath": true
  },
  {
    "table": "outbound_record",
    "path": "/api/v1/inv/stock-issues",
    "module": "INV",
    "permission": "inventory",
    "companyScope": true,
    "contractPath": true
  },
  {
    "table": "warehouse_location",
    "path": "/api/v1/inv/stock-locations",
    "module": "INV",
    "permission": "inventory",
    "companyScope": true,
    "contractPath": true
  },
  {
    "table": "stocktake_record",
    "path": "/api/v1/inv/stock-counts",
    "module": "INV",
    "permission": "inventory",
    "companyScope": true,
    "contractPath": true
  },
  {
    "table": "batch_expiry",
    "path": "/api/v1/inv/batch-expiry-fefo",
    "module": "INV",
    "permission": "inventory",
    "companyScope": true,
    "contractPath": true
  },
  {
    "table": "safety_stock",
    "path": "/api/v1/inv/safety-stock-alerts",
    "module": "INV",
    "permission": "inventory",
    "companyScope": true,
    "contractPath": true
  },
  {
    "table": "customer",
    "path": "/api/v1/sales/customers",
    "module": "SALES",
    "permission": "customer",
    "companyScope": true,
    "contractPath": true
  },
  {
    "table": "price_list",
    "path": "/api/v1/sales/price-lists",
    "module": "SALES",
    "permission": "sales",
    "companyScope": true,
    "contractPath": true
  },
  {
    "table": "sales_order",
    "path": "/api/v1/sales/sales-orders",
    "module": "SALES",
    "permission": "sales",
    "companyScope": true,
    "contractPath": true
  },
  {
    "table": "credit_limit",
    "path": "/api/v1/sales/credit-checks",
    "module": "SALES",
    "permission": "sales",
    "companyScope": true,
    "contractPath": true
  },
  {
    "table": "payment_term_exception",
    "path": "/api/v1/sales/payment-term-exception",
    "module": "SALES",
    "permission": "sales",
    "companyScope": true,
    "contractPath": false
  },
  {
    "table": "delivery_task",
    "path": "/api/v1/log/routes-delivery-plans",
    "module": "LOG",
    "permission": "delivery",
    "companyScope": true,
    "contractPath": true
  },
  {
    "table": "vehicle_route",
    "path": "/api/v1/log/vehicles",
    "module": "LOG",
    "permission": "delivery",
    "companyScope": true,
    "contractPath": true
  },
  {
    "table": "delivery_receipt",
    "path": "/api/v1/log/delivery-signoffs",
    "module": "LOG",
    "permission": "delivery",
    "companyScope": true,
    "contractPath": true
  },
  {
    "table": "delivery_exception",
    "path": "/api/v1/log/delivery-exceptions",
    "module": "LOG",
    "permission": "delivery",
    "companyScope": true,
    "contractPath": true
  },
  {
    "table": "receivable",
    "path": "/api/v1/fin/receivables",
    "module": "FIN",
    "permission": "finance",
    "companyScope": true,
    "contractPath": true
  },
  {
    "table": "receipt_record",
    "path": "/api/v1/fin/receipts-and-cash",
    "module": "FIN",
    "permission": "finance",
    "companyScope": true,
    "contractPath": true
  },
  {
    "table": "cash_checkbook",
    "path": "/api/v1/fin/payments-and-checks",
    "module": "FIN",
    "permission": "finance",
    "companyScope": true,
    "contractPath": true
  },
  {
    "table": "payable",
    "path": "/api/v1/fin/payables",
    "module": "FIN",
    "permission": "finance",
    "companyScope": true,
    "contractPath": true
  },
  {
    "table": "payment_record",
    "path": "/api/v1/fin/payment-executions",
    "module": "FIN",
    "permission": "finance",
    "companyScope": true,
    "contractPath": true
  },
  {
    "table": "cost_allocation",
    "path": "/api/v1/fin/expense-allocations",
    "module": "FIN",
    "permission": "finance",
    "companyScope": true,
    "contractPath": true
  },
  {
    "table": "disbursement_voucher",
    "path": "/api/v1/fin/disbursement-vouchers",
    "module": "FIN",
    "permission": "finance",
    "companyScope": true,
    "contractPath": true
  },
  {
    "table": "equipment",
    "path": "/api/v1/eqp/equipment",
    "module": "EQP",
    "permission": "equipment",
    "companyScope": true,
    "contractPath": true
  },
  {
    "table": "equipment_check",
    "path": "/api/v1/eqp/equipment-inspections",
    "module": "EQP",
    "permission": "equipment",
    "companyScope": true,
    "contractPath": true
  },
  {
    "table": "maintenance_work_order",
    "path": "/api/v1/eqp/equipment-maintenance",
    "module": "EQP",
    "permission": "equipment",
    "companyScope": true,
    "contractPath": true
  },
  {
    "table": "spare_part",
    "path": "/api/v1/eqp/spare-parts-cross-company-support",
    "module": "EQP",
    "permission": "equipment",
    "companyScope": true,
    "contractPath": true
  },
  {
    "table": "metric_definition",
    "path": "/api/v1/rpt/metric-definition",
    "module": "RPT",
    "permission": "report",
    "companyScope": true,
    "contractPath": false
  },
  {
    "table": "report_record",
    "path": "/api/v1/rpt/report-record",
    "module": "RPT",
    "permission": "report",
    "companyScope": true,
    "contractPath": false
  },
  {
    "table": "dashboard_snapshot",
    "path": "/api/v1/rpt/dashboard-snapshot",
    "module": "RPT",
    "permission": "report",
    "companyScope": true,
    "contractPath": false
  },
  {
    "table": "print_template",
    "path": "/api/v1/print/print-template",
    "module": "PRINT",
    "permission": "print",
    "companyScope": true,
    "contractPath": false
  },
  {
    "table": "print_job",
    "path": "/api/v1/print/print-job",
    "module": "PRINT",
    "permission": "print",
    "companyScope": true,
    "contractPath": false
  },
  {
    "table": "print_log",
    "path": "/api/v1/print/print-log",
    "module": "PRINT",
    "permission": "print",
    "companyScope": true,
    "contractPath": false
  },
  {
    "table": "printer_device",
    "path": "/api/v1/print/printer-paper-adaptation",
    "module": "PRINT",
    "permission": "print",
    "companyScope": true,
    "contractPath": true
  },
  {
    "table": "audit_log",
    "path": "/api/v1/trace/operation-audit-logs",
    "module": "TRACE",
    "permission": "audit",
    "companyScope": true,
    "contractPath": true
  },
  {
    "table": "version_history",
    "path": "/api/v1/trace/document-archives",
    "module": "TRACE",
    "permission": "audit",
    "companyScope": true,
    "contractPath": true
  },
  {
    "table": "traceability_link",
    "path": "/api/v1/trace/material-vaccination-trace",
    "module": "TRACE",
    "permission": "audit",
    "companyScope": true,
    "contractPath": true
  },
  {
    "table": "attachment",
    "path": "/api/v1/plat/attachments-import-export",
    "module": "PLAT",
    "permission": "platform",
    "companyScope": true,
    "contractPath": true
  },
  {
    "table": "notification",
    "path": "/api/v1/plat/notifications",
    "module": "PLAT",
    "permission": "platform",
    "companyScope": true,
    "contractPath": true
  },
  {
    "table": "term_enum",
    "path": "/api/v1/plat/language-resources",
    "module": "PLAT",
    "permission": "platform",
    "companyScope": true,
    "contractPath": true
  },
  {
    "table": "offline_sync_record",
    "path": "/api/v1/plat/offline-sync-record",
    "module": "PLAT",
    "permission": "platform",
    "companyScope": true,
    "contractPath": false
  },
  {
    "table": "outbox_event",
    "path": "/api/v1/plat/outbox-event",
    "module": "PLAT",
    "permission": "platform",
    "companyScope": true,
    "contractPath": false
  },
  {
    "table": "idempotency_consumption",
    "path": "/api/v1/plat/idempotency-consumption",
    "module": "PLAT",
    "permission": "platform",
    "companyScope": true,
    "contractPath": false
  },
  {
    "table": "task_status",
    "path": "/api/v1/plat/task-status",
    "module": "PLAT",
    "permission": "platform",
    "companyScope": true,
    "contractPath": false
  }
] as const satisfies readonly ResourceDefinition[];
export const resourceByTable = new Map<string, ResourceDefinition>(resources.map((resource) => [resource.table, resource]));
