import { CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined, FileOutlined, SyncOutlined } from '@ant-design/icons';
import { Tag } from 'antd';
import type { RecordStatus } from '../types';

const statusMap = {
  DRAFT: { label: '草稿', color: 'default', icon: <FileOutlined /> },
  PENDING: { label: '待提交', color: 'warning', icon: <ClockCircleOutlined /> },
  APPROVING: { label: '审批中', color: 'processing', icon: <SyncOutlined /> },
  APPROVED: { label: '已生效', color: 'success', icon: <CheckCircleOutlined /> },
  REJECTED: { label: '已退回', color: 'error', icon: <CloseCircleOutlined /> },
  CLOSED: { label: '已关闭', color: 'default', icon: <CloseCircleOutlined /> },
} as const;

export default function StatusTag({ status }: { status: RecordStatus }) {
  const config = statusMap[status] ?? statusMap.DRAFT;
  return <Tag color={config.color} icon={config.icon}>{config.label}</Tag>;
}
