import { Button, Result } from 'antd';
import { useNavigate } from 'react-router-dom';

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <Result
      status="404"
      title="页面不存在或尚未纳入当前系统"
      subTitle="请从授权菜单中选择有效页面，或返回我的工作台。"
      extra={<Button type="primary" onClick={() => { void navigate('/app/workbench'); }}>返回我的工作台</Button>}
    />
  );
}
