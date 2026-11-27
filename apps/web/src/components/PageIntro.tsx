import { Card, Space, Typography } from 'antd';
import type { PageDefinition } from '../types';

interface Props {
  page: PageDefinition;
  extra?: React.ReactNode;
}

export default function PageIntro({ page, extra }: Props): React.ReactElement {
  return (
    <Card className="page-intro" bordered={false}>
      <Space wrap size={8} className="page-intro__eyebrow">
        <span className="domain-kicker">{page.domainName}</span>
      </Space>
      <Typography.Title level={2}>{page.title}</Typography.Title>
      <Typography.Paragraph ellipsis={{ rows: 2, expandable: true, symbol: '展开' }}>{page.description}</Typography.Paragraph>
      {extra ? <Space wrap>{extra}</Space> : null}
    </Card>
  );
}
