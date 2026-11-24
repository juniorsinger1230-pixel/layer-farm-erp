import { useEffect, useMemo, useState } from 'react';
import { Avatar, Badge, Breadcrumb, Button, Drawer, Dropdown, Empty, Input, Layout, List, Menu, Modal, Space, Tabs, Tag, Tooltip } from 'antd';
import {
  ApartmentOutlined, BarChartOutlined, BellOutlined, ControlOutlined, DatabaseOutlined,
  FileTextOutlined, HomeOutlined, MenuFoldOutlined, MenuUnfoldOutlined, MedicineBoxOutlined,
  NodeIndexOutlined, PrinterOutlined, ProfileOutlined, SearchOutlined, SettingOutlined,
  ShoppingCartOutlined, ToolOutlined, UserOutlined, WalletOutlined,
} from '@ant-design/icons';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { roleLabel } from '../auth/roleLabels';
import { useSession } from '../auth/SessionContext';
import { canReadPage } from '../auth/permissions';
import { DOMAIN_GROUPS, PAGE_MAP } from '../data/registry';
import pageApiMap from '../generated/page-api-map.json';
import type { DomainCode } from '../types';

const { Sider, Header, Content } = Layout;
const domainIcons: Record<DomainCode, React.ReactNode> = {
  ORG: <ApartmentOutlined />, FARM: <HomeOutlined />, VET: <MedicineBoxOutlined />,
  PROC: <ShoppingCartOutlined />, INV: <DatabaseOutlined />, SALES: <FileTextOutlined />,
  LOG: <NodeIndexOutlined />, FIN: <WalletOutlined />, EQP: <ToolOutlined />,
  RPT: <BarChartOutlined />, PRINT: <PrinterOutlined />, TRACE: <NodeIndexOutlined />, PLAT: <ControlOutlined />,
};

type NotificationRow = Record<string, unknown>;
type ListResponse = { items: NotificationRow[]; total: number };

function safeText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

export default function DesktopShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, logout } = useSession();
  const pageId = location.pathname.split('/').pop() ?? 'workbench';
  const current = PAGE_MAP[pageId];
  const [collapsed, setCollapsed] = useState(false);
  const [openKeys, setOpenKeys] = useState<string[]>([current?.domain ?? 'RPT']);
  const [openTabs, setOpenTabs] = useState<string[]>(['workbench']);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const go = (id: string) => {
    if (id === 'workbench') void navigate('/app/workbench');
    else if (id === 'journeys') void navigate('/app/journeys');
    else void navigate(`/app/${id}`);
    setOpenTabs((tabs) => tabs.includes(id) ? tabs : [...tabs, id]);
    const definition = PAGE_MAP[id];
    if (definition) setOpenKeys((keys) => keys.includes(definition.domain) ? keys : [...keys, definition.domain]);
  };

  const closeTab = (id: string) => {
    const nextTabs = openTabs.filter((tab) => tab !== id);
    setOpenTabs(nextTabs.length ? nextTabs : ['workbench']);
    if (id === pageId) go(nextTabs[nextTabs.length - 1] ?? 'workbench');
  };

  const openNotifications = async () => {
    setNotificationsOpen(true);
    try {
      const result = await api<ListResponse>('/api/v1/plat/notifications?page=1&pageSize=20');
      setNotifications(result.items);
    } catch {
      setNotifications([]);
    }
  };

  const visibleTabs = openTabs.filter((id) => id === 'workbench' || id === 'journeys' || (profile && canReadPage(profile, id)));
  const searchResults = useMemo(() => {
    if (!profile) return [];
    return DOMAIN_GROUPS.flatMap((group) => group.pages)
      .filter((page) => canReadPage(profile, page.pageId) && (!search || `${page.title} ${page.requirementId} ${page.domainName}`.toLowerCase().includes(search.toLowerCase())))
      .slice(0, 12);
  }, [profile, search]);

  const menuItems = [
    { key: 'workbench', icon: <ProfileOutlined />, label: '我的工作台' },
    { key: 'journeys', icon: <NodeIndexOutlined />, label: '关键旅程中心' },
    ...DOMAIN_GROUPS.map((group) => ({
      key: group.domain,
      icon: domainIcons[group.domain],
      label: group.domainName,
      children: group.pages
        .filter((page) => profile && canReadPage(profile, page.pageId))
        .map((page) => ({ key: page.pageId, label: <span className="menu-page-label">{page.title}<Tag>{page.priority}</Tag></span> })),
    })).filter((group) => group.children.length > 0),
  ];
  const tabItems = [
    { key: 'workbench', label: '我的工作台', closable: false },
    { key: 'journeys', label: '关键旅程', closable: false },
    ...visibleTabs.map((id) => ({ key: id, label: PAGE_MAP[id]?.title ?? id, closable: id !== 'workbench' && id !== 'journeys' })),
  ];
  const breadcrumbTitle = pageId === 'workbench' ? '我的工作台' : pageId === 'journeys' ? '关键旅程中心' : current?.title ?? '未找到';

  if (!profile) return null;
  return (
    <Layout className="desktop-shell">
      <Sider width={240} collapsedWidth={64} collapsed={collapsed} trigger={null} className="desktop-sider">
        <div className="brand-block">
          <div className="brand-mark">禽</div>
          {!collapsed && <div><strong>蛋鸡养殖 ERP</strong><span>真实 API 业务工作台</span></div>}
        </div>
        <div className="sidebar-context"><span className="status-dot" />{collapsed ? profile.companyCode : `${profile.companyCode} · ${roleLabel(profile.roles[0] ?? 'admin')}`}</div>
        <Menu mode="inline" selectedKeys={[pageId]} openKeys={openKeys} onOpenChange={setOpenKeys} items={menuItems} onClick={({ key }) => go(String(key))} />
        {!collapsed && <div className="sidebar-coverage"><strong>接入进度</strong><span>15 类真实角色</span><span>{pageApiMap.mappedCount}/{pageApiMap.total} 页接入真实 API</span><span>{pageApiMap.gapCount} 页契约缺口</span></div>}
      </Sider>
      <Layout className="desktop-main">
        <Header className="desktop-header">
          <div className="header-left">
            <Tooltip title={collapsed ? '展开导航' : '折叠导航'}><Button type="text" icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />} onClick={() => setCollapsed(!collapsed)} /></Tooltip>
            <Breadcrumb items={[{ title: '蛋鸡养殖 ERP' }, { title: current?.domainName ?? '工作台' }, { title: breadcrumbTitle }]} />
          </div>
          <Button type="text" className="global-search" onClick={() => setSearchOpen(true)}><SearchOutlined /><span>搜索可访问页面</span><kbd>Ctrl K</kbd></Button>
          <Space className="header-actions">
            <Badge count={notifications.length} size="small"><Button type="text" aria-label="通知" icon={<BellOutlined />} onClick={() => { void openNotifications(); }} /></Badge>
            <Dropdown menu={{
              items: [
                { key: 'settings', icon: <SettingOutlined />, label: '个人设置' },
                { type: 'divider' },
                { key: 'logout', label: '退出登录' },
              ],
              onClick: ({ key }) => {
                if (key === 'logout') {
                  void (async () => {
                    await logout();
                    await navigate('/login');
                  })();
                }
              },
            }}>
              <Space className="user-entry"><Avatar size="small" icon={<UserOutlined />} /><span>{profile.employeeNo}</span></Space>
            </Dropdown>
          </Space>
        </Header>
        <Tabs className="workspace-tabs" type="editable-card" hideAdd activeKey={pageId} items={tabItems} onChange={go} onEdit={(key, action) => { if (action === 'remove') { const tabKey = typeof key === 'string' ? key : safeText(key); closeTab(tabKey); } }} />
        <Content className="desktop-content"><Outlet /><footer className="prototype-footer">真实认证 · 真实 RBAC · 真实 API；契约缺口页面不展示 Mock 数据。</footer></Content>
      </Layout>

      <Modal title="全局页面搜索" open={searchOpen} onCancel={() => setSearchOpen(false)} footer={null} width={680} destroyOnClose>
        <Input autoFocus size="large" prefix={<SearchOutlined />} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索页面、需求编号或业务域" />
        <List className="search-results" dataSource={searchResults} renderItem={(page) => <List.Item onClick={() => { go(page.pageId); setSearchOpen(false); setSearch(''); }}><List.Item.Meta title={<Space>{page.title}<Tag>{page.priority}</Tag></Space>} description={`${page.domainName} · ${page.requirementId}`} /><Button type="link">打开</Button></List.Item>} />
      </Modal>

      <Drawer title="通知（真实 API）" width={420} open={notificationsOpen} onClose={() => setNotificationsOpen(false)}>
        {notifications.length ? <List dataSource={notifications} renderItem={(item) => <List.Item><List.Item.Meta title={safeText(item.title ?? item.id ?? '通知')} description={safeText(item.content ?? '')} /></List.Item>} /> : <Empty description="暂无真实通知数据" />}
      </Drawer>
    </Layout>
  );
}
