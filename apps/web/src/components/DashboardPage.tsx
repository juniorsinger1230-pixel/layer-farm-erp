import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import type { ColumnConfig, PieConfig } from '@ant-design/plots';
import { Alert, Button, Card, Col, Row, Space, Spin, Statistic, Table, Tag } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { api } from '../api';
import { useSession } from '../auth/SessionContext';
import type { MappedPageContract } from '../auth/permissions';
import { CHART_PALETTE } from '../designTokens';
import pageApiMap from '../generated/page-api-map.json';
import type { PageDefinition } from '../types';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

type DashboardRecord = {
  company_id: number;
  read_model_key: string;
  source_event_version: number;
  source_updated_at?: string;
  projection_payload: Record<string, JsonValue>;
  projected_at: string;
};

type DashboardResponse = {
  items: DashboardRecord[];
  total: number;
};

const LazyColumn = lazy(() => import('@ant-design/plots').then(({ Column: ColumnChart }) => ({ default: ColumnChart })));
const LazyPie = lazy(() => import('@ant-design/plots').then(({ Pie: PieChart }) => ({ default: PieChart })));

function ColumnChart(props: ColumnConfig) {
  return <Suspense fallback={<Spin className="chart-loading" />}><LazyColumn {...props} /></Suspense>;
}

function PieChart(props: PieConfig) {
  return <Suspense fallback={<Spin className="chart-loading" />}><LazyPie {...props} /></Suspense>;
}

function countMetrics(value: JsonValue): number {
  if (value === null || typeof value !== 'object') return 1;
  return Object.values(value).reduce<number>((sum, child) => sum + countMetrics(child), 0);
}

function valueKind(value: JsonValue): string {
  if (value === null) return '空值';
  if (Array.isArray(value)) return '数组';
  if (typeof value === 'object') return '对象';
  if (typeof value === 'number') return '数值';
  if (typeof value === 'boolean') return '布尔值';
  return '文本';
}

function formatTime(value?: string): string {
  return value ? new Date(value).toLocaleString() : '—';
}

export default function DashboardPage({ page }: { page: PageDefinition }) {
  const { profile } = useSession();
  const [items, setItems] = useState<DashboardRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const contract = (pageApiMap.mapped as Record<string, MappedPageContract>)[page.pageId];

  const load = async () => {
    if (!contract?.path) {
      setError('当前页面数据暂不可用');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await api<DashboardResponse>(`${contract.path}?page=1&pageSize=100`);
      setItems(response.items);
      setTotal(response.total);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '驾驶舱数据加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [profile]);

  const latestVersion = useMemo(
    () => items.reduce((max, item) => Math.max(max, item.source_event_version), 0),
    [items],
  );
  const metricCount = useMemo(
    () => items.reduce((sum, item) => sum + countMetrics(item.projection_payload), 0),
    [items],
  );
  const latestProjection = useMemo(
    () => items.map((item) => item.projected_at).sort().at(-1),
    [items],
  );
  const versionData = useMemo(
    () => items.map((item) => ({ key: item.read_model_key, version: item.source_event_version })),
    [items],
  );
  const payloadKindData = useMemo(() => {
    const groups = new Map<string, number>();
    items.forEach((item) => {
      Object.values(item.projection_payload).forEach((value) => {
        const kind = valueKind(value);
        groups.set(kind, (groups.get(kind) ?? 0) + 1);
      });
    });
    return [...groups].map(([type, count]) => ({ type, count }));
  }, [items]);

  return (
    <div className="business-page dashboard-page" data-page-id={page.pageId}>
      <Card className="page-intro">
        <Space wrap>
          <Tag color="blue">经营看板</Tag>
          <Tag>{profile?.companyCode ?? ''}</Tag>
        </Space>
        <h2>{page.title}</h2>
        <p>本驾驶舱展示经营指标、事件版本和最新业务数据，帮助管理人员快速掌握运营情况。</p>
        <Button icon={<ReloadOutlined />} onClick={() => { void load(); }} loading={loading}>刷新驾驶舱</Button>
      </Card>

      {error && <Alert type="error" showIcon message={error} style={{ marginTop: 16 }} />}

      <Row gutter={[16, 16]} className="metric-row" style={{ marginTop: 16 }}>
        <Col xs={12} xl={6}><Card><Statistic title="投影记录数" value={total} loading={loading} /></Card></Col>
        <Col xs={12} xl={6}><Card><Statistic title="最新事件版本" value={latestVersion} loading={loading} /></Card></Col>
        <Col xs={12} xl={6}><Card><Statistic title="指标项总数" value={metricCount} loading={loading} /></Card></Col>
        <Col xs={12} xl={6}><Card><Statistic title="最近投影时间" value={formatTime(latestProjection)} loading={loading} /></Card></Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} xl={14}>
          <Card title="读模型事件版本">
            <ColumnChart
              height={300}
              data={versionData}
              xField="key"
              yField="version"
              color={CHART_PALETTE[0]}
              label={{ position: 'top' }}
              axis={{ x: { labelAutoRotate: true } }}
            />
          </Card>
        </Col>
        <Col xs={24} xl={10}>
          <Card title="指标载荷类型">
            <PieChart
              height={300}
              data={payloadKindData}
              angleField="count"
              colorField="type"
              color={CHART_PALETTE}
              radius={0.8}
              innerRadius={0.55}
              label={{ text: 'count' }}
            />
          </Card>
        </Col>
      </Row>

      <Card title="经营看板投影明细" className="table-card" style={{ marginTop: 16 }}>
        <Table
          rowKey="read_model_key"
          loading={loading}
          dataSource={items}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          expandable={{
            expandedRowRender: (record) => (
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {JSON.stringify(record.projection_payload, null, 2)}
              </pre>
            ),
          }}
          columns={[
            { title: '读模型键', dataIndex: 'read_model_key' },
            { title: '公司编号', dataIndex: 'company_id', width: 100 },
            { title: '事件版本', dataIndex: 'source_event_version', width: 110 },
            { title: '来源更新时间', dataIndex: 'source_updated_at', width: 200, render: formatTime },
            { title: '投影时间', dataIndex: 'projected_at', width: 200, render: formatTime },
          ]}
        />
      </Card>
    </div>
  );
}
