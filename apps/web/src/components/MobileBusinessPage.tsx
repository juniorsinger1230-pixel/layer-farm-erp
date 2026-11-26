import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, ErrorBlock, List, Popup, PullToRefresh, SearchBar, Tag } from 'antd-mobile';
import { api } from '../api';
import { canCreatePage, getMappedContract } from '../auth/permissions';
import { useSession } from '../auth/SessionContext';
import type { PageDefinition } from '../types';
import ContractGapPage from './ContractGapPage';
import MobileSchemaForm from './MobileSchemaForm';
import { buildInitialValues, getPageFormSchema } from './form-schema';

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
  const formSchema = getPageFormSchema(page.pageId);
  const { profile } = useSession();
  const itemKey = contract?.itemKey ?? 'id';
  const [rows, setRows] = useState<BusinessRow[]>([]);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [detail, setDetail] = useState<BusinessRow | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState('');
  const canCreate = profile ? canCreatePage(profile, page.pageId) : false;

  const load = useCallback(async () => {
    if (!contract) return;
    setLoading(true);
    setPageError('');
    try {
      const result = await api<ListResponse>(`${contract.path}?page=1&pageSize=50`);
      setRows(result.items);
      setTotal(result.total);
    } catch (err) {
      setPageError(err instanceof Error ? err.message : '真实数据加载失败');
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

  const saveCreate = async (payload: Record<string, unknown>): Promise<void> => {
    if (!contract) return;
    setSubmitting(true);
    setPageError('');
    try {
      await api(contract.path, { method: 'POST', body: JSON.stringify(payload) });
      setEditorOpen(false);
      await load();
    } catch (err) {
      setPageError(err instanceof Error ? err.message : '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (!contract) return <ContractGapPage page={page} />;

  return (
    <div className="mobile-business-page" data-page-id={page.pageId} data-requirement-id={page.requirementId}>
      <Card className="mobile-page-intro">
        <div className="mobile-title-row"><Tag color="primary">{page.domain}</Tag><span>{page.domainName}</span></div>
        <h2>{page.title}</h2>
        <p>{page.requirementId}</p>
        <span>服务端总量：{total} · 当前加载：{rows.length}</span>
        {canCreate ? (
          <Button block color="primary" style={{ marginTop: 12 }} onClick={() => setEditorOpen(true)}>
            新建
          </Button>
        ) : null}
      </Card>

      <SearchBar placeholder="搜索真实数据" value={keyword} onChange={setKeyword} />
      <div className="mobile-filter-bar">
        <Button size="small" onClick={load} loading={loading}>刷新</Button>
      </div>
      {pageError ? <div style={{ color: '#ff3141', padding: '0 12px' }}>{pageError}</div> : null}

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

      <Popup
        visible={editorOpen}
        position="bottom"
        destroyOnClose
        bodyStyle={{ maxHeight: '92vh', overflowY: 'auto', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16 }}
      >
        {formSchema ? (
          <MobileSchemaForm
            schema={formSchema}
            initialValues={buildInitialValues(formSchema)}
            submitting={submitting}
            onCancel={() => setEditorOpen(false)}
            onSubmit={saveCreate}
          />
        ) : (
          <ErrorBlock status="default" title="缺少创建表单 Schema" />
        )}
      </Popup>

      <Popup visible={Boolean(detail)} onMaskClick={() => setDetail(null)} position="bottom" bodyStyle={{ maxHeight: '88vh', overflowY: 'auto', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16 }}>
        {detail && <List>{Object.entries(detail).map(([key, value]) => <List.Item key={key} title={key} extra={displayValue(value)} />)}</List>}
        <Button block onClick={() => setDetail(null)}>关闭</Button>
      </Popup>
    </div>
  );
}
