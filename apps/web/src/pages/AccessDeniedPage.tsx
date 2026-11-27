import { Button, Result, Space } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSession } from '../auth/SessionContext';
import { roleLabel } from '../auth/roleLabels';
import { PAGE_MAP } from '../data/registry';

export default function AccessDeniedPage({ pageId }: { pageId: string }): React.ReactElement {
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
        title="当前角色无权访问"
        subTitle={`${profile ? roleLabel(profile.roles[0] ?? '管理员') : '当前账号'}不能访问「${page?.title ?? '该功能'}」`}
        extra={(
          <Space wrap>
            <Button type="primary" onClick={() => { void navigate(`${prefix}/workbench`); }}>返回工作台</Button>
            <Button onClick={() => { void navigate(`${prefix}/journeys`); }}>查看业务流程</Button>
          </Space>
        )}
      />
    </div>
  );
}
