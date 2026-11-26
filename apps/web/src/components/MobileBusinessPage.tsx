import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, ErrorBlock, List, Popup, PullToRefresh, SearchBar, Tag } from 'antd-mobile';
import { api } from '../api';
import { getMappedContract } from '../auth/permissions';
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

export default function MobileBusinessPage({ page }: { page: PageDefinition }) {
  const contract = getMappedContract(page.pageId);
  const itemKey = contract?.itemKey ?? 'id';
  const [rows, setRows] = useState<BusinessRow[]>([]);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [detail, setDetail] = useState<BusinessRow | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!contract) return;
    setLoading(true);
    try {
      const result = await api<ListResponse>(`${contract.path}?page=1&pageSize=50`);
      setRows(result.items);
      setTotal(result.total);
    } finally {
      setLoading(false);
    }
  }, [contract]);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    if (!normalized) return rows;
    return rows.filter((row) => Object.values(row).map(displayValue).join(' ').toLowerCase().includes(normalized));
  }, [keyword, rows]);

  if (!contract) return <ContractGapPage page={page} />;

  return (
    <div className="mobile-business-page" data-page-id={page.pageId} data-requirement-id={page.requirementId}>
      <Card className="mobile-page-intro">
        <div className="mobile-title-row"><Tag color="primary">{page.domain}</Tag><span>{page.domainName}</span></div>
        <h2>{page.title}</h2>
        <p>{page.requirementId}</p>
        <span>服务端总量：{total} · 当前加载：{rows.length}</span>
      </Card>

      <SearchBar placeholder="搜索真实数据" value={keyword} onChange={setKeyword} />
      <div className="mobile-filter-bar"><Button size="small" onClick={load} loading={loading}>刷新</Button></div>

      <PullToRefresh onRefresh={load}>
        {filtered.length ? filtered.map((row) => {
          const entries = Object.entries(row).slice(0, 4);
          const id = displayValue(row[itemKey] ?? row.updated_at ?? JSON.stringify(row));
          return (
            <Card key={id} className="mobile-record-card" onClick={() => setDetail(row)}>
              <div className="mobile-record-heading"><strong>{id}</strong></div>
              <div className="mobile-record-fields">
                {entries.map(([key, value]) => <div key={key}><span>{key}</span><strong>{displayValue(value)}</strong></div>)}
              </div>
            </Card>
          );
        }) : <ErrorBlock status="empty" title="暂无真实业务数据" description="当前公司未返回匹配记录" />}
      </PullToRefresh>

      <Popup visible={Boolean(detail)} onMaskClick={() => setDetail(null)} position="bottom" bodyStyle={{ maxHeight: '88vh', overflowY: 'auto', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16 }}>
        {detail && <List>{Object.entries(detail).map(([key, value]) => <List.Item key={key} title={key} extra={displayValue(value)} />)}</List>}
        <Button block onClick={() => setDetail(null)}>关闭</Button>
      </Popup>
    </div>
  );
}
