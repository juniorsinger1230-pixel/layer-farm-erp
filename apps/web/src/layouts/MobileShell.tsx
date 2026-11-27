import { useState } from 'react';
import { Avatar, Badge, Button, Drawer, Space, Tag } from 'antd';
import { BellOutlined, MenuOutlined, UserOutlined } from '@ant-design/icons';
import { TabBar } from 'antd-mobile';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { DOMAIN_GROUPS } from '../data/registry';
import { useSession } from '../auth/SessionContext';
import { roleLabel } from '../auth/roleLabels';
import { logoutLocal } from '../api';

const notices = [
  { title: '采购订单待验收', description: '今日有 2 笔采购订单等待验收。' },
  { title: '库存批次临期提醒', description: '部分饲料批次临近有效期。' },
];

export default function MobileShell(): React.ReactNode {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);

  if (!profile) return null;

  const activeKey = location.pathname.includes('/journeys') ? 'journeys' : 'workbench';
  const logout = (): void => {
    logoutLocal();
    void navigate('/login');
  };

  return (
    <div className="mobile-shell">
      <header className="mobile-header">
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Button type="text" icon={<MenuOutlined />} onClick={() => setMenuOpen(true)} />
          <div className="app-brand"><div className="brand-mark">禽</div><span>蛋鸡养殖 ERP</span></div>
          <Badge count={notices.length} size="small">
            <Button type="text" icon={<BellOutlined />} onClick={() => setNoticeOpen(true)} />
          </Badge>
        </Space>
      </header>

      <main className="mobile-content">
        <Outlet />
      </main>

      <nav className="mobile-tabbar">
        <TabBar activeKey={activeKey} onChange={(key) => void navigate(key === 'journeys' ? '/h5/journeys' : '/h5/workbench')}>
          <TabBar.Item key="workbench" title="工作台" />
          <TabBar.Item key="journeys" title="业务流程" />
          <TabBar.Item key="notice" title="通知" badge={notices.length} />
          <TabBar.Item key="me" title="我的" />
        </TabBar>
      </nav>

      <Drawer title="业务菜单" placement="left" open={menuOpen} onClose={() => setMenuOpen(false)} width="82%">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Space className="mobile-user-summary">
            <Avatar icon={<UserOutlined />} />
            <div>
              <strong>{profile.employeeNo}</strong>
              <div><Tag>{roleLabel(profile.roles[0] ?? '')}</Tag></div>
            </div>
          </Space>
          {DOMAIN_GROUPS.map((group) => (
            <div key={group.domain} className="mobile-menu-group">
              <strong>{group.domainName}</strong>
              {group.pages.map((page) => (
                <Button
                  key={page.pageId}
                  block
                  type="text"
                  onClick={() => {
                    setMenuOpen(false);
                    void navigate(page.route.replace('/app', '/h5'));
                  }}
                >
                  {page.title}
                </Button>
              ))}
            </div>
          ))}
          <Button block danger onClick={logout}>退出登录</Button>
        </Space>
      </Drawer>

      <Drawer title="业务通知" open={noticeOpen} onClose={() => setNoticeOpen(false)} width="92%">
        <Space direction="vertical" style={{ width: '100%' }}>
          {notices.map((notice) => (
            <div key={notice.title} className="notice-item">
              <strong>{notice.title}</strong>
              <p>{notice.description}</p>
            </div>
          ))}
        </Space>
      </Drawer>
    </div>
  );
}
