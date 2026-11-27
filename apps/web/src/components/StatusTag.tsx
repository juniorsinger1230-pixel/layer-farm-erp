import { Tag } from 'antd';
import { getEnumLabel } from '../presentation/presentation';

const colorMap: Record<string, string> = {
  draft: 'default',
  pending: 'warning',
  approving: 'processing',
  approved: 'success',
  rejected: 'error',
  closed: 'default',
  active: 'success',
  disabled: 'default',
  cancelled: 'error',
  expired: 'warning',
  suspended: 'warning',
  paid: 'success',
  partial: 'warning',
  cleared: 'success',
  executed: 'success',
};

export default function StatusTag({ status }: { status: string }): React.ReactElement {
  const key = String(status).toLowerCase();
  return <Tag color={colorMap[key] ?? 'default'}>{getEnumLabel(key)}</Tag>;
}
