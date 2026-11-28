import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Drawer, Space, Tag, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { api } from '../api';
import { useSession } from '../auth/SessionContext';
import { canCreatePage, canUpdatePage, getMappedContract, isGapPage } from '../auth/permissions';
import { buildInitialValues, getPageFormSchema } from './form-schema';
import MobileSchemaForm from './MobileSchemaForm';
import StatusTag from './StatusTag';
import PrintDesignerCard from './PrintDesignerCard';
import { formatDisplayValue, getFieldLabel } from '../presentation/presentation';
import type { PageDefinition } from '../types';

type BusinessRecord = Record<string, unknown>;
type ListResponse = { items: BusinessRecord[]; total: number };

function safeScalar(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint' ? String(value) : '';
}

function primaryTitle(record: BusinessRecord): string {
  const key = ['name', 'code', 'no', 'id'].find((item) => Object.keys(record).some((keyName) => keyName.endsWith(`_${item}`) || keyName === item));
  if (!key) return '业务记录';
  const fieldName = Object.keys(record).find((keyName) => keyName.endsWith(`_${key}`) || keyName === key);
  return fieldName ? formatDisplayValue(record[fieldName]) : '业务记录';
}

export default function MobileBusinessPage({ page }: { page: PageDefinition }): React.ReactElement {
  const { profile } = useSession();
  const contract = getMappedContract(page.pageId);
  const formSchema = getPageFormSchema(page.pageId);
  const unavailable = isGapPage(page.pageId) || !contract;
  const [records, setRecords] = useState<BusinessRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
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
      const response = await api<ListResponse>(`${contract.path}?page=1&pageSize=20`);
      setRecords(response.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '数据加载失败');
    } finally {
      setLoading(false);
    }
  }, [contract, unavailable]);

  useEffect(() => { void loadRecords(); }, [loadRecords]);

  const canCreate = Boolean(profile && canCreatePage(profile, page.pageId) && formSchema);
  const canEdit = Boolean(profile && canUpdatePage(profile, page.pageId) && formSchema);
  const currentKeys = useMemo(() => currentRecord ? Object.keys(currentRecord) : [], [currentRecord]);

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
    setSubmitting(true);
    try {
      await api(`${contract.path}/${encodeURIComponent(String(currentRecord[itemKey]))}`, {
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
    return <Alert type="info" showIcon message="功能暂未开放" description="该业务功能正在准备中，当前不展示业务数据或临时内容。" />;
  }

  return (
    <div className="mobile-business-page" data-page-id={page.pageId}>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 12 }}>
        <strong>{page.title}</strong>
        {canCreate ? <Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>新建</Button> : null}
      </Space>

      {error ? <Alert type="error" showIcon message={error} action={<Button size="small" onClick={() => void loadRecords()}>重试</Button>} /> : null}
      {page.pageId === 'print-001' ? <PrintDesignerCard /> : null}
      {loading ? <Tag>正在加载...</Tag> : null}

      <Space direction="vertical" style={{ width: '100%' }}>
        {records.map((record, index) => {
          const status = record.status ?? record.voucher_status ?? record.quality_status;
          const summaryKeys = Object.keys(record).filter((key) => !['id', 'status'].includes(key)).slice(0, 3);
          return (
            <Card key={safeScalar(record.id) || String(index)} size="small" hoverable onClick={() => { setCurrentRecord(record); setDetailOpen(true); }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <strong>{primaryTitle(record)}</strong>
                  {status ? <StatusTag status={safeScalar(status)} /> : null}
                </Space>
                {summaryKeys.map((key) => (
                  <div key={key} className="mobile-record-line">
                    <span>{getFieldLabel(key)}</span><strong>{formatDisplayValue(record[key], key)}</strong>
                  </div>
                ))}
                {canEdit ? (
                  <Button size="small" onClick={(event) => { event.stopPropagation(); setCurrentRecord(record); setEditOpen(true); }}>编辑</Button>
                ) : null}
              </Space>
            </Card>
          );
        })}
      </Space>

      <Drawer title={`新建${page.title}`} width="100%" open={createOpen} onClose={() => setCreateOpen(false)} destroyOnClose>
        {formSchema ? <MobileSchemaForm schema={formSchema} initialValues={buildInitialValues(formSchema)} submitting={submitting} onCancel={() => setCreateOpen(false)} onSubmit={(values) => void submitCreate(values)} /> : null}
      </Drawer>

      <Drawer title={`编辑${page.title}`} width="100%" open={editOpen} onClose={() => setEditOpen(false)} destroyOnClose>
        {formSchema && currentRecord ? <MobileSchemaForm schema={formSchema} initialValues={buildInitialValues(formSchema, currentRecord)} submitting={submitting} onCancel={() => setEditOpen(false)} onSubmit={(values) => void submitEdit(values)} /> : null}
      </Drawer>

      <Drawer title={`${page.title}详情`} width="100%" open={detailOpen} onClose={() => setDetailOpen(false)} destroyOnClose>
        {currentRecord ? (
          <Space direction="vertical" style={{ width: '100%' }}>
            {currentKeys.map((key) => (
              <div key={key} className="mobile-detail-row">
                <span>{getFieldLabel(key)}</span>
                <strong>{key === 'status' || key.endsWith('_status') ? <StatusTag status={String(currentRecord[key])} /> : formatDisplayValue(currentRecord[key], key)}</strong>
              </div>
            ))}
          </Space>
        ) : null}
      </Drawer>
    </div>
  );
}
