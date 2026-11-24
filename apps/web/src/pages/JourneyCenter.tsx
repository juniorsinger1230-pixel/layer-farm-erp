import { Alert, Button, Card, Col, Descriptions, List, Row, Space, Table, Tabs, Tag, Timeline, Typography } from 'antd';
import { NodeIndexOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useSession } from '../auth/SessionContext';
import { roleLabel } from '../auth/roleLabels';
import { canReadPage } from '../auth/permissions';
import { uxToRealRole } from '../auth/uxRoleMap';
import { PAGES } from '../data/registry';
import { uxDesign } from '../data/uxModel';

export default function JourneyCenter() {
  const location = useLocation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { profile } = useSession();
  const mobile = location.pathname.startsWith('/h5');
  const prefix = mobile ? '/h5' : '/app';
  const selectedId = params.get('journey') ?? uxDesign.journeys[0]?.id;
  const journey = uxDesign.journeys.find((item) => item.id === selectedId) ?? uxDesign.journeys[0];
  if (!profile || !journey) return null;

  const openPage = (pageId: string) => {
    if (pageId === 'workbench') { void navigate(`${prefix}/workbench`); return; }
    if (!canReadPage(profile, pageId)) return;
    void navigate(`${prefix}/${pageId}`);
  };

  const journeyContent = (
    <Row gutter={[16, 16]} className="journey-layout">
      <Col xs={24} xl={7}>
        <Card className="journey-index" title="关键旅程目录">
          <List
            dataSource={uxDesign.journeys}
            renderItem={(item) => (
              <List.Item className={item.id === journey.id ? 'selected' : ''} onClick={() => setParams({ journey: item.id })}>
                <List.Item.Meta title={<Space><Tag>{item.id}</Tag>{item.title}</Space>} description={`${item.requirementIds.length} 条需求 · ${item.steps.length} 步`} />
              </List.Item>
            )}
          />
        </Card>
      </Col>
      <Col xs={24} xl={17}>
        <Card className="journey-detail" title={<Space><NodeIndexOutlined />{journey.id} · {journey.title}</Space>}>
          <Alert type="info" showIcon message={journey.goal} description={`触发：${journey.trigger}`} />
          <Descriptions bordered size="small" column={mobile ? 1 : 2} className="journey-descriptions" items={[
            { key: 'preconditions', label: '前置条件', children: journey.preconditions.join('；'), span: 2 },
            { key: 'entry', label: '入口', children: <Button type="link" disabled={!canReadPage(profile, journey.entryPageId)} onClick={() => openPage(journey.entryPageId)}>{PAGES.find((page) => page.pageId === journey.entryPageId)?.title ?? '岗位工作台'}</Button> },
            { key: 'trace', label: '追溯', children: `${journey.requirementIds.length} FR · ${journey.exceptionIds.length} EX · ${journey.nfrIds.length} NFR` },
          ]} />
          <h3>主路径与跨角色交接</h3>
          <Timeline
            className="journey-timeline"
            items={journey.steps.map((step, index) => {
              const mappedRole = uxToRealRole[step.roleId];
              const isCurrentRole = mappedRole ? profile.roles.includes(mappedRole) : false;
              const pageAllowed = step.pageId === 'workbench' || canReadPage(profile, step.pageId);
              return {
                color: isCurrentRole ? 'blue' : 'gray',
                children: (
                  <div className="journey-step" data-testid={`${journey.id}-step-${index + 1}`}>
                    <Space wrap>
                      <Tag color={isCurrentRole ? 'blue' : 'default'}>{mappedRole ? roleLabel(mappedRole) : step.roleId}</Tag>
                      <Typography.Text strong>{step.action}</Typography.Text>
                    </Space>
                    <p>完成证据：{step.evidence}</p>
                    <Button size="small" disabled={!pageAllowed} onClick={() => openPage(step.pageId)}>{step.pageId === 'workbench' ? '岗位工作台' : PAGES.find((page) => page.pageId === step.pageId)?.title ?? step.pageId}</Button>
                  </div>
                ),
              };
            })}
          />
          <Alert type="warning" showIcon message="权限边界" description="目录用于理解跨角色流程；页面是否可打开由真实 /auth/me 权限决定，后端仍会再次执行权限和公司范围校验。" />
        </Card>
      </Col>
    </Row>
  );

  const roleMappingRows = Object.entries(uxToRealRole).map(([uxRole, realRole]) => ({ key: uxRole, uxRole, realRole, active: profile.roles.includes(realRole) }));
  const mappingContent = (
    <Card title="UX 角色到真实后端角色映射">
      <Table
        dataSource={roleMappingRows}
        pagination={false}
        columns={[
          { title: '高保真 UX 角色', dataIndex: 'uxRole' },
          { title: '真实后端角色', dataIndex: 'realRole', render: (value: string) => roleLabel(value as never) },
          { title: '当前账号', dataIndex: 'active', render: (value: boolean) => <Tag color={value ? 'green' : 'default'}>{value ? '当前角色' : '未匹配'}</Tag> },
        ]}
      />
      <Alert className="journey-role-note" type="info" showIcon message="17 个 UX 角色已收敛到 15 个真实后端角色；部分岗位按职责合并，不额外创建后端角色。" />
    </Card>
  );

  return (
    <div className="journey-center" data-page-id="journeys" data-testid="journey-center">
      <section className="journey-hero">
        <Tag color="blue">真实权限驱动</Tag>
        <h1>关键旅程中心</h1>
        <p>角色 → 任务 → 页面 → 完成证据 → 后端权限校验</p>
      </section>
      <Tabs defaultActiveKey="journeys" items={[{ key: 'journeys', label: '关键旅程', children: journeyContent }, { key: 'mapping', label: '角色映射', children: mappingContent, icon: <SafetyCertificateOutlined /> }]} />
    </div>
  );
}
