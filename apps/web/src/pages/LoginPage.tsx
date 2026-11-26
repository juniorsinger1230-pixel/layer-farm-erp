import { Alert, Button, Card, Form, Input, Select, Tag } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../api';
import { useSession } from '../auth/SessionContext';
import { COVERAGE } from '../data/registry';

interface CompanyOption { company_code: string; company_name: string }

interface LoginFormValues {
  companyCode: string;
  account: string;
  password: string;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { refreshProfile } = useSession();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [companies, setCompanies] = useState<CompanyOption[]>([{ company_code: 'THL', company_name: 'Tyranids Holdings Layer' }]);

  useEffect(() => {
    let active = true;
    const loadCompanies = async (): Promise<void> => {
      try {
        const response = await fetch('/api/v1/auth/companies');
        if (!response.ok) return;
        const body = await response.json() as { data?: CompanyOption[] };
        if (active && body.data && body.data.length > 0) setCompanies(body.data);
      } catch {
        // Keep the default company option when the directory is temporarily unavailable.
      }
    };
    void loadCompanies();
    return () => { active = false; };
  }, []);

  const submit = async (values: LoginFormValues): Promise<void> => {
    setError('');
    setSubmitting(true);
    try {
      await login(values);
      await refreshProfile();
      await navigate('/app/workbench');
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请检查账号和密码');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-brand-panel">
        <div className="login-brand"><div className="brand-mark brand-mark--large">禽</div><span>LAYER HEN ERP</span></div>
        <div>
          <Tag color="blue">高保真真实业务前端</Tag>
          <h1>让每一条需求，<br />都能被看见、操作与确认。</h1>
          <p>面向蛋鸡养殖全业务链的真实业务工作台，覆盖养殖、采购、库存、销售、财务、设备、质量追溯和统一权限。</p>
        </div>
        <div className="login-coverage">
          <div><strong>{COVERAGE.domains}</strong><span>业务域</span></div>
          <div><strong>{COVERAGE.businessPages}</strong><span>业务页面</span></div>
          <div><strong>20</strong><span>关键旅程</span></div>
        </div>
        <p className="login-note">基于 React 18 · Ant Design 5 · Hono · PostgreSQL<br />连接真实认证、真实 RBAC 与真实 API；当前试用环境关闭 MFA。</p>
      </section>
      <section className="login-form-panel">
        <Card className="login-card" bordered={false}>
          <div className="login-card-heading">
            <span className="login-kicker">SECURE SIGN IN</span>
            <h2>进入蛋鸡养殖 ERP</h2>
            <p>请使用公司、员工账号和密码登录。</p>
          </div>
          {error && <Alert type="error" showIcon message={error} className="prototype-notice" />}
          <Form<LoginFormValues> layout="vertical" initialValues={{ companyCode: 'THL' }} onFinish={(values) => { void submit(values); }}>
            <Form.Item name="companyCode" label="公司" rules={[{ required: true, message: '请选择公司' }]}>
              <Select options={companies.map((company) => ({ label: `${company.company_code} · ${company.company_name}`, value: company.company_code }))} />
            </Form.Item>
            <Form.Item name="account" label="员工账号" rules={[{ required: true, message: '请输入员工账号' }]}>
              <Input prefix={<UserOutlined />} autoComplete="username" placeholder="例如 trial.admin" />
            </Form.Item>
            <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
              <Input.Password prefix={<LockOutlined />} autoComplete="current-password" />
            </Form.Item>
            <Button type="primary" size="large" block htmlType="submit" loading={submitting}>登录工作台</Button>
          </Form>
          <div className="login-demo">无 MFA 验证码 · 权限由后端统一校验<br />请勿在公开页面粘贴非试用账号密码。</div>
        </Card>
      </section>
    </main>
  );
}
