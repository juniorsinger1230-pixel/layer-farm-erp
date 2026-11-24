import { Button, Card, Space, Tag, Typography } from 'antd';
import type { PageDefinition } from '../types';

interface Props {
  page: PageDefinition;
  onOpenRequirements: () => void;
  extra?: React.ReactNode;
}

export default function PageIntro({ page, onOpenRequirements, extra }: Props) {
  return (
    <Card className="page-intro" bordered={false}>
      <Space wrap size={8} className="page-intro__eyebrow">
        <span className="domain-kicker">{page.domain} · {page.domainName}</span>
        <Tag color={page.priority === 'P0' ? 'red' : 'blue'}>{page.priority}</Tag>
      </Space>
      <Typography.Title level={2}>{page.title}</Typography.Title>
      <Typography.Paragraph ellipsis={{ rows: 2, expandable: true, symbol: '展开' }}>{page.description}</Typography.Paragraph>
      <Space wrap>
        {extra}
        <Button onClick={onOpenRequirements}>需求详情</Button>
      </Space>
    </Card>
  );
}
