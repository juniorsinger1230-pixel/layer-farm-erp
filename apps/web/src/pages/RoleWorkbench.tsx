import { Alert, Button, Card, Col, List, Row, Space, Statistic, Tag } from 'antd';
import { ArrowRightOutlined, ProfileOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSession } from '../auth/SessionContext';
import { roleLabel } from '../auth/roleLabels';
import { canCreatePage, canReadPage, canUpdatePage, isGapPage } from '../auth/permissions';
import { PAGES } from '../data/registry';
import pageApiMap from '../generated/page-api-map.json';

const objectShortcuts = [
  ['养殖批次', 'trace-001', '批次—栋舍—存栏—成本'],
  ['物料与库存批次', 'inv-002', '批次—库位—效期—台账'],
  ['采购订单', 'proc-002', '订单—供应商—收货—验收'],
  ['销售订单', 'sales-003', '订单—信用—出库—签收'],
  ['配送任务', 'log-002', '任务—路线—签收—异常'],
  ['财务凭证', 'fin-009', '制证—审批—执行—审计'],
  ['设备维修', 'eqp-003', '设备—工单—备件—验收'],
  ['岗位与权限', 'org-005', '角色—范围—有效期'],
] as const;

export default function RoleWorkbench() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useSession();
  const mobile = location.pathname.startsWith('/h5');
  const prefix = mobile ? '/h5' : '/app';
  if (!profile) return null;
  const accessiblePages = PAGES.filter((page) => canReadPage(profile, page.pageId));
  const mappedPages = accessiblePages.filter((page) => !isGapPage(page.pageId));
  const gapPages = accessiblePages.filter((page) => isGapPage(page.pageId));
  const writablePages = accessiblePages.filter((page) => canCreatePage(profile, page.pageId) || canUpdatePage(profile, page.pageId));
  const priorityWeight = { P0: 0, P1: 1, P2: 2 };
  const tasks = [...accessiblePages].sort((a, b) => priorityWeight[a.priority] - priorityWeight[b.priority] || a.index - b.index);
  const openPage = (pageId: string) => { void navigate(`${prefix}/${pageId}`); };

  return (
    <div className="role-workbench" data-page-id="workbench" data-testid="role-workbench">
      <section className="workbench-hero">
        <div>
          <Space wrap><Tag color="blue">真实账号</Tag><Tag>{profile.companyCode}</Tag><Tag icon={<SafetyCertificateOutlined />}>{roleLabel(profile.roles[0] ?? 'admin')}</Tag></Space>
          <h1>{roleLabel(profile.roles[0] ?? 'admin')}工作台</h1>
          <p>本工作台根据后端返回的角色、权限和数据范围动态生成，不提供本地角色切换。</p>
          <div className="workbench-scope">
            公司范围：{profile.companyScope === '*' ? '*' : profile.companyScope.join(', ')} · 栋舍范围：{profile.houseScope.length ? profile.houseScope.join(', ') : '未限定'} · 仓库范围：{profile.warehouseScope.length ? profile.warehouseScope.join(', ') : '未限定'}
          </div>
        </div>
      </section>

      <Alert className="workbench-boundary" type="info" showIcon message="菜单和任务仅用于导航；后端会重新校验操作权限和公司范围。" />

      <Row gutter={[16, 16]} className="workbench-metrics">
        <Col xs={12} lg={6}><Card><Statistic title="可访问页面" value={accessiblePages.length} prefix={<ProfileOutlined />} /></Card></Col>
        <Col xs={12} lg={6}><Card><Statistic title="真实 API 页面" value={mappedPages.length} /></Card></Col>
        <Col xs={12} lg={6}><Card><Statistic title="可经办页面" value={writablePages.length} /></Card></Col>
        <Col xs={12} lg={6}><Card><Statistic title="契约缺口" value={gapPages.length} /></Card></Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Card className="workbench-panel" title="我的岗位任务">
            <List
              dataSource={tasks.slice(0, mobile ? 6 : 10)}
              renderItem={(page) => (
                <List.Item actions={[<Button key="open" type="link" onClick={() => openPage(page.pageId)}>打开<ArrowRightOutlined /></Button>]}>
                  <List.Item.Meta
                    title={<Space wrap>{page.title}<Tag color={page.priority === 'P0' ? 'red' : 'blue'}>{page.priority}</Tag>{isGapPage(page.pageId) ? <Tag>契约缺口</Tag> : <Tag color="green">真实 API</Tag>}</Space>}
                    description={`${page.domainName} · ${page.requirementId}`}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} xl={10}>
          <Card className="workbench-panel" title="权限摘要">
            <List>
              <List.Item>后端权限数：{profile.permissions.length}</List.Item>
              <List.Item>员工编号：{profile.employeeNo}</List.Item>
              <List.Item>员工 ID：{profile.employeeId}</List.Item>
              <List.Item>页面总底账：{pageApiMap.total}</List.Item>
            </List>
          </Card>
        </Col>
      </Row>

      <Card className="workbench-panel" title="业务对象导航">
        <div className="object-grid">
          {objectShortcuts.map(([name, pageId, detail]) => {
            const allowed = canReadPage(profile, pageId);
            return (
              <button type="button" key={pageId} disabled={!allowed} onClick={() => openPage(pageId)}>
                <strong>{name}</strong><span>{detail}</span><small>{allowed ? '进入对象视图' : '当前角色未授权'}</small>
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
