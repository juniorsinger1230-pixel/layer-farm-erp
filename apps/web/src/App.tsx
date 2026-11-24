import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { Spin } from 'antd';
import { PAGE_MAP } from './data/registry';
import { useSession } from './auth/SessionContext';
import { canReadPage } from './auth/permissions';
import DesktopShell from './layouts/DesktopShell';
import MobileShell from './layouts/MobileShell';
import LoginPage from './pages/LoginPage';
import RoleWorkbench from './pages/RoleWorkbench';
import JourneyCenter from './pages/JourneyCenter';
import AccessDeniedPage from './pages/AccessDeniedPage';
import BusinessPage from './components/BusinessPage';
import MobileBusinessPage from './components/MobileBusinessPage';
import DashboardPage from './components/DashboardPage';

function FullScreenLoading() {
  return <div className="route-loading"><Spin size="large" tip="正在恢复真实会话..." /></div>;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { profile, initialized } = useSession();
  if (!initialized) return <FullScreenLoading />;
  if (!profile) return <Navigate to="/login" replace />;
  return children;
}

function BusinessRoute({ mobile = false }: { mobile?: boolean }) {
  const { profile } = useSession();
  const { pageId } = useParams();
  if (!pageId || !PAGE_MAP[pageId]) return <Navigate to={mobile ? '/h5/workbench' : '/app/workbench'} replace />;
  if (!profile || !canReadPage(profile, pageId)) return <AccessDeniedPage pageId={pageId} />;
  const page = PAGE_MAP[pageId];
  if (mobile) return <MobileBusinessPage page={page} />;
  if (page.pattern === 'dashboard') return <DashboardPage page={page} />;
  return <BusinessPage page={page} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/app/workbench" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth><DesktopShell /></RequireAuth>}>
          <Route path="/app/workbench" element={<RoleWorkbench />} />
          <Route path="/app/journeys" element={<JourneyCenter />} />
          <Route path="/app/:pageId" element={<BusinessRoute />} />
        </Route>
        <Route element={<RequireAuth><MobileShell /></RequireAuth>}>
          <Route path="/h5/workbench" element={<RoleWorkbench />} />
          <Route path="/h5/journeys" element={<JourneyCenter />} />
          <Route path="/h5/:pageId" element={<BusinessRoute mobile />} />
        </Route>
        <Route path="*" element={<Navigate to="/app/workbench" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
