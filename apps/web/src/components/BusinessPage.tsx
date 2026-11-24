import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Descriptions, Drawer, Empty, Input, Row, Space, Statistic, Steps, Table, Tag } from 'antd';
import type { TableColumnsType } from 'antd';
import { DownloadOutlined, EyeOutlined, PrinterOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { api } from '../api';
import { useSession } from '../auth/SessionContext';
import { getMappedContract, canCreatePage, canUpdatePage } from '../auth/permissions';
import type { PageDefinition } from '../types';
import ContractGapPage from './ContractGapPage';

type BusinessRow = Record<string, unknown>;
type ListResponse = { items: BusinessRow[]; total: number };

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

export default function BusinessPage({ page }: { page: PageDefinition }) {
  const { profile } = useSession();
  const contract = getMappedContract(page.pageId);
  const [rows, setRows] = useState<BusinessRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [detail, setDetail] = useState<BusinessRow | null>(null);
  const [requirementOpen, setRequirementOpen] = useState(false);

  const load = useCallback(async () => {
    if (!contract) return;
    setLoading(true);
    setError('');
    try {
      const result = await api<ListResponse>(`${contract.path}?page=1&pageSize=50`);
      setRows(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : '真实数据加载失败');
    } finally {
      setLoading(false);
    }
  }, [contract]);

  useEffect(() => { void load(); }, [load]);

  const filteredRows = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    if (!normalized) return rows;
    return rows.filter((row) => Object.values(row).map(displayValue).join(' ').toLowerCase().includes(normalized));
  }, [keyword, rows]);

  const columns = useMemo<TableColumnsType<BusinessRow>>(() => {
    const first = rows[0];
    const keys = first ? Object.keys(first) : [];
    return [
      ...keys.map((key) => ({
        title: key,
        dataIndex: key,
        key,
        width: 150,
        ellipsis: true,
        render: (value: unknown) => displayValue(value),
      })),
      {
        title: '操作', key: 'actions', width: 96, fixed: 'right',
        render: (_: unknown, row: BusinessRow) => <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setDetail(row)}>详情</Button>,
      },
    ];
  }, [rows]);

  const exportCsv = () => {
    const first = rows[0];
    const keys = first ? Object.keys(first) : [];
    const escape = (value: unknown) => `"${displayValue(value).replace(/"/g, '""')}"`;
    const lines = filteredRows.map((row) => keys.map((key) => escape(row[key])));
    const csv = [keys.map(escape), ...lines].join('\r\n');
    const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${page.pageId}_真实数据导出.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (!contract || !profile) return <ContractGapPage page={page} />;
  const writeReady = canCreatePage(profile, page.pageId) || canUpdatePage(profile, page.pageId);

  return (
    <div className="business-page" data-page-id={page.pageId} data-requirement-id={page.requirementId}>
      <Card className="page-intro" bordered={false}>
        <Space wrap size={8} className="page-intro__eyebrow">
          <span className="domain-kicker">{page.domain} · {page.domainName}</span>
          <Tag color={page.priority === 'P0' ? 'red' : 'blue'}>{page.priority}</Tag>
          <Tag color="green">真实 API</Tag>
        </Space>
        <h2>{page.title}</h2>
        <p>{page.description}</p>
        <Space wrap className="requirement-meta">
          <span>{page.requirementId}</span>
          <span>{page.useCaseId}</span>
          <span>AC {page.acceptanceIds.length}</span>
          <span>BR {page.businessRuleIds.length}</span>
          <Button size="small" onClick={() => setRequirementOpen(true)}>需求详情</Button>
        </Space>
      </Card>

      {error && <Alert type="error" showIcon message={error} action={<Button onClick={() => { void load(); }}>重试</Button>} />}
      {writeReady && <Alert type="info" showIcon message="当前批次已接入真实读取和后端权限；写入 DTO 字段契约将在后续批次闭合，不使用前端本地 Mock 写入。" />}

      <Row gutter={[16, 16]} className="metric-row">
        <Col xs={12} xl={6}><Card><Statistic title="服务端总量" value={total} /></Card></Col>
        <Col xs={12} xl={6}><Card><Statistic title="当前加载" value={rows.length} /></Card></Col>
        <Col xs={12} xl={6}><Card><Statistic title="筛选结果" value={filteredRows.length} /></Card></Col>
        <Col xs={12} xl={6}><Card><Statistic title="当前公司" value={profile.companyCode} /></Card></Col>
      </Row>

      <Card className="flow-card" title="标准业务流">
        <Steps size="small" current={1} items={(page.flow.length ? page.flow : ['发起', '校验', '审批', '归档']).map((item) => ({ title: item }))} />
      </Card>

      <Card className="filter-card">
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} md={12}><Input allowClear prefix={<SearchOutlined />} value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="在当前已加载真实数据中搜索" /></Col>
          <Col xs={24} md={12}>
            <Space wrap>
              <Button type="primary" icon={<ReloadOutlined />} onClick={() => { void load(); }} loading={loading}>刷新真实数据</Button>
              <Button icon={<DownloadOutlined />} onClick={exportCsv}>导出 CSV</Button>
              <Button icon={<PrinterOutlined />} onClick={() => window.print()}>打印</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card className="table-card" title={<Space><span>业务记录</span><Tag color="blue">{contract.table}</Tag></Space>}>
        <Table
          rowKey={(row) => displayValue(row.id ?? row.updated_at ?? JSON.stringify(row))}
          columns={columns}
          dataSource={filteredRows}
          loading={loading}
          scroll={{ x: 'max-content' }}
          pagination={{ pageSize: 8, showSizeChanger: true, showTotal: (count) => `共 ${count} 条` }}
          locale={{ emptyText: <Empty description="当前公司暂无真实业务数据" /> }}
        />
      </Card>

      <Drawer title={page.title} open={requirementOpen} onClose={() => setRequirementOpen(false)} width={640}>
        <Descriptions bordered column={1} size="small" items={[
          { key: 'requirement', label: '需求', children: page.requirementId },
          { key: 'useCase', label: '用例', children: page.useCaseId },
          { key: 'preconditions', label: '前置条件', children: page.preconditions.join('；') || '无' },
          { key: 'outputs', label: '输出', children: page.outputs.join('；') || '无' },
          { key: 'exceptions', label: '异常', children: page.exceptions.join('；') || '无' },
        ]} />
      </Drawer>

      <Drawer title="业务详情" open={Boolean(detail)} onClose={() => setDetail(null)} width={680}>
        {detail && <Descriptions bordered column={1} size="small" items={Object.entries(detail).map(([key, value]) => ({ key, label: key, children: displayValue(value) }))} />}
      </Drawer>
    </div>
  );
}
