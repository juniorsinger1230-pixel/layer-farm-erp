// 由 scripts/generate-resource-route-policy.mjs 生成；临时未映射路径必须在 OpenAPI 变更后关闭。
export type ResourceRoutePolicyMode = "CRUD_AND_ACTION" | "READ_ONLY" | "TEMPORARY_UNMAPPED";
export type ResourceRoutePolicy = {
  table: string;
  path: string;
  mode: ResourceRoutePolicyMode;
  requirementId: string;
  useCaseId: string;
  allowedMethods: readonly string[];
};

export const resourceRoutePolicies = [
  {"table":"company","path":"/api/v1/org/organizations","mode":"CRUD_AND_ACTION","requirementId":"SRS-FR-ORG-001","useCaseId":"UC-ORG-001","allowedMethods":["GET","POST","PATCH"]},
  {"table":"organization_unit","path":"/api/v1/org/organization-units","mode":"TEMPORARY_UNMAPPED","requirementId":"","useCaseId":"","allowedMethods":["GET","POST","PATCH"]},
  {"table":"position","path":"/api/v1/org/positions","mode":"TEMPORARY_UNMAPPED","requirementId":"","useCaseId":"","allowedMethods":["GET","POST","PATCH"]},
  {"table":"employee","path":"/api/v1/org/employee-accounts","mode":"CRUD_AND_ACTION","requirementId":"SRS-FR-ORG-002","useCaseId":"UC-ORG-002","allowedMethods":["GET","POST","PATCH"]},
  {"table":"system_role","path":"/api/v1/org/system-roles","mode":"CRUD_AND_ACTION","requirementId":"SRS-FR-ORG-003","useCaseId":"UC-ORG-003","allowedMethods":["GET","POST","PATCH"]},
  {"table":"data_permission","path":"/api/v1/org/data-scopes","mode":"CRUD_AND_ACTION","requirementId":"SRS-FR-ORG-005","useCaseId":"UC-ORG-005","allowedMethods":["GET","POST","PATCH"]},
  {"table":"farm_batch","path":"/api/v1/farm/flock-batches","mode":"CRUD_AND_ACTION","requirementId":"SRS-FR-FARM-002","useCaseId":"UC-FARM-002","allowedMethods":["GET","POST","PATCH"]},
  {"table":"house_pen","path":"/api/v1/farm/houses-and-pens","mode":"CRUD_AND_ACTION","requirementId":"SRS-FR-FARM-003","useCaseId":"UC-FARM-003","allowedMethods":["GET","POST","PATCH"]},
  {"table":"chick_receipt","path":"/api/v1/farm/chick-arrival-inspections","mode":"CRUD_AND_ACTION","requirementId":"SRS-FR-FARM-004","useCaseId":"UC-FARM-004","allowedMethods":["GET","POST","PATCH"]},
  {"table":"feeding_record","path":"/api/v1/farm/feeding-management","mode":"CRUD_AND_ACTION","requirementId":"SRS-FR-FARM-005","useCaseId":"UC-FARM-005","allowedMethods":["GET","POST","PATCH"]},
  {"table":"environment_record","path":"/api/v1/farm/environment-shift-records","mode":"CRUD_AND_ACTION","requirementId":"SRS-FR-FARM-006","useCaseId":"UC-FARM-006","allowedMethods":["GET","POST","PATCH"]},
  {"table":"beak_trimming_record","path":"/api/v1/farm/beak-trimming","mode":"CRUD_AND_ACTION","requirementId":"SRS-FR-FARM-007","useCaseId":"UC-FARM-007","allowedMethods":["GET","POST","PATCH"]},
  {"table":"weighing_record","path":"/api/v1/farm/weighing-uniformity","mode":"CRUD_AND_ACTION","requirementId":"SRS-FR-FARM-008","useCaseId":"UC-FARM-008","allowedMethods":["GET","POST","PATCH"]},
  {"table":"transfer_record","path":"/api/v1/farm/flock-transfers","mode":"CRUD_AND_ACTION","requirementId":"SRS-FR-FARM-009","useCaseId":"UC-FARM-009","allowedMethods":["GET","POST","PATCH"]},
  {"table":"mortality_cull_record","path":"/api/v1/farm/mortality-disposal","mode":"CRUD_AND_ACTION","requirementId":"SRS-FR-FARM-010","useCaseId":"UC-FARM-010","allowedMethods":["GET","POST","PATCH"]},
  {"table":"vaccination_program","path":"/api/v1/vet/vaccination-program-versions","mode":"CRUD_AND_ACTION","requirementId":"SRS-FR-VET-001","useCaseId":"UC-VET-001","allowedMethods":["GET","POST","PATCH"]},
  {"table":"vaccination_task","path":"/api/v1/vet/vaccination-tasks","mode":"CRUD_AND_ACTION","requirementId":"SRS-FR-VET-002","useCaseId":"UC-VET-002","allowedMethods":["GET","POST","PATCH"]},
  {"table":"vaccination_execution","path":"/api/v1/vet/vaccination-records","mode":"CRUD_AND_ACTION","requirementId":"SRS-FR-VET-003","useCaseId":"UC-VET-003","allowedMethods":["GET","POST","PATCH"]},
  {"table":"vaccine_requisition","path":"/api/v1/vet/vaccine-issues","mode":"CRUD_AND_ACTION","requirementId":"SRS-FR-VET-004","useCaseId":"UC-VET-004","allowedMethods":["GET","POST","PATCH"]},
  {"table":"medication_prescription","path":"/api/v1/vet/medication-prescriptions","mode":"CRUD_AND_ACTION","requirementId":"SRS-FR-VET-005","useCaseId":"UC-VET-005","allowedMethods":["GET","POST","PATCH"]},
  {"table":"withdrawal_period_record","path":"/api/v1/vet/withdrawal-sale-controls","mode":"CRUD_AND_ACTION","requirementId":"SRS-FR-VET-006","useCaseId":"UC-VET-006","allowedMethods":["GET","POST","PATCH"]},
  {"table":"quarantine_certificate","path":"/api/v1/vet/quarantine-certificates","mode":"CRUD_AND_ACTION","requirementId":"SRS-FR-VET-007","useCaseId":"UC-VET-007","allowedMethods":["GET","POST","PATCH"]},
  {"table":"purchase_requisition","path":"/api/v1/proc/purchase-requisitions","mode":"CRUD_AND_ACTION","requirementId":"SRS-FR-PROC-001","useCaseId":"UC-PROC-001","allowedMethods":["GET","POST","PATCH"]},
  {"table":"purchase_order","path":"/api/v1/proc/purchase-orders","mode":"CRUD_AND_ACTION","requirementId":"SRS-FR-PROC-002","useCaseId":"UC-PROC-002","allowedMethods":["GET","POST","PATCH"]},
  {"table":"supplier","path":"/api/v1/proc/suppliers","mode":"CRUD_AND_ACTION","requirementId":"SRS-FR-PROC-003","useCaseId":"UC-PROC-003","allowedMethods":["GET","POST","PATCH"]},
  {"table":"goods_receipt","path":"/api/v1/proc/receipt-inspections","mode":"CRUD_AND_ACTION","requirementId":"SRS-FR-PROC-004","useCaseId":"UC-PROC-004","allowedMethods":["GET","POST","PATCH"]},
  {"table":"material","path":"/api/v1/inv/materials","mode":"CRUD_AND_ACTION","requirementId":"SRS-FR-INV-001","useCaseId":"UC-INV-001","allowedMethods":["GET","POST","PATCH"]},
  {"table":"inventory_ledger","path":"/api/v1/inv/inventory-ledger","mode":"READ_ONLY","requirementId":"SRS-FR-INV-002","useCaseId":"UC-INV-002","allowedMethods":["GET"]},
  {"table":"inbound_record","path":"/api/v1/inv/stock-receipts","mode":"CRUD_AND_ACTION","requirementId":"SRS-FR-INV-003","useCaseId":"UC-INV-003","allowedMethods":["GET","POST","PATCH"]},
  {"table":"outbound_record","path":"/api/v1/inv/stock-issues","mode":"CRUD_AND_ACTION","requirementId":"SRS-FR-INV-004","useCaseId":"UC-INV-004","allowedMethods":["GET","POST","PATCH"]},
  {"table":"warehouse_location","path":"/api/v1/inv/stock-locations","mode":"CRUD_AND_ACTION","requirementId":"SRS-FR-INV-005","useCaseId":"UC-INV-005","allowedMethods":["GET","POST","PATCH"]},
  {"table":"stocktake_record","path":"/api/v1/inv/stock-counts","mode":"CRUD_AND_ACTION","requirementId":"SRS-FR-INV-006","useCaseId":"UC-INV-006","allowedMethods":["GET","POST","PATCH"]},
  {"table":"batch_expiry","path":"/api/v1/inv/batch-expiry-fefo","mode":"CRUD_AND_ACTION","requirementId":"SRS-FR-INV-007","useCaseId":"UC-INV-007","allowedMethods":["GET","POST","PATCH"]},
  {"table":"safety_stock","path":"/api/v1/inv/safety-stock-alerts","mode":"READ_ONLY","requirementId":"SRS-FR-INV-008","useCaseId":"UC-INV-008","allowedMethods":["GET"]},
  {"table":"customer","path":"/api/v1/sales/customers","mode":"CRUD_AND_ACTION","requirementId":"SRS-FR-SALES-001","useCaseId":"UC-SALES-001","allowedMethods":["GET","POST","PATCH"]},
  {"table":"price_list","path":"/api/v1/sales/price-lists","mode":"CRUD_AND_ACTION","requirementId":"SRS-FR-SALES-002","useCaseId":"UC-SALES-002","allowedMethods":["GET","POST","PATCH"]},
  {"table":"sales_order","path":"/api/v1/sales/sales-orders","mode":"CRUD_AND_ACTION","requirementId":"SRS-FR-SALES-003","useCaseId":"UC-SALES-003","allowedMethods":["GET","POST","PATCH"]},
  {"table":"credit_limit","path":"/api/v1/sales/credit-checks","mode":"CRUD_AND_ACTION","requirementId":"SRS-FR-SALES-004","useCaseId":"UC-SALES-004","allowedMethods":["GET","POST","PATCH"]},
  {"table":"delivery_task","path":"/api/v1/log/routes-delivery-plans","mode":"CRUD_AND_ACTION","requirementId":"SRS-FR-LOG-002","useCaseId":"UC-LOG-002","allowedMethods":["GET","POST","PATCH"]},
  {"table":"vehicle_route","path":"/api/v1/log/vehicles","mode":"CRUD_AND_ACTION","requirementId":"SRS-FR-LOG-001","useCaseId":"UC-LOG-001","allowedMethods":["GET","POST","PATCH"]},
  {"table":"delivery_receipt","path":"/api/v1/log/delivery-signoffs","mode":"CRUD_AND_ACTION","requirementId":"SRS-FR-LOG-004","useCaseId":"UC-LOG-004","allowedMethods":["GET","POST","PATCH"]},
  {"table":"delivery_exception","path":"/api/v1/log/delivery-exceptions","mode":"CRUD_AND_ACTION","requirementId":"SRS-FR-LOG-005","useCaseId":"UC-LOG-005","allowedMethods":["GET","POST","PATCH"]},
  {"table":"receivable","path":"/api/v1/fin/receivables","mode":"CRUD_AND_ACTION","requirementId":"SRS-FR-FIN-002","useCaseId":"UC-FIN-002","allowedMethods":["GET","POST","PATCH"]},
  {"table":"receipt_record","path":"/api/v1/fin/receipts-and-cash","mode":"CRUD_AND_ACTION","requirementId":"SRS-FR-FIN-004","useCaseId":"UC-FIN-004","allowedMethods":["GET","POST","PATCH"]},
  {"table":"cash_checkbook","path":"/api/v1/fin/payments-and-checks","mode":"CRUD_AND_ACTION","requirementId":"SRS-FR-FIN-003","useCaseId":"UC-FIN-003","allowedMethods":["GET","POST","PATCH"]},
  {"table":"payable","path":"/api/v1/fin/payables","mode":"CRUD_AND_ACTION","requirementId":"SRS-FR-FIN-001","useCaseId":"UC-FIN-001","allowedMethods":["GET","POST","PATCH"]},
  {"table":"payment_record","path":"/api/v1/fin/payment-executions","mode":"CRUD_AND_ACTION","requirementId":"SRS-FR-FIN-010","useCaseId":"UC-FIN-010","allowedMethods":["GET","POST","PATCH"]},
  {"table":"cost_allocation","path":"/api/v1/fin/expense-allocations","mode":"CRUD_AND_ACTION","requirementId":"SRS-FR-FIN-005","useCaseId":"UC-FIN-005","allowedMethods":["GET","POST","PATCH"]},
  {"table":"disbursement_voucher","path":"/api/v1/fin/disbursement-vouchers","mode":"CRUD_AND_ACTION","requirementId":"SRS-FR-FIN-009","useCaseId":"UC-FIN-009","allowedMethods":["GET","POST","PATCH"]},
  {"table":"equipment","path":"/api/v1/eqp/equipment","mode":"CRUD_AND_ACTION","requirementId":"SRS-FR-EQP-001","useCaseId":"UC-EQP-001","allowedMethods":["GET","POST","PATCH"]},
  {"table":"equipment_check","path":"/api/v1/eqp/equipment-inspections","mode":"CRUD_AND_ACTION","requirementId":"SRS-FR-EQP-002","useCaseId":"UC-EQP-002","allowedMethods":["GET","POST","PATCH"]},
  {"table":"maintenance_work_order","path":"/api/v1/eqp/equipment-maintenance","mode":"CRUD_AND_ACTION","requirementId":"SRS-FR-EQP-003","useCaseId":"UC-EQP-003","allowedMethods":["GET","POST","PATCH"]},
  {"table":"spare_part","path":"/api/v1/eqp/spare-parts-cross-company-support","mode":"CRUD_AND_ACTION","requirementId":"SRS-FR-EQP-005","useCaseId":"UC-EQP-005","allowedMethods":["GET","POST","PATCH"]},
  {"table":"dashboard_snapshot","path":"/api/v1/rpt/dashboard-snapshot","mode":"TEMPORARY_UNMAPPED","requirementId":"","useCaseId":"","allowedMethods":["GET","POST","PATCH"]},
  {"table":"print_job","path":"/api/v1/print/print-job","mode":"TEMPORARY_UNMAPPED","requirementId":"","useCaseId":"","allowedMethods":["GET","POST","PATCH"]},
  {"table":"printer_device","path":"/api/v1/print/printer-paper-adaptation","mode":"CRUD_AND_ACTION","requirementId":"SRS-FR-PRINT-006","useCaseId":"UC-PRINT-006","allowedMethods":["GET","POST","PATCH"]},
  {"table":"audit_log","path":"/api/v1/trace/operation-audit-logs","mode":"READ_ONLY","requirementId":"SRS-FR-TRACE-002","useCaseId":"UC-TRACE-002","allowedMethods":["GET"]},
  {"table":"version_history","path":"/api/v1/trace/document-archives","mode":"READ_ONLY","requirementId":"SRS-FR-TRACE-004","useCaseId":"UC-TRACE-004","allowedMethods":["GET"]},
  {"table":"traceability_link","path":"/api/v1/trace/material-vaccination-trace","mode":"READ_ONLY","requirementId":"SRS-FR-TRACE-003","useCaseId":"UC-TRACE-003","allowedMethods":["GET"]},
  {"table":"attachment","path":"/api/v1/plat/attachments-import-export","mode":"CRUD_AND_ACTION","requirementId":"SRS-FR-PLAT-004","useCaseId":"UC-PLAT-004","allowedMethods":["GET","POST","PATCH"]},
  {"table":"notification","path":"/api/v1/plat/notifications","mode":"CRUD_AND_ACTION","requirementId":"SRS-FR-PLAT-003","useCaseId":"UC-PLAT-003","allowedMethods":["GET","POST","PATCH"]},
  {"table":"term_enum","path":"/api/v1/plat/language-resources","mode":"CRUD_AND_ACTION","requirementId":"SRS-FR-PLAT-002","useCaseId":"UC-PLAT-002","allowedMethods":["GET","POST","PATCH"]},
] as const satisfies readonly ResourceRoutePolicy[];

export const resourceRoutePolicyByPath = new Map<string, ResourceRoutePolicy>(
  resourceRoutePolicies.map((policy) => [policy.path, policy]),
);
