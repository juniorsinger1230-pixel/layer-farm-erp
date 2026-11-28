import type { RealRole } from './types';

export const roleLabels: Record<RealRole, string> = {
  admin: '系统管理员',
  boss: '经营负责人',
  finance_manager: '财务经理',
  finance_cashier: '出纳',
  purchase_manager: '采购经理',
  purchase_staff: '采购专员',
  sales_manager: '销售经理',
  sales_staff: '销售专员',
  layer_farm_manager: '养殖场长',
  vet: '兽医',
  feeder: '饲养员',
  warehouse: '仓库管理员',
  external_affairs: '外联专员',
  driver: '司机',
  engineering: '工程维修员',
};

export function roleLabel(role?: string): string {
  if (!role) return '用户';
  return roleLabels[role as RealRole] ?? role;
}
