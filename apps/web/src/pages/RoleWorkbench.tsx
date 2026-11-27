import { Button, Card, Col, List, Row, Space, Statistic, Tag } from 'antd';
import { ArrowRightOutlined, BellOutlined, ProfileOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSession } from '../auth/SessionContext';
import { roleLabel } from '../auth/roleLabels';
import { canCreatePage, canReadPage, canUpdatePage } from '../auth/permissions';
import { PAGES } from '../data/registry';

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

export default function RoleWorkbench(): React.ReactNode {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useSession();
  const mobile = location.pathname.startsWith('/h5');
  const prefix = mobile ? '/h5' : '/app';
  if (!profile) return null;

  const accessiblePages = PAGES.filter((page) => canReadPage(profile, page.pageId));
  const writablePages = accessiblePages.filter((page) => canCreatePage(profile, page.pageId) || canUpdatePage(profile, page.pageId));
  const tasks = [...accessiblePages].sort((a, b) => a.index - b.index);
  const openPage = (pageId: string): void => { void navigate(`${prefix}/${pageId}`); };

  return (
    <div className="role-workbench" data-page-id="workbench" data-testid="role-workbench">
      <section className="workbench-hero">
        <div>
          <Space wrap><Tag>{profile.companyCode}</Tag><Tag>{roleLabel(profile.roles[0] ?? '管理员')}</Tag></Space>
          <h1>{roleLabel(profile.roles[0] ?? '管理员')}工作台</h1>
          <p>集中处理日常业务、查看业务通知并进入授权范围内的功能。</p>
          <div className="workbench-scope">
            公司范围：{profile.companyScope === '*' ? '全部公司' : profile.companyScope.join(', ')} · 栋舍范围：{profile.houseScope.length ? profile.houseScope.join(', ') : '未限定'} · 仓库范围：{profile.warehouseScope.length ? profile.warehouseScope.join(', ') : '未限定'}
          </div>
        </div>
      </section>

      <Row gutter={[16, 16]} className="workbench-metrics">
        <Col xs={12} lg={6}><Card><Statistic title="可访问功能" value={accessiblePages.length} prefix={<ProfileOutlined />} /></Card></Col>
        <Col xs={12} lg={6}><Card><Statistic title="可经办功能" value={writablePages.length} /></Card></Col>
        <Col xs={12} lg={6}><Card><Statistic title="今日待办" value={8} /></Card></Col>
        <Col xs={12} lg={6}><Card><Statistic title="业务通知" value={3} prefix={<BellOutlined />} /></Card></Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Card className="workbench-panel" title="我的岗位任务">
            <List
              dataSource={tasks.slice(0, mobile ? 6 : 10)}
              renderItem={(page) => (
                <List.Item actions={[<Button key="open" type="link" onClick={() => openPage(page.pageId)}>打开<ArrowRightOutlined /></Button>]}>
                  <List.Item.Meta title={page.title} description={page.domainName} />
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} xl={10}>
          <Card className="workbench-panel" title="账户信息">
            <List>
              <List.Item>员工编号：{profile.employeeNo}</List.Item>
              <List.Item>所属公司：{profile.companyCode}</List.Item>
              <List.Item>功能权限：{profile.permissions.length} 项</List.Item>
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
