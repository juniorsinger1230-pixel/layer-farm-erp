import { Alert, Button, Result, Space, Tag } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSession } from '../auth/SessionContext';
import { roleLabel } from '../auth/roleLabels';
import { PAGE_MAP } from '../data/registry';

export default function AccessDeniedPage({ pageId }: { pageId: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useSession();
  const mobile = location.pathname.startsWith('/h5');
  const prefix = mobile ? '/h5' : '/app';
  const page = PAGE_MAP[pageId];
  return (
    <div className="access-denied-page" data-testid="access-denied" data-page-id={pageId}>
      <Result
        status="403"
        icon={<LockOutlined />}
        title="403 · 当前角色无权访问"
        subTitle={<Space direction="vertical"><span>{profile ? roleLabel(profile.roles[0] ?? 'admin') : '当前账号'}不能访问「{page?.title ?? pageId}」</span><Tag>{page?.requirementId ?? pageId}</Tag></Space>}
        extra={<Space wrap><Button type="primary" onClick={() => { void navigate(`${prefix}/workbench`); }}>返回我的工作台</Button><Button onClick={() => { void navigate(`${prefix}/journeys`); }}>查看关键旅程</Button></Space>}
      />
      <Alert type="warning" showIcon message="前端拦截仅为第一层体验；后端 API 会独立执行权限、公司范围和数据范围校验。" />
    </div>
  );
}
