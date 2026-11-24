# OpenAPI 双向核对报告

- 检查时间：2026-11-24T06:54:46.412Z
- 检查范围：route and HTTP method bidirectional coverage
- 检查结论：**未通过**
- 技术栈：Hono + Node.js + TypeScript，权威契约为 OpenAPI 3.1

## 1. 输入与核对口径

| 输入 | 路径 |
|---|---|
| openapiPath | ../../../SRS_需求规格化与基线/SRS08_OpenAPI3.1初版.json |
| mappingPath | ../../../SRS_需求规格化与基线/SRS08_API需求操作映射.json |
| appPath | apps/api/src/app.ts |
| resourcesPath | packages/domain/src/generated/resources.ts |
| policyPath | packages/domain/src/generated/resource-route-policy.ts |

核对规则：

- OpenAPI 到实现：权威契约中的每个方法和路径必须存在 Hono 路由。
- 实现到 OpenAPI：每个生产 API 路由必须在 OpenAPI 中登记。
- Hono 路径参数 `:id` 统一规范化为 OpenAPI 的 `{id}`。
- `/metrics` 与 `/health/*` 属于运维端点，不纳入本次 402 个业务 API 契约。

## 2. 汇总结果

| 指标 | 数量 |
|---|---:|
| OpenAPI 路径数 | 250 |
| OpenAPI 操作数 | 402 |
| API 映射用例数 | 87 |
| 实际 API 操作数 | 359 |
| 已匹配操作 | 280 |
| 契约覆盖率 | 69.65% |
| 缺失实现 | 122 |
| 未文档化操作 | 79 |
| 其中：显式 Hono 路由未文档化 | 59 |
| 其中：通用生成路由未文档化 | 20 |
| 只读契约仍暴露写操作 | 0 |
| 非契约资源通用端点 | 20 |

### 缺失实现按领域分布

| 领域 | 数量 |
|---|---:|
| ORG | 10 |
| FARM | 13 |
| VET | 5 |
| PROC | 10 |
| SALES | 15 |
| LOG | 10 |
| FIN | 9 |
| EQP | 5 |
| RPT | 13 |
| PRINT | 25 |
| TRACE | 2 |
| PLAT | 5 |

## 3. 代码实证

- 通用资源路由生成循环位于 `apps/api/src/app.ts:645`，现在先读取 `resourceRoutePolicyByPath`，仅注册策略允许的方法。
- 资源定义来自 `packages/domain/src/generated/resources.ts`；没有路由策略的资源不会注册通用端点。
- 显式业务路由在 `apps/api/src/app.ts` 中逐个声明，具体行号见下表。

### 3.1 只读契约写暴露

无。

### 3.2 非契约资源

| 资源路径 | 表 | 代码位置 |
|---|---|---|
| /api/v1/org/organization-units | organization_unit | apps/api/src/app.ts:645 |
| /api/v1/org/positions | position | apps/api/src/app.ts:645 |
| /api/v1/rpt/dashboard-snapshot | dashboard_snapshot | apps/api/src/app.ts:645 |
| /api/v1/print/print-job | print_job | apps/api/src/app.ts:645 |

### 3.3 已停止通用注册的资源

| 资源路径 |
|---|
| /api/v1/sales/payment-term-exception |
| /api/v1/rpt/metric-definition |
| /api/v1/rpt/report-record |
| /api/v1/print/print-template |
| /api/v1/print/print-log |
| /api/v1/plat/offline-sync-record |
| /api/v1/plat/outbox-event |
| /api/v1/plat/idempotency-consumption |
| /api/v1/plat/task-status |

## 4. 缺失实现明细

以下为 OpenAPI 已定义但代码中不存在的操作。

| 方法 | 路径 | operationId | 标签 | 需求 | 代码位置 |
| --- | --- | --- | --- | --- | --- |
| GET | /api/v1/org/position-role-mappings | list_uc_org_004 | ORG | SRS-FR-ORG-004 |  |
| POST | /api/v1/org/position-role-mappings | submit_uc_org_004 | ORG | SRS-FR-ORG-004 |  |
| GET | /api/v1/org/position-role-mappings/{id} | get_uc_org_004 | ORG | SRS-FR-ORG-004 |  |
| PATCH | /api/v1/org/position-role-mappings/{id} | update_uc_org_004 | ORG | SRS-FR-ORG-004 |  |
| POST | /api/v1/org/position-role-mappings/{id}/actions | transition_uc_org_004 | ORG | SRS-FR-ORG-004 |  |
| GET | /api/v1/org/role-delegations | list_uc_org_006 | ORG | SRS-FR-ORG-006 |  |
| POST | /api/v1/org/role-delegations | submit_uc_org_006 | ORG | SRS-FR-ORG-006 |  |
| GET | /api/v1/org/role-delegations/{id} | get_uc_org_006 | ORG | SRS-FR-ORG-006 |  |
| PATCH | /api/v1/org/role-delegations/{id} | update_uc_org_006 | ORG | SRS-FR-ORG-006 |  |
| POST | /api/v1/org/role-delegations/{id}/actions | transition_uc_org_006 | ORG | SRS-FR-ORG-006 |  |
| GET | /api/v1/farm/flock-projects | list_uc_farm_001 | FARM | SRS-FR-FARM-001 |  |
| POST | /api/v1/farm/flock-projects | submit_uc_farm_001 | FARM | SRS-FR-FARM-001 |  |
| GET | /api/v1/farm/flock-projects/{id} | get_uc_farm_001 | FARM | SRS-FR-FARM-001 |  |
| PATCH | /api/v1/farm/flock-projects/{id} | update_uc_farm_001 | FARM | SRS-FR-FARM-001 |  |
| POST | /api/v1/farm/flock-projects/{id}/actions | transition_uc_farm_001 | FARM | SRS-FR-FARM-001 |  |
| GET | /api/v1/farm/egg-collection-grading/{id} | get_uc_farm_011 | FARM | SRS-FR-FARM-011 |  |
| PATCH | /api/v1/farm/egg-collection-grading/{id} | update_uc_farm_011 | FARM | SRS-FR-FARM-011 |  |
| POST | /api/v1/farm/egg-collection-grading/{id}/actions | transition_uc_farm_011 | FARM | SRS-FR-FARM-011 |  |
| GET | /api/v1/farm/culling-and-batch-closing | list_uc_farm_012 | FARM | SRS-FR-FARM-012 |  |
| POST | /api/v1/farm/culling-and-batch-closing | submit_uc_farm_012 | FARM | SRS-FR-FARM-012 |  |
| GET | /api/v1/farm/culling-and-batch-closing/{id} | get_uc_farm_012 | FARM | SRS-FR-FARM-012 |  |
| PATCH | /api/v1/farm/culling-and-batch-closing/{id} | update_uc_farm_012 | FARM | SRS-FR-FARM-012 |  |
| POST | /api/v1/farm/culling-and-batch-closing/{id}/actions | transition_uc_farm_012 | FARM | SRS-FR-FARM-012 |  |
| GET | /api/v1/vet/missed-vaccination-adverse-reactions | list_uc_vet_008 | VET | SRS-FR-VET-008 |  |
| POST | /api/v1/vet/missed-vaccination-adverse-reactions | submit_uc_vet_008 | VET | SRS-FR-VET-008 |  |
| GET | /api/v1/vet/missed-vaccination-adverse-reactions/{id} | get_uc_vet_008 | VET | SRS-FR-VET-008 |  |
| PATCH | /api/v1/vet/missed-vaccination-adverse-reactions/{id} | update_uc_vet_008 | VET | SRS-FR-VET-008 |  |
| POST | /api/v1/vet/missed-vaccination-adverse-reactions/{id}/actions | transition_uc_vet_008 | VET | SRS-FR-VET-008 |  |
| GET | /api/v1/proc/purchase-returns | list_uc_proc_005 | PROC | SRS-FR-PROC-005 |  |
| POST | /api/v1/proc/purchase-returns | submit_uc_proc_005 | PROC | SRS-FR-PROC-005 |  |
| GET | /api/v1/proc/purchase-returns/{id} | get_uc_proc_005 | PROC | SRS-FR-PROC-005 |  |
| PATCH | /api/v1/proc/purchase-returns/{id} | update_uc_proc_005 | PROC | SRS-FR-PROC-005 |  |
| POST | /api/v1/proc/purchase-returns/{id}/actions | transition_uc_proc_005 | PROC | SRS-FR-PROC-005 |  |
| GET | /api/v1/proc/emergency-purchases | list_uc_proc_006 | PROC | SRS-FR-PROC-006 |  |
| POST | /api/v1/proc/emergency-purchases | submit_uc_proc_006 | PROC | SRS-FR-PROC-006 |  |
| GET | /api/v1/proc/emergency-purchases/{id} | get_uc_proc_006 | PROC | SRS-FR-PROC-006 |  |
| PATCH | /api/v1/proc/emergency-purchases/{id} | update_uc_proc_006 | PROC | SRS-FR-PROC-006 |  |
| POST | /api/v1/proc/emergency-purchases/{id}/actions | transition_uc_proc_006 | PROC | SRS-FR-PROC-006 |  |
| GET | /api/v1/sales/sales-fulfilment | list_uc_sales_005 | SALES | SRS-FR-SALES-005 |  |
| POST | /api/v1/sales/sales-fulfilment | submit_uc_sales_005 | SALES | SRS-FR-SALES-005 |  |
| GET | /api/v1/sales/sales-fulfilment/{id} | get_uc_sales_005 | SALES | SRS-FR-SALES-005 |  |
| PATCH | /api/v1/sales/sales-fulfilment/{id} | update_uc_sales_005 | SALES | SRS-FR-SALES-005 |  |
| POST | /api/v1/sales/sales-fulfilment/{id}/actions | transition_uc_sales_005 | SALES | SRS-FR-SALES-005 |  |
| GET | /api/v1/sales/sales-returns-order-changes | list_uc_sales_006 | SALES | SRS-FR-SALES-006 |  |
| POST | /api/v1/sales/sales-returns-order-changes | submit_uc_sales_006 | SALES | SRS-FR-SALES-006 |  |
| GET | /api/v1/sales/sales-returns-order-changes/{id} | get_uc_sales_006 | SALES | SRS-FR-SALES-006 |  |
| PATCH | /api/v1/sales/sales-returns-order-changes/{id} | update_uc_sales_006 | SALES | SRS-FR-SALES-006 |  |
| POST | /api/v1/sales/sales-returns-order-changes/{id}/actions | transition_uc_sales_006 | SALES | SRS-FR-SALES-006 |  |
| GET | /api/v1/sales/pullets-and-culled-birds-sales | list_uc_sales_007 | SALES | SRS-FR-SALES-007 |  |
| POST | /api/v1/sales/pullets-and-culled-birds-sales | submit_uc_sales_007 | SALES | SRS-FR-SALES-007 |  |
| GET | /api/v1/sales/pullets-and-culled-birds-sales/{id} | get_uc_sales_007 | SALES | SRS-FR-SALES-007 |  |
| PATCH | /api/v1/sales/pullets-and-culled-birds-sales/{id} | update_uc_sales_007 | SALES | SRS-FR-SALES-007 |  |
| POST | /api/v1/sales/pullets-and-culled-birds-sales/{id}/actions | transition_uc_sales_007 | SALES | SRS-FR-SALES-007 |  |
| GET | /api/v1/log/night-loading | list_uc_log_003 | LOG | SRS-FR-LOG-003 |  |
| POST | /api/v1/log/night-loading | submit_uc_log_003 | LOG | SRS-FR-LOG-003 |  |
| GET | /api/v1/log/night-loading/{id} | get_uc_log_003 | LOG | SRS-FR-LOG-003 |  |
| PATCH | /api/v1/log/night-loading/{id} | update_uc_log_003 | LOG | SRS-FR-LOG-003 |  |
| POST | /api/v1/log/night-loading/{id}/actions | transition_uc_log_003 | LOG | SRS-FR-LOG-003 |  |
| GET | /api/v1/log/driver-tasks | list_uc_log_006 | LOG | SRS-FR-LOG-006 |  |
| POST | /api/v1/log/driver-tasks | submit_uc_log_006 | LOG | SRS-FR-LOG-006 |  |
| GET | /api/v1/log/driver-tasks/{id} | get_uc_log_006 | LOG | SRS-FR-LOG-006 |  |
| PATCH | /api/v1/log/driver-tasks/{id} | update_uc_log_006 | LOG | SRS-FR-LOG-006 |  |
| POST | /api/v1/log/driver-tasks/{id}/actions | transition_uc_log_006 | LOG | SRS-FR-LOG-006 |  |
| GET | /api/v1/fin/batch-cost-cards | list_uc_fin_006 | FIN | SRS-FR-FIN-006 |  |
| GET | /api/v1/fin/batch-cost-cards/{id} | get_uc_fin_006 | FIN | SRS-FR-FIN-006 |  |
| GET | /api/v1/fin/profit-and-batch-settlement | list_uc_fin_007 | FIN | SRS-FR-FIN-007 |  |
| POST | /api/v1/fin/profit-and-batch-settlement | submit_uc_fin_007 | FIN | SRS-FR-FIN-007 |  |
| GET | /api/v1/fin/profit-and-batch-settlement/{id} | get_uc_fin_007 | FIN | SRS-FR-FIN-007 |  |
| PATCH | /api/v1/fin/profit-and-batch-settlement/{id} | update_uc_fin_007 | FIN | SRS-FR-FIN-007 |  |
| POST | /api/v1/fin/profit-and-batch-settlement/{id}/actions | transition_uc_fin_007 | FIN | SRS-FR-FIN-007 |  |
| GET | /api/v1/fin/financial-reconciliation-reports | list_uc_fin_008 | FIN | SRS-FR-FIN-008 |  |
| GET | /api/v1/fin/financial-reconciliation-reports/{id} | get_uc_fin_008 | FIN | SRS-FR-FIN-008 |  |
| GET | /api/v1/eqp/equipment-repairs | list_uc_eqp_004 | EQP | SRS-FR-EQP-001 |  |
| POST | /api/v1/eqp/equipment-repairs | submit_uc_eqp_004 | EQP | SRS-FR-EQP-001 |  |
| GET | /api/v1/eqp/equipment-repairs/{id} | get_uc_eqp_004 | EQP | SRS-FR-EQP-001 |  |
| PATCH | /api/v1/eqp/equipment-repairs/{id} | update_uc_eqp_004 | EQP | SRS-FR-EQP-001 |  |
| POST | /api/v1/eqp/equipment-repairs/{id}/actions | transition_uc_eqp_004 | EQP | SRS-FR-EQP-001 |  |
| GET | /api/v1/rpt/management-dashboard | list_uc_rpt_001 | RPT | SRS-FR-RPT-001 |  |
| GET | /api/v1/rpt/management-dashboard/{id} | get_uc_rpt_001 | RPT | SRS-FR-RPT-001 |  |
| GET | /api/v1/rpt/production-reports | list_uc_rpt_002 | RPT | SRS-FR-RPT-002 |  |
| GET | /api/v1/rpt/production-reports/{id} | get_uc_rpt_002 | RPT | SRS-FR-RPT-002 |  |
| GET | /api/v1/rpt/inventory-purchase-reports | list_uc_rpt_003 | RPT | SRS-FR-RPT-003 |  |
| GET | /api/v1/rpt/inventory-purchase-reports/{id} | get_uc_rpt_003 | RPT | SRS-FR-RPT-003 |  |
| GET | /api/v1/rpt/sales-finance-reports | list_uc_rpt_004 | RPT | SRS-FR-RPT-004 |  |
| GET | /api/v1/rpt/sales-finance-reports/{id} | get_uc_rpt_004 | RPT | SRS-FR-RPT-004 |  |
| GET | /api/v1/rpt/report-exports | list_uc_rpt_005 | RPT | SRS-FR-RPT-005 |  |
| POST | /api/v1/rpt/report-exports | submit_uc_rpt_005 | RPT | SRS-FR-RPT-005 |  |
| GET | /api/v1/rpt/report-exports/{id} | get_uc_rpt_005 | RPT | SRS-FR-RPT-005 |  |
| PATCH | /api/v1/rpt/report-exports/{id} | update_uc_rpt_005 | RPT | SRS-FR-RPT-005 |  |
| POST | /api/v1/rpt/report-exports/{id}/actions | transition_uc_rpt_005 | RPT | SRS-FR-RPT-005 |  |
| GET | /api/v1/print/print-template-versions | list_uc_print_001 | PRINT | SRS-FR-PRINT-001 |  |
| POST | /api/v1/print/print-template-versions | submit_uc_print_001 | PRINT | SRS-FR-PRINT-001 |  |
| GET | /api/v1/print/print-template-versions/{id} | get_uc_print_001 | PRINT | SRS-FR-PRINT-001 |  |
| PATCH | /api/v1/print/print-template-versions/{id} | update_uc_print_001 | PRINT | SRS-FR-PRINT-001 |  |
| POST | /api/v1/print/print-template-versions/{id}/actions | transition_uc_print_001 | PRINT | SRS-FR-PRINT-001 |  |
| GET | /api/v1/print/delivery-note-printing | list_uc_print_002 | PRINT | SRS-FR-PRINT-002 |  |
| POST | /api/v1/print/delivery-note-printing | submit_uc_print_002 | PRINT | SRS-FR-PRINT-002 |  |
| GET | /api/v1/print/delivery-note-printing/{id} | get_uc_print_002 | PRINT | SRS-FR-PRINT-002 |  |
| PATCH | /api/v1/print/delivery-note-printing/{id} | update_uc_print_002 | PRINT | SRS-FR-PRINT-002 |  |
| POST | /api/v1/print/delivery-note-printing/{id}/actions | transition_uc_print_002 | PRINT | SRS-FR-PRINT-002 |  |
| GET | /api/v1/print/cash-check-printing | list_uc_print_003 | PRINT | SRS-FR-PRINT-003 |  |
| POST | /api/v1/print/cash-check-printing | submit_uc_print_003 | PRINT | SRS-FR-PRINT-003 |  |
| GET | /api/v1/print/cash-check-printing/{id} | get_uc_print_003 | PRINT | SRS-FR-PRINT-003 |  |
| PATCH | /api/v1/print/cash-check-printing/{id} | update_uc_print_003 | PRINT | SRS-FR-PRINT-003 |  |
| POST | /api/v1/print/cash-check-printing/{id}/actions | transition_uc_print_003 | PRINT | SRS-FR-PRINT-003 |  |
| GET | /api/v1/print/labels-business-document-printing | list_uc_print_004 | PRINT | SRS-FR-PRINT-004 |  |
| POST | /api/v1/print/labels-business-document-printing | submit_uc_print_004 | PRINT | SRS-FR-PRINT-004 |  |
| GET | /api/v1/print/labels-business-document-printing/{id} | get_uc_print_004 | PRINT | SRS-FR-PRINT-004 |  |
| PATCH | /api/v1/print/labels-business-document-printing/{id} | update_uc_print_004 | PRINT | SRS-FR-PRINT-004 |  |
| POST | /api/v1/print/labels-business-document-printing/{id}/actions | transition_uc_print_004 | PRINT | SRS-FR-PRINT-004 |  |
| GET | /api/v1/print/reprint-void-audit | list_uc_print_005 | PRINT | SRS-FR-PRINT-005 |  |
| POST | /api/v1/print/reprint-void-audit | submit_uc_print_005 | PRINT | SRS-FR-PRINT-005 |  |
| GET | /api/v1/print/reprint-void-audit/{id} | get_uc_print_005 | PRINT | SRS-FR-PRINT-005 |  |
| PATCH | /api/v1/print/reprint-void-audit/{id} | update_uc_print_005 | PRINT | SRS-FR-PRINT-005 |  |
| POST | /api/v1/print/reprint-void-audit/{id}/actions | transition_uc_print_005 | PRINT | SRS-FR-PRINT-005 |  |
| GET | /api/v1/trace/batch-end-to-end-trace | list_uc_trace_001 | TRACE | SRS-FR-TRACE-001 |  |
| GET | /api/v1/trace/batch-end-to-end-trace/{id} | get_uc_trace_001 | TRACE | SRS-FR-TRACE-001 |  |
| GET | /api/v1/plat/authentication-sessions | list_uc_plat_001 | PLAT | SRS-FR-PLAT-001 |  |
| POST | /api/v1/plat/authentication-sessions | submit_uc_plat_001 | PLAT | SRS-FR-PLAT-001 |  |
| GET | /api/v1/plat/authentication-sessions/{id} | get_uc_plat_001 | PLAT | SRS-FR-PLAT-001 |  |
| PATCH | /api/v1/plat/authentication-sessions/{id} | update_uc_plat_001 | PLAT | SRS-FR-PLAT-001 |  |
| POST | /api/v1/plat/authentication-sessions/{id}/actions | transition_uc_plat_001 | PLAT | SRS-FR-PLAT-001 |  |

## 5. 未文档化显式路由明细

以下为代码中显式声明、但未纳入权威 OpenAPI 的生产 API。

| 方法 | 路径 | operationId | 标签 | 代码位置 |
| --- | --- | --- | --- | --- |
| POST | /api/v1/auth/login |  |  | apps/api/src/app.ts:162 |
| POST | /api/v1/auth/refresh |  |  | apps/api/src/app.ts:171 |
| GET | /api/v1/auth/me |  |  | apps/api/src/app.ts:192 |
| POST | /api/v1/auth/logout |  |  | apps/api/src/app.ts:207 |
| GET | /api/v1/org/role-permissions |  |  | apps/api/src/app.ts:212 |
| POST | /api/v1/farm/feeding-management/{id}/issue |  |  | apps/api/src/app.ts:242 |
| POST | /api/v1/farm/flock-batches/{id}/cost-postings |  |  | apps/api/src/app.ts:249 |
| GET | /api/v1/farm/flock-batches/{id}/cost |  |  | apps/api/src/app.ts:257 |
| GET | /api/v1/farm/flock-batches/{id}/positions |  |  | apps/api/src/app.ts:273 |
| GET | /api/v1/print/print-templates/{id}/design |  |  | apps/api/src/app.ts:294 |
| POST | /api/v1/print/print-templates/{id}/design |  |  | apps/api/src/app.ts:299 |
| POST | /api/v1/print/print-templates/{id}/design/{designId}/publish |  |  | apps/api/src/app.ts:307 |
| POST | /api/v1/print/design-preview |  |  | apps/api/src/app.ts:312 |
| POST | /api/v1/print/print-job/submit |  |  | apps/api/src/app.ts:320 |
| POST | /api/v1/print/print-job/{id}/dispatch |  |  | apps/api/src/app.ts:327 |
| POST | /api/v1/plat/attachments-import-export/destroy-expired |  |  | apps/api/src/app.ts:332 |
| POST | /api/v1/plat/attachments-import-export/upload |  |  | apps/api/src/app.ts:337 |
| POST | /api/v1/fin/journal-entries |  |  | apps/api/src/app.ts:346 |
| POST | /api/v1/fin/receipt-settlements |  |  | apps/api/src/app.ts:353 |
| POST | /api/v1/fin/tax-rates |  |  | apps/api/src/app.ts:367 |
| POST | /api/v1/fin/tax-transactions |  |  | apps/api/src/app.ts:372 |
| GET | /api/v1/fin/operating-dashboard |  |  | apps/api/src/app.ts:379 |
| GET | /api/v1/fin/tax-report |  |  | apps/api/src/app.ts:384 |
| GET | /api/v1/fin/periods |  |  | apps/api/src/app.ts:389 |
| POST | /api/v1/fin/periods |  |  | apps/api/src/app.ts:394 |
| POST | /api/v1/fin/periods/{id}/close |  |  | apps/api/src/app.ts:402 |
| POST | /api/v1/fin/periods/{id}/reopen |  |  | apps/api/src/app.ts:410 |
| GET | /api/v1/fin/ar-aging |  |  | apps/api/src/app.ts:418 |
| GET | /api/v1/fin/ap-aging |  |  | apps/api/src/app.ts:423 |
| GET | /api/v1/fin/trial-balance |  |  | apps/api/src/app.ts:428 |
| GET | /api/v1/fin/financial-statements |  |  | apps/api/src/app.ts:433 |
| GET | /api/v1/fin/aging-export |  |  | apps/api/src/app.ts:438 |
| GET | /api/v1/fin/tax-report-export |  |  | apps/api/src/app.ts:445 |
| GET | /api/v1/fin/financial-statements-export |  |  | apps/api/src/app.ts:452 |
| POST | /api/v1/sales/sales-returns |  |  | apps/api/src/app.ts:460 |
| GET | /api/v1/sales/delivery-tasks |  |  | apps/api/src/app.ts:469 |
| POST | /api/v1/sales/delivery-tasks/dispatch |  |  | apps/api/src/app.ts:475 |
| POST | /api/v1/sales/delivery-tasks/{id}/events |  |  | apps/api/src/app.ts:484 |
| GET | /api/v1/sales/customers/{id}/statement |  |  | apps/api/src/app.ts:493 |
| GET | /api/v1/sales/discount-approvals |  |  | apps/api/src/app.ts:499 |
| POST | /api/v1/sales/sales-orders/{id}/discount |  |  | apps/api/src/app.ts:505 |
| POST | /api/v1/sales/discount-approvals/{id}/actions |  |  | apps/api/src/app.ts:514 |
| POST | /api/v1/proc/supplier-lead-times |  |  | apps/api/src/app.ts:523 |
| POST | /api/v1/proc/mrp-runs |  |  | apps/api/src/app.ts:529 |
| POST | /api/v1/proc/procurement-returns |  |  | apps/api/src/app.ts:537 |
| POST | /api/v1/proc/supplier-bindings |  |  | apps/api/src/app.ts:546 |
| GET | /api/v1/proc/portal/purchase-orders |  |  | apps/api/src/app.ts:551 |
| POST | /api/v1/proc/portal/purchase-orders/{id}/confirm |  |  | apps/api/src/app.ts:556 |
| POST | /api/v1/proc/portal/advance-shipping-notices |  |  | apps/api/src/app.ts:563 |
| POST | /api/v1/proc/advance-shipping-notices/{id}/receive |  |  | apps/api/src/app.ts:571 |
| POST | /api/v1/sales/livestock-sales |  |  | apps/api/src/app.ts:579 |
| GET | /api/v1/fin/sales-orders/{id}/profit |  |  | apps/api/src/app.ts:586 |
| GET | /api/v1/fin/sales-orders/{id}/profit-export |  |  | apps/api/src/app.ts:591 |
| POST | /api/v1/inv/uom-conversions |  |  | apps/api/src/app.ts:599 |
| GET | /api/v1/inv/batch-trace |  |  | apps/api/src/app.ts:606 |
| GET | /api/v1/inv/stock-positions |  |  | apps/api/src/app.ts:612 |
| POST | /api/v1/inv/stock-counts/{id}/lines |  |  | apps/api/src/app.ts:618 |
| GET | /api/v1/events/dead-letters |  |  | apps/api/src/app.ts:627 |
| POST | /api/v1/events/dead-letters/{jobId}/replay |  |  | apps/api/src/app.ts:634 |

## 6. 未文档化通用路由明细

以下为通用资源循环生成、但未在 OpenAPI 中登记的操作。

| 方法 | 路径 | operationId | 标签 | 代码位置 |
| --- | --- | --- | --- | --- |
| GET | /api/v1/org/organization-units |  |  | apps/api/src/app.ts:645 |
| GET | /api/v1/org/organization-units/{id} |  |  | apps/api/src/app.ts:645 |
| POST | /api/v1/org/organization-units |  |  | apps/api/src/app.ts:645 |
| POST | /api/v1/org/organization-units/{id}/actions |  |  | apps/api/src/app.ts:645 |
| PATCH | /api/v1/org/organization-units/{id} |  |  | apps/api/src/app.ts:645 |
| GET | /api/v1/org/positions |  |  | apps/api/src/app.ts:645 |
| GET | /api/v1/org/positions/{id} |  |  | apps/api/src/app.ts:645 |
| POST | /api/v1/org/positions |  |  | apps/api/src/app.ts:645 |
| POST | /api/v1/org/positions/{id}/actions |  |  | apps/api/src/app.ts:645 |
| PATCH | /api/v1/org/positions/{id} |  |  | apps/api/src/app.ts:645 |
| GET | /api/v1/rpt/dashboard-snapshot |  |  | apps/api/src/app.ts:645 |
| GET | /api/v1/rpt/dashboard-snapshot/{id} |  |  | apps/api/src/app.ts:645 |
| POST | /api/v1/rpt/dashboard-snapshot |  |  | apps/api/src/app.ts:645 |
| POST | /api/v1/rpt/dashboard-snapshot/{id}/actions |  |  | apps/api/src/app.ts:645 |
| PATCH | /api/v1/rpt/dashboard-snapshot/{id} |  |  | apps/api/src/app.ts:645 |
| GET | /api/v1/print/print-job |  |  | apps/api/src/app.ts:645 |
| GET | /api/v1/print/print-job/{id} |  |  | apps/api/src/app.ts:645 |
| POST | /api/v1/print/print-job |  |  | apps/api/src/app.ts:645 |
| POST | /api/v1/print/print-job/{id}/actions |  |  | apps/api/src/app.ts:645 |
| PATCH | /api/v1/print/print-job/{id} |  |  | apps/api/src/app.ts:645 |

## 7. 风险分级与处置建议

| 类别 | 数量 | 分级 | 处置要求 |
|---|---:|---|---|
| 只读契约仍暴露写操作 | 0 | P1 | 禁用或迁移为真实领域动作，禁止保留通用写入入口 |
| OpenAPI 已定义但未实现 | 122 | P1 | 按业务用例实现真实闭环，或走变更审批后修改契约 |
| 显式路由未文档化 | 59 | P1 | 补入 OpenAPI，定义请求/响应 Schema、状态码和鉴权 |
| 非契约资源通用端点 | 20 | P2 | 内部端点需明确豁免；生产无用端点应移除 |

处置原则：

1. 不得为了通过检查而补空接口、占位页面或无业务规则的通用 CRUD。
2. 已实现且确实需要上线的接口，应先更新 OpenAPI 并形成设计变更记录。
3. 只读台账、报表、审计类资源不得暴露通用创建、修改和状态变更入口。
4. 路由/方法差异关闭后，继续执行字段、请求体、响应体、状态码和鉴权的 Schema 级核对。

## 8. 复跑方式

```powershell
npm run contract:check
node scripts/generate-openapi-contract-report.mjs
```

