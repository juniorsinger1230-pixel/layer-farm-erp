import { Descriptions, Drawer, List, Tag } from 'antd';
import type { PageDefinition } from '../types';

interface Props {
  page: PageDefinition;
  open: boolean;
  onClose: () => void;
}

export default function RequirementDrawer({ page, open, onClose }: Props) {
  return (
    <Drawer title="需求与验收" width={680} open={open} onClose={onClose}>
      <Descriptions bordered column={1} size="small" items={[
        { key: 'requirement', label: '需求', children: page.requirementId },
        { key: 'useCase', label: '用例', children: page.useCaseId },
        { key: 'preconditions', label: '前置条件', children: page.preconditions.join('；') || '无' },
        { key: 'outputs', label: '输出', children: page.outputs.join('；') || '无' },
        { key: 'exceptions', label: '异常', children: page.exceptions.join('；') || '无' },
      ]} />
      <List header="验收标准">
        {page.acceptanceIds.map((id) => <List.Item key={id}><Tag color="blue">{id}</Tag></List.Item>)}
      </List>
    </Drawer>
  );
}
