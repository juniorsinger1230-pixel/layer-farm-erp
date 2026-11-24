export type DemoRole =
  | 'SYSTEM_EXECUTIVE' | 'SYSTEM_EXTERNAL_LIAISON' | 'SYSTEM_FINANCE_MANAGER'
  | 'SYSTEM_FINANCE_STAFF' | 'SYSTEM_SALES_MANAGER' | 'SYSTEM_SALES_STAFF'
  | 'SYSTEM_PROCUREMENT_MANAGER' | 'SYSTEM_PROCUREMENT_STAFF' | 'SYSTEM_VETERINARIAN'
  | 'SYSTEM_FARM_LEADER' | 'SYSTEM_FARM_WORKER' | 'SYSTEM_SORTING_WORKER'
  | 'SYSTEM_DRIVER' | 'SYSTEM_DELIVERY_STAFF' | 'SYSTEM_ENGINEERING_LEAD'
  | 'SYSTEM_MAINTENANCE' | 'SYSTEM_SECURITY' | 'SYSTEM_ADMIN';

export type DomainCode =
  | 'ORG' | 'FARM' | 'VET' | 'PROC' | 'INV' | 'SALES' | 'LOG'
  | 'FIN' | 'EQP' | 'RPT' | 'PRINT' | 'TRACE' | 'PLAT';

export type Priority = 'P0' | 'P1' | 'P2';
export type PagePattern = 'business-list' | 'dashboard' | 'sales-order' | 'payment-voucher' | 'payment-execution' | 'traceability';
export type RecordStatus = 'DRAFT' | 'PENDING' | 'APPROVING' | 'APPROVED' | 'REJECTED' | 'CLOSED';
export type ViewMode = 'normal' | 'loading' | 'empty' | 'error' | 'forbidden';
export type FieldKind = 'text' | 'number' | 'currency' | 'date' | 'select' | 'switch' | 'textarea';

export interface PageDefinition {
  index: number;
  pageId: string;
  requirementId: string;
  title: string;
  domain: DomainCode;
  domainName: string;
  priority: Priority;
  sourceModelId: string;
  useCaseId: string;
  actor: string;
  description: string;
  trigger: string;
  preconditions: string[];
  flow: string[];
  outputs: string[];
  exceptions: string[];
  acceptanceIds: string[];
  businessRuleIds: string[];
  dataRuleIds: string[];
  nfrIds: string[];
  entityIds: string[];
  readOnly: boolean;
  pattern: PagePattern;
  route: string;
}

export interface FieldSchema {
  key: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  options?: string[];
  samples?: Array<string | number | boolean>;
  unit?: string;
  precision?: number;
  width?: number;
}

export interface BusinessRecord {
  id: string;
  status: RecordStatus;
  company: 'THL' | 'TGE';
  businessDate: string;
  updatedAt: string;
  owner: string;
  [key: string]: string | number | boolean | undefined;
}

export interface ReviewDecision {
  decision: 'APPROVED' | 'CHANGES_REQUESTED' | 'PENDING';
  comment: string;
  reviewer: string;
  updatedAt: string;
}

export interface DomainGroup {
  domain: DomainCode;
  domainName: string;
  pages: PageDefinition[];
}
