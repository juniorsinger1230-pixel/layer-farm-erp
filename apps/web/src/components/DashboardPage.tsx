import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import type { ColumnConfig, PieConfig } from '@ant-design/plots';
import { Alert, Button, Card, Col, Progress, Row, Space, Spin, Statistic, Table, Tag } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { api } from '../api';
import { useSession } from '../auth/SessionContext';
import { hasPermission } from '../auth/permissions';
import { CHART_PALETTE } from '../designTokens';
import { PAGE_MAP } from '../data/registry';
import pageApiMap from '../generated/page-api-map.json';
import type { PageDefinition } from '../types';

type ListResponse = { items: Record<string, unknown>[]; total: number };

const LazyColumn = lazy(() => import('@ant-design/plots').then(({ Column: ColumnChart }) => ({ default: ColumnChart })));
const LazyPie = lazy(() => import('@ant-design/plots').then(({ Pie: PieChart }) => ({ default: PieChart })));

function ColumnChart(props: ColumnConfig) {
  return <Suspense fallback={<Spin className="chart-loading" />}><LazyColumn {...props} /></Suspense>;
}

function PieChart(props: PieConfig) {
  return <Suspense fallback={<Spin className="chart-loading" />}><LazyPie {...props} /></Suspense>;
}

type DashboardRow = {
  pageId: string;
  title: string;
  domain: string;
  path: string;
  total: number;
  status: 'loaded' | 'failed';
  error: string;
};

async function mapWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = Array.from({ length: items.length }, () => undefined as R);
  let nextIndex = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index]!, index);
    }
  });
  await Promise.all(runners);
  return results;
}

export default function DashboardPage({ page }: { page: PageDefinition }) {
  const { profile } = useSession();
  const [rows, setRows] = useState<DashboardRow[]>([]);
  const [loading, setLoading] = useState(false);
  const contracts = profile
    ? Object.entries(pageApiMap.mapped).filter(([, contract]) =>
      hasPermission(profile.permissions, `${contract.permission}:read`))
    : [];

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const results = await mapWithConcurrency(contracts, 6, async ([pageId, contract]) => {
      try {
        const result = await api<ListResponse>(`${contract.path}?page=1&pageSize=1`);
        return { status: 'fulfilled' as const, value: { pageId, total: result.total, path: contract.path } };
      } catch (reason) {
        return { status: 'rejected' as const, reason };
      }
    });
    const next = results.map((result, index) => {
      const [pageId, contract] = contracts[index] ?? ['', { path: '' }];
      const definition = PAGE_MAP[pageId];
      if (result.status === 'fulfilled') {
        return { pageId, title: definition?.title ?? pageId, domain: definition?.domain ?? '', path: contract.path, total: result.value.total, status: 'loaded' as const, error: '' };
      }
      return { pageId, title: definition?.title ?? pageId, domain: definition?.domain ?? '', path: contract.path, total: 0, status: 'failed' as const, error: result.reason instanceof Error ? result.reason.message : '加载失败' };
    });
    setRows(next);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [profile]);

  const domainData = useMemo(() => {
    const groups = new Map<string, number>();
    rows.forEach((row) => groups.set(row.domain, (groups.get(row.domain) ?? 0) + row.total));
    return [...groups].map(([domain, total]) => ({ domain, total }));
  }, [rows]);
  const inaccessibleCount = pageApiMap.mappedCount - contracts.length;
  const statusData = useMemo(() => [
    { type: '有数据', count: rows.filter((row) => row.total > 0).length },
    { type: '空数据', count: rows.filter((row) => row.total === 0 && row.status === 'loaded').length },
    { type: '加载失败', count: rows.filter((row) => row.status === 'failed').length },
    { type: '无权限', count: inaccessibleCount },
  ], [rows, inaccessibleCount]);
  const totalRecords = rows.reduce((sum, row) => sum + row.total, 0);
  const failed = rows.filter((row) => row.status === 'failed');
  const zeroData = rows.filter((row) => row.status === 'loaded' && row.total === 0);

  return (
    <div className="business-page dashboard-page" data-page-id={page.pageId} data-requirement-id={page.requirementId}>
      <Card className="page-intro">
        <Space wrap><Tag color="blue">真实数据派生</Tag><Tag>{profile?.companyCode ?? ''}</Tag></Space>
        <h2>{page.title}</h2>
        <p>本驾驶舱根据当前账号可访问的真实 API 实时汇总，不使用硬编码模拟经营指标。</p>
        <Button icon={<ReloadOutlined />} onClick={() => { void load(); }} loading={loading}>刷新驾驶舱</Button>
      </Card>

      {failed.length > 0 && <Alert type="warning" showIcon message={`${failed.length} 个资源加载失败，已在明细表中标注`} />}

      <Row gutter={[16, 16]} className="metric-row">
        <Col xs={12} xl={6}><Card><Statistic title="真实记录总数" value={totalRecords} /></Card></Col>
        <Col xs={12} xl={6}><Card><Statistic title="可访问 API" value={contracts.length} /></Card></Col>
        <Col xs={12} xl={6}><Card><Statistic title="空数据资源" value={zeroData.length} /></Card></Col>
        <Col xs={12} xl={6}><Card><Statistic title="无权限 API" value={inaccessibleCount} /></Card></Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Card title="各业务域真实记录量">
            <ColumnChart height={300} data={domainData} xField="domain" yField="total" color={CHART_PALETTE[0]} label={{ position: 'top' }} />
          </Card>
        </Col>
        <Col xs={24} xl={10}>
          <Card title="资源接入状态">
            <PieChart height={300} data={statusData} angleField="count" colorField="type" color={CHART_PALETTE} radius={0.8} innerRadius={0.55} label={{ text: 'count' }} />
          </Card>
        </Col>
      </Row>

      <Card title="真实 API 接入明细" className="table-card">
        <Table
          rowKey="pageId"
          loading={loading}
          dataSource={rows}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          columns={[
            { title: '页面', dataIndex: 'title' },
            { title: '业务域', dataIndex: 'domain', width: 100 },
            { title: '总量', dataIndex: 'total', width: 100 },
            { title: '状态', dataIndex: 'status', width: 110, render: (value: string) => <Tag color={value === 'loaded' ? 'green' : 'red'}>{value}</Tag> },
            { title: '错误', dataIndex: 'error', ellipsis: true },
          ]}
        />
      </Card>

      <Card title="页面接入进度">
        <Progress percent={Math.round((pageApiMap.mappedCount / pageApiMap.total) * 100)} status="active" />
        <span>{pageApiMap.mappedCount}/{pageApiMap.total} 页面已接入真实 API，当前账号可访问 {contracts.length} 个；其余 {pageApiMap.gapCount} 页显示契约缺口而非 Mock 数据。</span>
      </Card>
    </div>
  );
}
