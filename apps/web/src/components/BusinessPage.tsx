import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Descriptions, Drawer, Dropdown, Space, Table, message } from 'antd';
import { EllipsisOutlined, PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { api } from '../api';
import { useSession } from '../auth/SessionContext';
import { canCreatePage, canUpdatePage, getMappedContract, isGapPage } from '../auth/permissions';
import { buildInitialValues, getPageFormSchema } from './form-schema';
import SchemaForm from './SchemaForm';
import StatusTag from './StatusTag';
import { formatDisplayValue, getColumnWidth, getFieldLabel } from '../presentation/presentation';
import type { PageDefinition } from '../types';

type BusinessRecord = Record<string, unknown>;
type ListResponse = { items: BusinessRecord[]; total: number };

interface BusinessPageProps {
  page: PageDefinition;
}

const preferredKeys = ['id', 'company_code', 'company', 'code', 'name', 'status', 'business_date', 'owner', 'updated_at'];

function safeScalar(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint' ? String(value) : '';
}

function recordKeys(records: BusinessRecord[]): string[] {
  const keys = new Set<string>();
  for (const record of records) {
    Object.keys(record).forEach((key) => keys.add(key));
  }
  return [...keys].sort((a, b) => {
    const ai = preferredKeys.indexOf(a);
    const bi = preferredKeys.indexOf(b);
    if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    return a.localeCompare(b);
  });
}

export default function BusinessPage({ page }: BusinessPageProps): React.ReactElement {
  const { profile } = useSession();
  const contract = getMappedContract(page.pageId);
  const formSchema = getPageFormSchema(page.pageId);
  const unavailable = isGapPage(page.pageId) || !contract;
  const [records, setRecords] = useState<BusinessRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pageNo, setPageNo] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<BusinessRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadRecords = useCallback(async () => {
    if (!contract || unavailable) return;
    setLoading(true);
    setError('');
    try {
      const query = `page=${pageNo}&pageSize=${pageSize}`;
      const response = await api<ListResponse>(`${contract.path}?${query}`);
      setRecords(response.items ?? []);
      setTotal(response.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : '数据加载失败');
    } finally {
      setLoading(false);
    }
  }, [contract, pageNo, pageSize, unavailable]);

  useEffect(() => { void loadRecords(); }, [loadRecords]);

  const keys = useMemo(() => recordKeys(records), [records]);
  const canCreate = Boolean(profile && canCreatePage(profile, page.pageId) && formSchema);
  const canEdit = Boolean(profile && canUpdatePage(profile, page.pageId) && formSchema);

  const columns: ColumnsType<BusinessRecord> = useMemo(() => keys.map((key) => ({
    title: getFieldLabel(key),
    dataIndex: key,
    key,
    width: getColumnWidth(key),
    ellipsis: true,
    render: (value: unknown) => key === 'status' || key.endsWith('_status')
      ? <StatusTag status={safeScalar(value)} />
      : formatDisplayValue(value, key),
  })), [keys]);

  columns.push({
    title: '操作',
    key: 'actions',
    fixed: 'right',
    width: 150,
    render: (_, record) => (
      <Space size={4}>
        <Button type="link" size="small" onClick={() => { setCurrentRecord(record); setDetailOpen(true); }}>查看详情</Button>
        <Dropdown
          menu={{
            items: [
              ...(canEdit ? [{ key: 'edit', label: '编辑' }] : []),
              { key: 'refresh', label: '刷新记录' },
            ],
            onClick: ({ key }) => {
              if (key === 'edit') { setCurrentRecord(record); setEditOpen(true); }
              if (key === 'refresh') void loadRecords();
            },
          }}
        >
          <Button type="link" size="small">更多操作<EllipsisOutlined /></Button>
        </Dropdown>
      </Space>
    ),
  });

  const submitCreate = async (values: Record<string, unknown>): Promise<void> => {
    if (!contract) return;
    setSubmitting(true);
    try {
      await api(contract.path, { method: 'POST', body: JSON.stringify(values) });
      message.success('保存成功');
      setCreateOpen(false);
      await loadRecords();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  const submitEdit = async (values: Record<string, unknown>): Promise<void> => {
    if (!contract || !currentRecord) return;
    const itemKey = contract.itemKey ?? 'id';
    const itemValue = currentRecord[itemKey];
    setSubmitting(true);
    try {
      await api(`${contract.path}/${encodeURIComponent(String(itemValue))}`, {
        method: 'PATCH',
        body: JSON.stringify(values),
      });
      message.success('更新成功');
      setEditOpen(false);
      await loadRecords();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '更新失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (unavailable) {
    return (
      <Card className="business-page" data-page-id={page.pageId}>
        <Alert type="info" showIcon message="功能暂未开放" description="该业务功能正在准备中，当前不展示模拟数据或临时内容。" />
      </Card>
    );
  }

  return (
    <div className="business-page" data-page-id={page.pageId}>
      <Card
        title={page.title}
        extra={canCreate ? <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>新建</Button> : null}
      >
        {error ? <Alert className="page-error" type="error" showIcon message={error} action={<Button onClick={() => void loadRecords()}>重试</Button>} /> : null}
        <Table<BusinessRecord>
          rowKey={(record) => safeScalar(record[contract?.itemKey ?? 'id']) || crypto.randomUUID()}
          columns={columns}
          dataSource={records}
          loading={loading}
          scroll={{ x: 'max-content' }}
          pagination={{
            current: pageNo,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (count) => `共 ${count} 条`,
            onChange: (nextPage, nextSize) => {
              setPageNo(nextPage);
              setPageSize(nextSize);
            },
          }}
        />
      </Card>

      <Drawer title={`新建${page.title}`} width={720} open={createOpen} onClose={() => setCreateOpen(false)} destroyOnClose>
        {formSchema ? <SchemaForm schema={formSchema} initialValues={buildInitialValues(formSchema)} submitting={submitting} onCancel={() => setCreateOpen(false)} onSubmit={(values) => void submitCreate(values)} /> : null}
      </Drawer>

      <Drawer title={`编辑${page.title}`} width={720} open={editOpen} onClose={() => setEditOpen(false)} destroyOnClose>
        {formSchema && currentRecord ? <SchemaForm schema={formSchema} initialValues={buildInitialValues(formSchema, currentRecord)} submitting={submitting} onCancel={() => setEditOpen(false)} onSubmit={(values) => void submitEdit(values)} /> : null}
      </Drawer>

      <Drawer title={`${page.title}详情`} width={720} open={detailOpen} onClose={() => setDetailOpen(false)} destroyOnClose>
        {currentRecord ? (
          <Descriptions bordered column={1} size="small">
            {keys.map((key) => (
              <Descriptions.Item key={key} label={getFieldLabel(key)}>
                {key === 'status' || key.endsWith('_status')
                  ? <StatusTag status={safeScalar(currentRecord[key])} />
                  : formatDisplayValue(currentRecord[key], key)}
              </Descriptions.Item>
            ))}
          </Descriptions>
        ) : null}
      </Drawer>
    </div>
  );
}
