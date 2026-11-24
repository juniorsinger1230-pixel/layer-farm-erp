import { ROLES, type Role } from '../../shared/src/contracts.js';

export type ScopeConfig = {
  companyCodes?: string[];
  houseIds?: number[];
  warehouseIds?: number[];
  selfOnly?: boolean;
  taskOnly?: boolean;
};

export type RoleAssignment = {
  role: Role;
  companyCode?: string;
  scopeConfig?: ScopeConfig;
  validFrom?: Date;
  validTo?: Date;
};

export type Principal = {
  employeeId: number;
  employeeNo: string;
  companyCode: string;
  companyId: number;
  roles: RoleAssignment[];
  mfaEnrolled: boolean;
};

export type EffectiveAccess = {
  permissions: Set<string>;
  companyCodes: '*' | Set<string>;
  houseIds: Set<number>;
  warehouseIds: Set<number>;
  selfOnly: boolean;
  taskOnly: boolean;
};

const ALL_BUSINESS_READ = [
  'org:read', 'master:read', 'purchase:read', 'inventory:read', 'sales:read',
  'production:read', 'vet:read', 'equipment:read', 'finance:read', 'report:read', 'print:read',
];

export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<string>> = {
  admin: new Set(['*']),
  boss: new Set([...ALL_BUSINESS_READ, '*:approve', '*:export', 'project:manage']),
  finance_manager: new Set([...ALL_BUSINESS_READ, 'purchase:approve', 'sales:approve', 'finance:approve', 'finance:export', 'report:export', 'employee:export']),
  finance_cashier: new Set(['org:read', 'master:read', 'purchase:read', 'inventory:read', 'sales:read', 'production:read', 'vet:read', 'equipment:read', 'finance:read', 'finance:payment', 'finance:receipt', 'report:read']),
  purchase_manager: new Set(['org:read', 'master:read', 'master:manage', 'supplier:manage', 'purchase:read', 'purchase:create', 'purchase:update', 'purchase:approve', 'purchase:manage', 'inventory:read', 'finance:read', 'expense:read', 'report:read']),
  purchase_staff: new Set(['org:read', 'master:read', 'master:create', 'master:update', 'supplier:create', 'supplier:update', 'purchase:read', 'purchase:create', 'purchase:update', 'inventory:read', 'expense:create', 'report:read']),
  sales_manager: new Set(['org:read', 'master:read', 'customer:manage', 'purchase:read', 'inventory:read', 'sales:read', 'sales:create', 'sales:update', 'sales:approve', 'sales:manage', 'delivery:read', 'finance:read', 'expense:read', 'report:read', 'report:export']),
  sales_staff: new Set(['org:read', 'master:read', 'customer:create', 'customer:update', 'purchase:read', 'inventory:read', 'sales:read', 'sales:create', 'sales:update', 'discount:create', 'delivery:read', 'finance:read', 'expense:create', 'report:read', 'print:read']),
  layer_farm_manager: new Set(['org:read', 'employee:read', 'master:read', 'purchase:create', 'purchase:read', 'inventory:read', 'inventory:write', 'production:read', 'production:create', 'production:approve', 'production:manage', 'vet:read', 'mortality:approve', 'equipment:read', 'expense:create', 'report:read']),
  vet: new Set(['org:read', 'employee:read', 'master:read', 'receipt:inspect', 'inventory:read', 'production:read', 'vet:read', 'vet:create', 'vet:update', 'vet:approve', 'vet:manage', 'mortality:read', 'expense:create', 'report:read']),
  feeder: new Set(['org:read', 'master:read', 'purchase:create', 'inventory:read', 'inventory:create', 'production:read', 'production:create', 'vet:create', 'mortality:create', 'report:read']),
  warehouse: new Set(['org:read', 'employee:read', 'master:read', 'supplier:read', 'customer:read', 'purchase:read', 'receipt:create', 'receipt:update', 'inventory:read', 'inventory:create', 'inventory:update', 'sales:read', 'delivery:create', 'delivery:update', 'receipt:read', 'finance:read', 'vet:read', 'report:read', 'print:create', 'print:update']),
  external_affairs: new Set(['org:read', 'expense:create', 'report:read']),
  driver: new Set(['inventory:read', 'sales:read', 'delivery:create', 'delivery:update', 'receipt:create', 'receipt:update', 'report:read']),
  engineering: new Set(['org:read', 'employee:read', 'master:read', 'supplier:read', 'purchase:create', 'inventory:read', 'inventory:write', 'equipment:read', 'equipment:create', 'equipment:update', 'equipment:manage', 'expense:create', 'report:read']),
};

const PRIVILEGED_FIELD_ROLES = new Set<Role>(['admin', 'boss', 'finance_manager']);
const RESTRICTED_FIELD_ROLES = new Set<Role>(['feeder', 'driver', 'external_affairs']);

export function resolveEffectiveAccess(principal: Principal, now = new Date()): EffectiveAccess {
  const active = principal.roles.filter((assignment) =>
    ROLES.includes(assignment.role) &&
    (assignment.validFrom === undefined || assignment.validFrom <= now) &&
    (assignment.validTo === undefined || assignment.validTo >= now));
  const permissions = new Set<string>();
  const companyCodes = new Set<string>();
  const houseIds = new Set<number>();
  const warehouseIds = new Set<number>();
  let allCompanies = false;
  let selfOnly = false;
  let taskOnly = false;

  for (const assignment of active) {
    for (const permission of ROLE_PERMISSIONS[assignment.role]) permissions.add(permission);
    const scope = assignment.scopeConfig;
    if (assignment.role === 'admin' || assignment.role === 'boss') {
      if (scope?.companyCodes === undefined) allCompanies = true;
    }
    for (const company of scope?.companyCodes ?? [assignment.companyCode ?? principal.companyCode]) {
      if (company === 'THL' || company === 'TGE') companyCodes.add(company);
    }
    for (const id of scope?.houseIds ?? []) if (Number.isSafeInteger(id) && id > 0) houseIds.add(id);
    for (const id of scope?.warehouseIds ?? []) if (Number.isSafeInteger(id) && id > 0) warehouseIds.add(id);
    selfOnly ||= scope?.selfOnly ?? assignment.role === 'feeder';
    taskOnly ||= scope?.taskOnly ?? assignment.role === 'driver';
  }

  if (active.some((assignment) => assignment.role === 'finance_cashier')) {
    for (const permission of [...permissions]) {
      if (permission === '*:approve' || permission.endsWith(':approve')) permissions.delete(permission);
    }
  }
  return { permissions, companyCodes: allCompanies ? '*' : companyCodes, houseIds, warehouseIds, selfOnly, taskOnly };
}

export function hasPermission(access: EffectiveAccess, permission: string): boolean {
  if (access.permissions.has('*') || access.permissions.has(permission)) return true;
  const [module, action] = permission.split(':');
  return access.permissions.has(`${module}:*`) || access.permissions.has(`${module}:manage`) || (action !== undefined && access.permissions.has(`*:${action}`));
}

export function assertCompanyScope(access: EffectiveAccess, companyCode: string): void {
  if (companyCode !== 'THL' && companyCode !== 'TGE') throw new Error('Invalid company');
  if (access.companyCodes !== '*' && !access.companyCodes.has(companyCode)) {
    const error = new Error('Company scope denied') as Error & { code?: string };
    error.code = 'AUTH_SCOPE_VIOLATION';
    throw error;
  }
}

function sensitiveKind(key: string): 'price' | 'cost' | 'salary' | 'credential' | null {
  const normalized = key.toLowerCase();
  if (/password|secret|token|credential|hash/.test(normalized)) return 'credential';
  if (/salary|wage|payroll/.test(normalized)) return 'salary';
  if (/cost|profit|margin/.test(normalized)) return 'cost';
  if (/price|unit_price|purchase_amount|sales_amount/.test(normalized)) return 'price';
  return null;
}

/** 递归字段白名单投影；凭据永不回显，受限岗位不收到敏感键而非仅置空。 */
export function projectFields(value: unknown, roles: Role[]): unknown {
  if (Array.isArray(value)) return value.map((item) => projectFields(item, roles));
  if (value === null || typeof value !== 'object' || value instanceof Date) return value;
  const privileged = roles.some((role) => PRIVILEGED_FIELD_ROLES.has(role));
  const restricted = roles.some((role) => RESTRICTED_FIELD_ROLES.has(role)) && !privileged;
  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    const kind = sensitiveKind(key);
    if (kind === 'credential') continue;
    if (restricted && kind !== null) continue;
    if (kind === 'salary' && !privileged) continue;
    if (kind === 'cost' && !privileged) {
      result[key] = '***';
      continue;
    }
    result[key] = projectFields(child, roles);
  }
  return result;
}
