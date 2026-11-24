import type { RealRole } from './types';

export const uxToRealRole: Record<string, RealRole> = {
  SYSTEM_EXECUTIVE: 'boss',
  SYSTEM_EXTERNAL_LIAISON: 'external_affairs',
  SYSTEM_FINANCE_MANAGER: 'finance_manager',
  SYSTEM_FINANCE_STAFF: 'finance_cashier',
  SYSTEM_SALES_MANAGER: 'sales_manager',
  SYSTEM_SALES_STAFF: 'sales_staff',
  SYSTEM_PROCUREMENT_MANAGER: 'purchase_manager',
  SYSTEM_PROCUREMENT_STAFF: 'purchase_staff',
  SYSTEM_VETERINARIAN: 'vet',
  SYSTEM_FARM_LEADER: 'layer_farm_manager',
  SYSTEM_FARM_WORKER: 'feeder',
  SYSTEM_SORTING_WORKER: 'warehouse',
  SYSTEM_DRIVER: 'driver',
  SYSTEM_DELIVERY_STAFF: 'driver',
  SYSTEM_ENGINEERING_LEAD: 'engineering',
  SYSTEM_MAINTENANCE: 'engineering',
  SYSTEM_SECURITY: 'admin',
  SYSTEM_ADMIN: 'admin',
};
