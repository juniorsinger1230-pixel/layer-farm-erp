import { Alert, Card } from 'antd';

export default function ContractGapPage(): React.ReactElement {
  return (
    <Card>
      <Alert type="info" showIcon message="功能暂未开放" description="该业务功能正在准备中，当前不展示业务数据或临时内容。" />
    </Card>
  );
}
