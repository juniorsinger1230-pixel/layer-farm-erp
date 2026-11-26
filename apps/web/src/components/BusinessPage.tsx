import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Card, Drawer, Input, Space, Table, Tag } from 'antd';
import { DownloadOutlined, PlusOutlined, PrinterOutlined, ReloadOutlined } from '@ant-design/icons';
import { api } from '../api';
import { canApprovePage, canCreatePage, canUpdatePage, getMappedContract } from '../auth/permissions';
import { useSession } from '../auth/SessionContext';
import type { PageDefinition } from '../types';
import PrintDesignerCard from './PrintDesignerCard';
import SchemaForm from './SchemaForm';
import { buildInitialValues, getPageFormSchema } from './form-schema';

type BusinessRow = { id?: string | number; [key: string]: unknown };
type ListResponse = { items: BusinessRow[]; total: number };
type EditorRow = { id: string; key: string; value: string };
type EditorState = {
  open: boolean;
  mode: 'create' | 'edit';
  submitting: boolean;
  target?: BusinessRow;
};
type ActionState = { open: boolean; submitting: boolean; rows: EditorRow[]; target?: BusinessRow };

const createLabels: Record<string, string> = {
  'inv-001': '新建物料',
  'inv-005': '新建库位',
  'farm-003': '新建栋舍',
  'proc-003': '新建供应商',
  'proc-002': '新建采购订单',
  'proc-004': '新建收货单',
  'farm-002': '新建鸡苗批次',
  'farm-011': '新建记录',
  'sales-002': '新建价格',
  'sales-001': '新建客户',
  'sales-004': '新建信用额度',
  'sales-003': '新建销售订单',
  'print-001': '新建设计版本',
};

function blankRow(): EditorRow {
  return { id: `row-${Date.now()}-${Math.random().toString(36).slice(2)}`, key: '', value: '' };
}

function parseDynamicValue(raw: string): unknown {
  const value = raw.trim();
  if (value === '') return '';
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  if (/^-?\d+$/.test(value)) {
    const numberValue = Number(value);
    return Number.isSafeInteger(numberValue) ? numberValue : value;
  }
  if (/^-?\d+\.\d+$/.test(value)) return Number(value);
  if ((value.startsWith('{') && value.endsWith('}')) || (value.startsWith('[') && value.endsWith(']'))) {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return raw;
    }
  }
  return raw;
}

function renderValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return value.toString();
  if (typeof value === 'symbol') return value.description ?? '';
  return JSON.stringify(value);
}

function getRowItemId(record: BusinessRow, key: string): string {
  const value = record[key];
  if (typeof value === 'string' || typeof value === 'number') return value.toString();
  return '';
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function BusinessPage({ page }: { page: PageDefinition }) {
  const contract = getMappedContract(page.pageId);
  const formSchema = getPageFormSchema(page.pageId);
  const { profile } = useSession();
  const itemKey = contract?.itemKey ?? 'id';
  const [rows, setRows] = useState<BusinessRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editor, setEditor] = useState<EditorState>({ open: false, mode: 'create', submitting: false });
  const [actionDrawer, setActionDrawer] = useState<ActionState>({ open: false, submitting: false, rows: [] });
  const editorSubmitLock = useRef(false);

  const canCreate = profile ? canCreatePage(profile, page.pageId) : false;
  const canUpdate = profile ? canUpdatePage(profile, page.pageId) : false;
  const canAction = profile
    ? (canCreatePage(profile, page.pageId) || canUpdatePage(profile, page.pageId) || canApprovePage(profile, page.pageId))
    : false;

  const getRowKey = (record: BusinessRow): string => getRowItemId(record, itemKey);

  const load = useCallback(async (): Promise<void> => {
    if (!contract) return;
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({ page: String(pageNumber), pageSize: String(pageSize) });
      const response = await api<ListResponse>(`${contract.path}?${query.toString()}`);
      setRows(response.items ?? []);
      setTotal(response.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : '真实数据加载失败');
    } finally {
      setLoading(false);
    }
  }, [contract, pageNumber, pageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const filteredRows = useMemo(() => {
    const term = keyword.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => Object.values(row).some((value) => renderValue(value).toLowerCase().includes(term)));
  }, [rows, keyword]);

  const columns = useMemo(() => {
    const keys = Array.from(new Set(filteredRows.flatMap((row) => Object.keys(row)))).slice(0, 12);
    const dataColumns = keys.map((key) => ({
      title: key,
      dataIndex: key,
      key,
      ellipsis: true,
      render: (value: unknown) => renderValue(value),
    }));
    return [
      ...dataColumns,
      ...(canUpdate || canAction ? [{
        title: '操作',
        key: '__actions',
        fixed: 'right' as const,
        width: canUpdate && canAction ? 170 : 90,
        render: (_: unknown, record: BusinessRow) => (
          <Space size="small">
            {canUpdate ? (
              <Button size="small" onClick={() => openEdit(record)}>
                编辑
              </Button>
            ) : null}
            {canAction ? (
              <Button size="small" onClick={() => openAction(record)}>
                动作
              </Button>
            ) : null}
          </Space>
        ),
      }] : []),
    ];
  }, [filteredRows, canUpdate, canAction, itemKey]);

  const updateActionRow = (id: string, field: 'key' | 'value', value: string): void => {
    setActionDrawer((previous) => ({
      ...previous,
      rows: previous.rows.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    }));
  };

  const buildPayload = (editorRows: EditorRow[]): Record<string, unknown> => {
    const payload: Record<string, unknown> = {};
    for (const row of editorRows) {
      const key = row.key.trim();
      if (!key) continue;
      payload[key] = parseDynamicValue(row.value);
    }
    return payload;
  };

  const openCreate = (): void => {
    setError('');
    setEditor({ open: true, mode: 'create', submitting: false });
  };

  function openEdit(record: BusinessRow): void {
    setError('');
    setEditor({ open: true, mode: 'edit', submitting: false, target: record });
  }

  function openAction(record?: BusinessRow): void {
    const target = record ?? filteredRows[0];
    if (!target || target[itemKey] === undefined) {
      setError('请先选择要执行动作的真实记录');
      return;
    }
    setError('');
    setActionDrawer({ open: true, submitting: false, target, rows: [blankRow()] });
  }

  const saveEditor = async (payload: Record<string, unknown>): Promise<void> => {
    if (!contract || editorSubmitLock.current) return;
    editorSubmitLock.current = true;
    setEditor((previous) => ({ ...previous, submitting: true }));
    setError('');
    setNotice('');
    try {
      if (editor.mode === 'create') {
        await api(contract.path, { method: 'POST', body: JSON.stringify(payload) });
      } else {
        const id = editor.target ? getRowItemId(editor.target, itemKey) : '';
        if (!id) throw new Error('缺少记录标识');
        await api(`${contract.path}/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      }
      setNotice('已保存并通过领域校验');
      setEditor((previous) => ({ ...previous, open: false, submitting: false }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
      setEditor((previous) => ({ ...previous, submitting: false }));
    } finally {
      editorSubmitLock.current = false;
    }
  };

  const saveAction = async (): Promise<void> => {
    if (!contract) return;
    setActionDrawer((previous) => ({ ...previous, submitting: true }));
    setError('');
    setNotice('');
    try {
      const id = actionDrawer.target ? getRowItemId(actionDrawer.target, itemKey) : '';
      if (!id) throw new Error('缺少记录标识');
      const payload = buildPayload(actionDrawer.rows);
      await api(`${contract.path}/${id}/actions`, { method: 'POST', body: JSON.stringify(payload) });
      setNotice('已保存并通过领域校验');
      setActionDrawer({ open: false, submitting: false, rows: [] });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '业务动作执行失败');
      setActionDrawer((previous) => ({ ...previous, submitting: false }));
    }
  };

  const exportCsv = (): void => {
    if (!contract) return;
    const keys = Array.from(new Set(filteredRows.flatMap((row) => Object.keys(row))));
    const escapeCsv = (value: unknown): string => `"${renderValue(value).replace(/"/g, '""')}"`;
    const lines = [
      keys.map(escapeCsv).join(','),
      ...filteredRows.map((row) => keys.map((key) => escapeCsv(row[key])).join(',')),
    ];
    downloadBlob(new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' }), `${page.title}.csv`);
  };

  if (!contract) {
    return <Alert type="warning" showIcon message="该页面尚未登记真实 API 映射" />;
  }

  return (
    <div className="business-page" data-page-id={page.pageId} data-requirement-id={page.requirementId}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Space wrap>
              <Tag color="blue">{page.domainName}</Tag>
              <Tag color={page.priority === 'P0' ? 'red' : 'default'}>{page.priority}</Tag>
              <Tag>{page.requirementId}</Tag>
              <Tag color="green">真实 API</Tag>
            </Space>
            <Space wrap>
              {canCreate ? (
                <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                  {createLabels[page.pageId] ?? '新建记录'}
                </Button>
              ) : null}
              {canAction ? (
                <Button icon={<PlusOutlined />} onClick={() => openAction()} disabled={filteredRows.length === 0}>
                  执行动作
                </Button>
              ) : null}
              <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void load()}>
                刷新
              </Button>
              <Button icon={<DownloadOutlined />} onClick={() => void exportCsv()}>
                导出 CSV
              </Button>
              <Button icon={<PrinterOutlined />} onClick={() => window.print()}>
                打印
              </Button>
            </Space>
            <Input.Search
              allowClear
              placeholder="搜索当前记录"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              style={{ maxWidth: 420 }}
            />
            {notice ? <Alert type="success" showIcon message={notice} /> : null}
            {error ? <Alert type="error" showIcon message={error} /> : null}
          </Space>
        </Card>

        <Card title={page.title}>
          <Table<BusinessRow>
            rowKey={getRowKey}
            columns={columns}
            dataSource={filteredRows}
            loading={loading}
            scroll={{ x: 1200 }}
            pagination={{
              current: pageNumber,
              pageSize,
              total,
              showSizeChanger: true,
              onChange: (nextPage, nextPageSize) => {
                setPageNumber(nextPage);
                setPageSize(nextPageSize);
              },
            }}
          />
        </Card>

        {page.pageId === 'print-001' ? <PrintDesignerCard /> : null}

        <Card title="需求详情">
          <Space wrap>
            <Tag>{page.requirementId}</Tag>
            <Tag>{page.pageId}</Tag>
          </Space>
          <p style={{ marginTop: 16 }}>{page.description}</p>
        </Card>
      </Space>

      <Drawer
        open={editor.open}
        title={editor.mode === 'create' ? `新建${page.title}` : `编辑${page.title}`}
        width={720}
        closable={!editor.submitting}
        maskClosable={false}
        keyboard={!editor.submitting}
        onClose={() => {
          if (!editor.submitting) setEditor((previous) => ({ ...previous, open: false }));
        }}
      >
        {formSchema ? (
          <SchemaForm
            key={`${editor.mode}-${page.pageId}`}
            schema={formSchema}
            initialValues={buildInitialValues(formSchema, editor.mode === 'edit' ? editor.target : undefined)}
            submitting={editor.submitting}
            onCancel={() => setEditor((previous) => ({ ...previous, open: false }))}
            onSubmit={saveEditor}
          />
        ) : (
          <Alert type="error" showIcon message="缺少该页面的创建表单 Schema" />
        )}
      </Drawer>

      <Drawer
        open={actionDrawer.open}
        title="执行业务动作"
        width={560}
        closable={!actionDrawer.submitting}
        maskClosable={false}
        keyboard={!actionDrawer.submitting}
        onClose={() => {
          if (!actionDrawer.submitting) setActionDrawer((previous) => ({ ...previous, open: false }));
        }}
        extra={
          <Space>
            <Button
              disabled={actionDrawer.submitting}
              onClick={() => setActionDrawer((previous) => ({ ...previous, open: false }))}
            >
              取消
            </Button>
            <Button type="primary" loading={actionDrawer.submitting} onClick={() => void saveAction()}>
              执行
            </Button>
          </Space>
        }
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Button
            block
            icon={<PlusOutlined />}
            disabled={actionDrawer.submitting}
            onClick={() => setActionDrawer((previous) => ({ ...previous, rows: [...previous.rows, blankRow()] }))}
          >
            添加字段
          </Button>
          {actionDrawer.rows.map((row) => (
            <div className="editor-row" key={row.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8 }}>
              <Input aria-label="字段名" placeholder="字段名" value={row.key} onChange={(event) => updateActionRow(row.id, 'key', event.target.value)} />
              <Input aria-label="字段值" placeholder="字段值" value={row.value} onChange={(event) => updateActionRow(row.id, 'value', event.target.value)} />
              <Button
                danger
                onClick={() => setActionDrawer((previous) => ({ ...previous, rows: previous.rows.filter((item) => item.id !== row.id) }))}
              >
                删除
              </Button>
            </div>
          ))}
        </Space>
      </Drawer>
    </div>
  );
}
