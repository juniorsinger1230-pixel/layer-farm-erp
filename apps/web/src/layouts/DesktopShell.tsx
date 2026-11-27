import { useMemo, useState } from 'react';
import { Avatar, Badge, Button, Drawer, Dropdown, Input, Layout, Menu, Space, Tag, Typography } from 'antd';
import { BellOutlined, LogoutOutlined, MenuFoldOutlined, MenuUnfoldOutlined, SearchOutlined, UserOutlined } from '@ant-design/icons';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { DOMAIN_GROUPS, PAGE_MAP } from '../data/registry';
import { useSession } from '../auth/SessionContext';
import { logoutLocal } from '../api';

const { Header, Sider, Content, Footer } = Layout;

const businessNotices = [
  { id: 'notice-1', title: '采购订单待验收', description: '今日有 2 笔采购订单等待仓库验收。', level: '处理中' },
  { id: 'notice-2', title: '库存批次临期提醒', description: '部分饲料批次临近有效期，请优先安排领用。', level: '提醒' },
  { id: 'notice-3', title: '销售订单待签收', description: '昨日配送订单尚有客户签收未完成。', level: '跟进' },
];

function pageTitle(pathname: string): string {
  const pageId = pathname.split('/').filter(Boolean).at(-1);
  if (pageId === 'workbench') return '工作台';
  if (pageId === 'journeys') return '业务流程';
  return pageId ? PAGE_MAP[pageId]?.title ?? '业务页面' : '业务页面';
}

export default function DesktopShell(): React.ReactNode {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useSession();
  const [collapsed, setCollapsed] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [keyword, setKeyword] = useState('');

  const menuItems = useMemo(() => {
    const groups = DOMAIN_GROUPS.map((group) => ({
      key: group.domain,
      label: group.domainName,
      children: group.pages
        .filter((page) => page.title.includes(keyword.trim()))
        .map((page) => ({ key: page.route, label: page.title })),
    }));
    return [
      { key: '/app/workbench', label: '工作台' },
      { key: '/app/journeys', label: '业务流程' },
      ...groups.filter((group) => group.children.length > 0),
    ];
  }, [keyword]);

  const selectedKey = location.pathname.startsWith('/app/workbench')
    ? '/app/workbench'
    : location.pathname.startsWith('/app/journeys')
      ? '/app/journeys'
      : location.pathname;

  const logout = (): void => {
    logoutLocal();
    void navigate('/login');
  };

  if (!profile) return null;

  return (
    <Layout className="app-shell" style={{ minHeight: '100vh' }}>
      <Sider theme="light" collapsible collapsed={collapsed} trigger={null} width={248} className="app-sider">
        <div className="app-brand">
          <div className="brand-mark">禽</div>
          {!collapsed ? <span>蛋鸡养殖 ERP</span> : null}
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          defaultOpenKeys={DOMAIN_GROUPS.map((group) => group.domain)}
          items={menuItems}
          onClick={({ key }) => { if (key.startsWith('/')) void navigate(key); }}
        />
      </Sider>

      <Layout>
        <Header className="app-header">
          <Space>
            <Button type="text" icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />} onClick={() => setCollapsed(!collapsed)} />
            <Typography.Title level={4} style={{ margin: 0 }}>{pageTitle(location.pathname)}</Typography.Title>
          </Space>
          <Space size={16}>
            <Input
              prefix={<SearchOutlined />}
              placeholder="搜索业务菜单"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              style={{ width: 220 }}
              allowClear
            />
            <Badge count={businessNotices.length} size="small">
              <Button type="text" icon={<BellOutlined />} onClick={() => setNoticeOpen(true)} />
            </Badge>
            <Dropdown
              menu={{
                items: [
                  { key: 'profile', label: '账户信息', icon: <UserOutlined /> },
                  { key: 'logout', label: '退出登录', icon: <LogoutOutlined /> },
                ],
                onClick: ({ key }) => { if (key === 'logout') logout(); },
              }}
            >
              <Space className="user-menu">
                <Avatar icon={<UserOutlined />} />
                <span>{profile.employeeNo}</span>
              </Space>
            </Dropdown>
          </Space>
        </Header>

        <Content className="app-content">
          <Outlet />
        </Content>

        <Footer className="app-footer">蛋鸡养殖企业管理系统 · 内部业务使用</Footer>
      </Layout>

      <Drawer title="业务通知" open={noticeOpen} onClose={() => setNoticeOpen(false)} width={420}>
        <Space direction="vertical" style={{ width: '100%' }}>
          {businessNotices.map((notice) => (
            <div key={notice.id} className="notice-item">
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <strong>{notice.title}</strong>
                <Tag color="blue">{notice.level}</Tag>
              </Space>
              <p>{notice.description}</p>
            </div>
          ))}
        </Space>
      </Drawer>
    </Layout>
  );
}
