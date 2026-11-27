import { Alert, Button, Card, Form, Input, Select } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../api';
import { useSession } from '../auth/SessionContext';

interface CompanyOption { company_code: string; company_name: string }

interface LoginFormValues {
  companyCode: string;
  account: string;
  password: string;
}

export default function LoginPage(): React.ReactElement {
  const navigate = useNavigate();
  const { refreshProfile } = useSession();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [companies, setCompanies] = useState<CompanyOption[]>([{ company_code: 'THL', company_name: 'THL分公司' }]);

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
        <div className="login-brand"><div className="brand-mark brand-mark--large">禽</div><span>蛋鸡养殖 ERP</span></div>
        <div>
          <h1>一体化养殖业务管理平台</h1>
          <p>覆盖养殖、采购、库存、销售、配送、财务、设备与质量追溯，帮助企业提升日常运营效率。</p>
        </div>
        <div className="login-coverage">
          <div><strong>13</strong><span>业务域</span></div>
          <div><strong>87</strong><span>业务功能</span></div>
          <div><strong>多端</strong><span>统一体验</span></div>
        </div>
      </section>
      <section className="login-form-panel">
        <Card className="login-card" bordered={false}>
          <div className="login-card-heading">
            <h2>欢迎登录</h2>
            <p>请选择公司并输入员工账号和密码。</p>
          </div>
          {error ? <Alert type="error" showIcon message={error} /> : null}
          <Form<LoginFormValues> layout="vertical" initialValues={{ companyCode: 'THL' }} onFinish={(values) => { void submit(values); }}>
            <Form.Item name="companyCode" label="公司" rules={[{ required: true, message: '请选择公司' }]}>
              <Select options={companies.map((company) => ({ label: `${company.company_code} · ${company.company_name}`, value: company.company_code }))} />
            </Form.Item>
            <Form.Item name="account" label="员工账号" rules={[{ required: true, message: '请输入员工账号' }]}>
              <Input prefix={<UserOutlined />} autoComplete="username" placeholder="请输入员工账号" />
            </Form.Item>
            <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
              <Input.Password prefix={<LockOutlined />} autoComplete="current-password" placeholder="请输入密码" />
            </Form.Item>
            <Button type="primary" size="large" block htmlType="submit" loading={submitting}>登录</Button>
          </Form>
        </Card>
      </section>
    </main>
  );
}
