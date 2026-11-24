import { useMemo, useState } from 'react';
import { Button, Collapse, List, NavBar, Popup, SearchBar, TabBar, Tag } from 'antd-mobile';
import { AppstoreOutline, ContentOutline, HistogramOutline, SetOutline, UserOutline } from 'antd-mobile-icons';
import { useLocation, useNavigate, Outlet } from 'react-router-dom';
import { roleLabel } from '../auth/roleLabels';
import { useSession } from '../auth/SessionContext';
import { canReadPage } from '../auth/permissions';
import { DOMAIN_GROUPS, PAGE_MAP } from '../data/registry';

export default function MobileShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, logout } = useSession();
  const pageId = location.pathname.split('/').pop() ?? 'workbench';
  const current = PAGE_MAP[pageId];
  const [menuOpen, setMenuOpen] = useState(false);
  const [keyword, setKeyword] = useState('');

  const groups = useMemo(() => {
    if (!profile) return [];
    return DOMAIN_GROUPS.map((group) => ({
      ...group,
      pages: group.pages.filter((page) => canReadPage(profile, page.pageId) && (!keyword || `${page.title}${page.requirementId}`.toLowerCase().includes(keyword.toLowerCase()))),
    })).filter((group) => group.pages.length);
  }, [keyword, profile]);

  const go = (id: string) => {
    if (id === 'workbench') void navigate('/h5/workbench');
    else if (id === 'journeys') void navigate('/h5/journeys');
    else void navigate(`/h5/${id}`);
    setMenuOpen(false);
  };

  const title = pageId === 'workbench' ? '我的工作台' : pageId === 'journeys' ? '关键旅程中心' : current?.title ?? '蛋鸡养殖 ERP';
  const activeTab = pageId === 'workbench' ? 'home' : pageId === 'journeys' ? 'journey' : 'role';

  if (!profile) return null;
  return (
    <div className="mobile-shell">
      <NavBar className="mobile-nav" onBack={() => { void navigate(-1); }} right={<SetOutline onClick={() => setMenuOpen(true)} />}>{title}</NavBar>
      <main className="mobile-content"><Outlet /></main>
      <TabBar className="mobile-tabbar" activeKey={activeTab} onChange={(key) => {
        if (key === 'more' || key === 'mine') setMenuOpen(true);
        else go({ home: 'workbench', journey: 'journeys', role: current?.pageId ?? 'workbench' }[key] ?? 'workbench');
      }}>
        <TabBar.Item key="home" title="工作台" icon={<HistogramOutline />} />
        <TabBar.Item key="role" title="岗位" icon={<AppstoreOutline />} />
        <TabBar.Item key="journey" title="旅程" icon={<ContentOutline />} />
        <TabBar.Item key="mine" title={roleLabel(profile.roles[0] ?? 'admin')} icon={<UserOutline />} />
        <TabBar.Item key="more" title="更多" icon={<SetOutline />} />
      </TabBar>

      <Popup visible={menuOpen} onMaskClick={() => setMenuOpen(false)} position="right" bodyStyle={{ width: '88vw', maxWidth: 420 }} closeOnMaskClick>
        <div className="mobile-menu-header">
          <strong>授权菜单</strong>
          <Tag color="primary">{profile.companyCode}</Tag>
        </div>
        <div className="mobile-menu-search"><SearchBar value={keyword} onChange={setKeyword} placeholder="搜索可访问页面" /></div>
        <div className="mobile-menu-body">
          <List>
            <List.Item onClick={() => go('workbench')} arrow={false}>我的工作台</List.Item>
            <List.Item onClick={() => go('journeys')} arrow={false}>关键旅程中心</List.Item>
          </List>
          <Collapse defaultActiveKey={current ? [current.domain] : []}>
            {groups.map((group) => (
              <Collapse.Panel key={group.domain} title={`${group.domainName}（${group.pages.length}）`}>
                <List>{group.pages.map((page) => <List.Item key={page.pageId} onClick={() => go(page.pageId)} description={page.requirementId} arrow={false} extra={<Tag>{page.priority}</Tag>}>{page.title}</List.Item>)}</List>
              </Collapse.Panel>
            ))}
          </Collapse>
          <Button block color="danger" onClick={() => { void (async () => { await logout(); await navigate('/login'); })(); }}>退出登录</Button>
        </div>
      </Popup>
    </div>
  );
}
