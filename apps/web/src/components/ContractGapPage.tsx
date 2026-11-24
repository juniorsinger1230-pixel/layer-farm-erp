import { Button, Card, Descriptions, Result, Tag } from 'antd';
import { useNavigate } from 'react-router-dom';
import type { PageDefinition } from '../types';

export default function ContractGapPage({ page }: { page: PageDefinition }) {
  const navigate = useNavigate();
  return (
    <div className="business-page" data-page-id={page.pageId} data-requirement-id={page.requirementId}>
      <Card className="page-intro">
        <Descriptions column={2} size="small" items={[
          { key: 'page', label: '页面', children: page.title },
          { key: 'requirement', label: '需求编号', children: page.requirementId },
          { key: 'domain', label: '业务域', children: page.domainName },
          { key: 'priority', label: '优先级', children: <Tag color={page.priority === 'P0' ? 'red' : 'blue'}>{page.priority}</Tag> },
        ]} />
      </Card>
      <Result
        status="warning"
        title="该页面已完成高保真入口，但真实 API 契约尚未闭合"
        subTitle="当前不会展示 Mock 数据，也不会允许前端本地假审批。请补齐后端接口、字段契约、数据范围和测试后再接入。"
        extra={[
          <Button type="primary" key="workbench" onClick={() => { void navigate('/app/workbench'); }}>返回工作台</Button>,
          <Button key="journeys" onClick={() => { void navigate('/app/journeys'); }}>查看关键旅程</Button>,
        ]}
      >
        <Card type="inner" title="待补齐内容">
          <Descriptions column={1} items={[
            { key: 'api', label: '真实 API', children: '待登记 OpenAPI 操作并实现服务端路由' },
            { key: 'fields', label: '字段契约', children: '待明确请求字段、响应字段、精度和必填规则' },
            { key: 'scope', label: '数据范围', children: '待补齐公司、栋舍、仓库、本人或任务范围校验' },
            { key: 'tests', label: '测试', children: '待补齐自动化测试、反向权限测试和浏览器验收' },
          ]} />
        </Card>
      </Result>
    </div>
  );
}
