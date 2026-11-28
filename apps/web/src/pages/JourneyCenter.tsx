import { Alert, Button, Card, Col, List, Row, Space, Tag, Timeline, Typography } from 'antd';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useSession } from '../auth/SessionContext';
import { roleLabel } from '../auth/roleLabels';
import { canReadPage } from '../auth/permissions';
import { PAGES } from '../data/registry';
import { uxDesign } from '../data/uxModel';

export default function JourneyCenter(): React.ReactNode {
  const location = useLocation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { profile } = useSession();
  const mobile = location.pathname.startsWith('/h5');
  const prefix = mobile ? '/h5' : '/app';
  const selectedId = params.get('journey') ?? uxDesign.journeys[0]?.id;
  const journey = uxDesign.journeys.find((item) => item.id === selectedId) ?? uxDesign.journeys[0];
  if (!profile || !journey) return null;

  const openPage = (pageId: string): void => {
    if (pageId === 'workbench') { void navigate(`${prefix}/workbench`); return; }
    if (!canReadPage(profile, pageId)) return;
    void navigate(`${prefix}/${pageId}`);
  };

  return (
    <div className="journey-center" data-page-id="journeys" data-testid="journey-center">
      <section className="journey-hero">
        <h1>业务流程中心</h1>
        <p>按业务流程查看岗位交接、办理入口和业务记录。</p>
      </section>

      <Row gutter={[16, 16]} className="journey-layout">
        <Col xs={24} xl={7}>
          <Card className="journey-index" title="流程目录">
            <List
              dataSource={uxDesign.journeys}
              renderItem={(item) => (
                <List.Item className={item.id === journey.id ? 'selected' : ''} onClick={() => setParams({ journey: item.id })}>
                  <List.Item.Meta title={item.title} description={`${item.steps.length} 个业务步骤`} />
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} xl={17}>
          <Card className="journey-detail" title={journey.title}>
            <Alert type="info" showIcon message={journey.goal} description={`业务触发：${journey.trigger}`} />
            <Typography.Paragraph style={{ marginTop: 16 }}>
              前置条件：{journey.preconditions.join('；')}
            </Typography.Paragraph>
            <Space style={{ marginBottom: 12 }}>
              <span>业务入口：</span>
              <Button
                type="link"
                disabled={!canReadPage(profile, journey.entryPageId)}
                onClick={() => openPage(journey.entryPageId)}
              >
                {PAGES.find((page) => page.pageId === journey.entryPageId)?.title ?? '岗位工作台'}
              </Button>
            </Space>
            <h3>业务步骤与岗位交接</h3>
            <Timeline
              className="journey-timeline"
              items={journey.steps.map((step, index) => {
                const isCurrentRole = profile.roles.includes(step.roleId as typeof profile.roles[number]);
                const pageAllowed = step.pageId === 'workbench' || canReadPage(profile, step.pageId);
                return {
                  color: isCurrentRole ? 'blue' : 'gray',
                  children: (
                    <div className="journey-step" data-testid={`${journey.id}-step-${index + 1}`}>
                      <Space wrap>
                        <Tag color={isCurrentRole ? 'blue' : 'default'}>{roleLabel(step.roleId)}</Tag>
                        <Typography.Text strong>{step.action}</Typography.Text>
                      </Space>
                      <p>业务记录：{step.evidence}</p>
                      <Button
                        size="small"
                        disabled={!pageAllowed}
                        onClick={() => openPage(step.pageId)}
                      >
                        {step.pageId === 'workbench' ? '岗位工作台' : PAGES.find((page) => page.pageId === step.pageId)?.title ?? '业务页面'}
                      </Button>
                    </div>
                  ),
                };
              })}
            />
            <Alert type="info" showIcon message="权限说明" description="仅可进入当前账号授权范围内的业务页面，具体操作权限由系统统一校验。" />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
