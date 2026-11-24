import type { DomainCode } from '../types';

export type RealRole =
  | 'admin' | 'boss' | 'finance_manager' | 'finance_cashier'
  | 'purchase_manager' | 'purchase_staff' | 'sales_manager' | 'sales_staff'
  | 'layer_farm_manager' | 'vet' | 'feeder' | 'warehouse'
  | 'external_affairs' | 'driver' | 'engineering';

export interface AuthMe {
  employeeId: number;
  employeeNo: string;
  companyCode: string;
  roles: RealRole[];
  permissions: string[];
  companyScope: '*' | string[];
  houseScope: number[];
  warehouseScope: number[];
}

export const gapReadPermissionByDomain: Record<DomainCode, string> = {
  ORG: 'org:read',
  FARM: 'production:read',
  VET: 'vet:read',
  PROC: 'purchase:read',
  INV: 'inventory:read',
  SALES: 'sales:read',
  LOG: 'report:read',
  FIN: 'finance:read',
  EQP: 'equipment:read',
  RPT: 'report:read',
  PRINT: 'report:read',
  TRACE: 'report:read',
  PLAT: 'report:read',
};
