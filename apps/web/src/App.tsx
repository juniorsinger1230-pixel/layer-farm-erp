import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, App as AntApp, Button, Card, Col, Drawer, Form, Input, InputNumber, Layout, Menu, Modal, Row, Select, Space, Statistic, Table, Tabs, Tag, Typography } from 'antd';
import { ApartmentOutlined, BarChartOutlined, DashboardOutlined, DatabaseOutlined, ExperimentOutlined, FileTextOutlined, HomeOutlined, LogoutOutlined, PlusOutlined, PrinterOutlined, ReloadOutlined, ShoppingCartOutlined, TeamOutlined, ThunderboltOutlined, WalletOutlined } from '@ant-design/icons';
import { api, apiBlob, login, logoutLocal, session, type Json } from './api.js';

type Me = { employeeNo: string; companyCode: string; roles: string[]; companyScope: string[] | '*' };
type Module = { key: string; label: string; path: string; icon: React.ReactNode };
const modules: Module[] = [
  { key: 'org', label: '组织与场区', path: '/api/v1/org/organizations', icon: <ApartmentOutlined /> },
  { key: 'flock', label: '鸡群与生产', path: '/api/v1/farm/flock-batches', icon: <ExperimentOutlined /> },
  { key: 'houses', label: '栋舍与栏位', path: '/api/v1/farm/houses-and-pens', icon: <HomeOutlined /> },
  { key: 'egg', label: '集蛋与兽药', path: '/api/v1/vet/medication-prescriptions', icon: <DatabaseOutlined /> },
  { key: 'egg-collection', label: '集蛋分级', path: '/api/v1/farm/egg-collection-grading', icon: <DatabaseOutlined /> },
  { key: 'feed', label: '饲料与配方', path: '/api/v1/farm/feeding-management', icon: <FileTextOutlined /> },
  { key: 'inventory', label: '库存与批次', path: '/api/v1/inv/stock-positions', icon: <HomeOutlined /> },
  { key: 'stock-counts', label: '盘点调整', path: '/api/v1/inv/stock-counts', icon: <HomeOutlined /> },
  { key: 'materials', label: '物料主数据', path: '/api/v1/inv/materials', icon: <DatabaseOutlined /> },
  { key: 'locations', label: '仓库与库位', path: '/api/v1/inv/stock-locations', icon: <HomeOutlined /> },
  { key: 'procurement', label: '采购与 MRP', path: '/api/v1/proc/purchase-orders', icon: <ShoppingCartOutlined /> },
  { key: 'receipts', label: '收货检验', path: '/api/v1/proc/receipt-inspections', icon: <ShoppingCartOutlined /> },
  { key: 'requisitions', label: '采购申请', path: '/api/v1/proc/purchase-requisitions', icon: <FileTextOutlined /> },
  { key: 'suppliers', label: '供应商主数据', path: '/api/v1/proc/suppliers', icon: <ShoppingCartOutlined /> },
  { key: 'sales', label: '销售与配送', path: '/api/v1/sales/sales-orders', icon: <TeamOutlined /> },
  { key: 'customers', label: '客户主数据', path: '/api/v1/sales/customers', icon: <TeamOutlined /> },
  { key: 'prices', label: '价格目录', path: '/api/v1/sales/price-lists', icon: <WalletOutlined /> },
  { key: 'credits', label: '信用额度', path: '/api/v1/sales/credit-checks', icon: <WalletOutlined /> },
  { key: 'finance', label: '财务与税务', path: '/api/v1/fin/receivables', icon: <WalletOutlined /> },
  { key: 'events', label: '事件与通知', path: '/api/v1/events/dead-letters', icon: <ThunderboltOutlined /> },
  { key: 'print', label: '打印与附件', path: '/api/v1/print/print-job', icon: <PrinterOutlined /> },
  { key: 'printers', label: '打印设备', path: '/api/v1/print/printer-paper-adaptation', icon: <PrinterOutlined /> },
  { key: 'reports', label: '经营报表', path: '/api/v1/rpt/dashboard-snapshot', icon: <BarChartOutlined /> },
];
const resourceNames: Record<string, string> = {
  organizations: '组织', 'flock-batches': '鸡苗批次', 'houses-and-pens': '栋舍', 'medication-prescriptions': '兽药处方',
  'feeding-management': '饲喂记录', materials: '物料', 'stock-locations': '库位', 'stock-counts': '盘点单',
  'purchase-requisitions': '采购申请', 'receipt-inspections': '收货单', 'purchase-orders': '采购订单',
  suppliers: '供应商', customers: '客户', 'price-lists': '价格', 'credit-checks': '信用额度',
  'sales-orders': '销售订单', 'printer-paper-adaptation': '打印设备', 'print-job': '打印任务', 'dashboard-snapshot': '经营快照',
};

type LoginValues = { account: string; password: string; companyCode: string };
type MrpValues = { materialId: number; requiredDate: string; grossRequirement: number; convert?: boolean };
type PrintValues = { templateId: number; deviceId: number; lines: string; dispatchNow?: boolean };
type LivestockValues = { saleNo: string; saleType: 'chick' | 'cull'; customerId: number; flockBatchId: number; quantity: number; unitPrice: number; unitCost?: number; saleDate: string };
type PortalValues = { purchaseOrderId: number; confirmedDeliveryDate?: string; asnNo?: string; quantity?: number; batchNo?: string; productionDate?: string; expiryDate?: string };
type DispatchValues = { taskNo: string; salesOrderId: number; vehicleId: number; routeId: number; driverNo: number; courierNo: number; cargo?: string };
type SignValues = { proofId: number };
type DiscountRequestValues = { salesOrderId: number; discountPercent: number; reason: string };
type PeriodValues = { periodCode: string; periodStart: string; periodEnd: string; note?: string };
function display(value: unknown): string { if (value === null || value === undefined || value === '') return '—'; if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value); return JSON.stringify(value); }
function Login({ onSuccess }: { onSuccess: () => void }) {
  const [loading, setLoading] = useState(false); const { message } = AntApp.useApp();
  const submit = (values: LoginValues) => { void (async () => { setLoading(true); try { await login(values); onSuccess(); } catch (e) { message.error((e as Error).message); } finally { setLoading(false); } })(); };
  return <div className="login"><Card className="login-card"><div className="login-logo"><div className="brand-mark" style={{ margin: 'auto', background: '#2563eb', color: '#fff', width: 48, height: 48 }}>禽</div><b>禽牧云 ERP</b><span className="muted">菲律宾蛋鸡养殖经营管理平台</span></div><Form layout="vertical" initialValues={{ companyCode: 'THL' }} onFinish={submit}><Form.Item name="companyCode" label="公司" rules={[{ required: true }]}><Select options={[{ value: 'THL', label: 'THL' }, { value: 'TGE', label: 'TGE' }]} /></Form.Item><Form.Item name="account" label="员工账号" rules={[{ required: true }]}><Input autoComplete="username" /></Form.Item><Form.Item name="password" label="密码" rules={[{ required: true }]}><Input.Password autoComplete="current-password" /></Form.Item><Button type="primary" htmlType="submit" block size="large" loading={loading}>安全登录</Button></Form></Card></div>;
}

function RecordEditor({ open, initial, onClose, onSave, title }: { open: boolean; initial?: Json | undefined; onClose: () => void; onSave: (data: Json) => Promise<void>; title: string }) {
  const [rows, setRows] = useState<[string, string][]>([]); const [saving, setSaving] = useState(false); const { message } = AntApp.useApp();
  useEffect(() => { setRows(Object.entries(initial ?? {}).filter(([k]) => !['id', 'created_at', 'updated_at', 'company_code', 'created_by'].includes(k)).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : v === null || v === undefined ? '' : display(v)])); }, [initial, open]);
  const save = async () => { const data: Json = {}; try { for (const [k, v] of rows) { if (!k.trim()) throw new Error('字段名不能为空'); try { data[k] = JSON.parse(v); } catch { data[k] = v; } } setSaving(true); await onSave(data); onClose(); } catch (e) { message.error((e as Error).message); } finally { setSaving(false); } };
  return <Drawer title={title} open={open} onClose={onClose} width={520} extra={<Button type="primary" loading={saving} onClick={() => { void save(); }}>保存</Button>}><Alert type="info" showIcon message="字段和值将按后端领域规则、公司范围及状态机校验。" style={{ marginBottom: 16 }} />{rows.map(([k, v], i) => <div className="editor-row" key={i}><Input value={k} placeholder="字段名" onChange={(e) => setRows(rows.map((r, n) => n === i ? [e.target.value, r[1]] : r))} /><Input value={v} placeholder="文本、数字或 JSON" onChange={(e) => setRows(rows.map((r, n) => n === i ? [r[0], e.target.value] : r))} /><Button danger type="text" onClick={() => setRows(rows.filter((_, n) => n !== i))}>×</Button></div>)}<Button block type="dashed" icon={<PlusOutlined />} onClick={() => setRows([...rows, ['', '']])}>添加字段</Button></Drawer>;
}

type EditorState = { open: boolean; row?: Json; mode: 'edit' | 'action' };

function ResourcePage({ module }: { module: Module }) {
  const [rows, setRows] = useState<Json[]>([]); const [loading, setLoading] = useState(false); const [editor, setEditor] = useState<EditorState>({ open: false, mode: 'edit' }); const [search, setSearch] = useState(''); const { message } = AntApp.useApp();
  const load = useCallback(async () => { setLoading(true); try { const data = await api<Json | Json[]>(module.path); const items = !Array.isArray(data) && Array.isArray(data.items) ? data.items : data; setRows(Array.isArray(items) ? items : [items]); } catch (e) { message.error((e as Error).message); } finally { setLoading(false); } }, [module.path, message]);
  useEffect(() => { void load(); }, [load]);
  const visible = rows.filter((r) => JSON.stringify(r).toLowerCase().includes(search.toLowerCase()));
  const columns = useMemo(() => [...new Set(rows.flatMap(Object.keys))].slice(0, 9).map((key) => ({ title: key, dataIndex: key, ellipsis: true, render: (v: unknown) => typeof v === 'object' && v !== null ? JSON.stringify(v) : display(v) })), [rows]);
  const save = async (data: Json) => { const rawId = editor.row?.id; const recordId = typeof rawId === 'string' || typeof rawId === 'number' ? String(rawId) : undefined; if (editor.mode === 'action' && recordId) await api(`${module.path}/${recordId}/actions`, { method: 'POST', body: JSON.stringify(data) }); else await api(recordId ? `${module.path}/${recordId}` : module.path, { method: recordId ? 'PATCH' : 'POST', body: JSON.stringify(data) }); message.success('已保存并通过领域校验'); await load(); };
  const title = editor.mode === 'action' ? '执行业务动作' : editor.row ? '编辑业务记录' : '新建业务记录';
  const initialValue = editor.mode === 'action' ? { action: '' } : editor.row;
  return <div className="page"><Typography.Title className="page-title">{module.label}</Typography.Title><div className="resource-toolbar"><Space><Input.Search allowClear placeholder="搜索当前记录" onSearch={setSearch} style={{ width: 280 }} /><Button icon={<ReloadOutlined />} onClick={() => { void load(); }}>刷新</Button></Space>{!['inventory', 'finance', 'reports', 'print'].includes(module.key) && <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditor({ open: true, mode: 'edit' })}>新建{resourceNames[module.path.split('/').pop() ?? ''] ?? '记录'}</Button>}</div><Card><Table rowKey={(r) => typeof r.id === 'string' || typeof r.id === 'number' ? String(r.id) : JSON.stringify(r)} loading={loading} dataSource={visible} columns={[...columns, { title: '操作', fixed: 'right', render: (_, r: Json) => <Space><Button type="link" onClick={() => setEditor({ open: true, row: r, mode: 'edit' })}>查看 / 编辑</Button><Button type="link" onClick={() => setEditor({ open: true, row: r, mode: 'action' })}>执行动作</Button></Space> }]} pagination={{ pageSize: 12, showTotal: (n) => `共 ${n} 条` }} scroll={{ x: 900 }} /></Card><RecordEditor open={editor.open} initial={initialValue} title={title} onClose={() => setEditor({ open: false, mode: 'edit' })} onSave={save} /></div>;
}

function Dashboard({ me }: { me: Me }) {
  const [data, setData] = useState<Json>({}); const [error, setError] = useState('');
  useEffect(() => { const today = new Date(); const from = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`; const to = today.toISOString().slice(0, 10); api<Json>(`/api/v1/fin/operating-dashboard?from=${from}&to=${to}`).then(setData).catch((e: unknown) => setError((e as Error).message)); }, [me.companyCode]);
  const metrics = Object.entries(data).filter(([, v]) => typeof v === 'number' || typeof v === 'string').slice(0, 4);
  return <div className="page"><Typography.Title className="page-title">经营驾驶舱</Typography.Title><p className="muted">{me.companyCode} · 实时汇总生产、销售、应收和资金数据</p>{error && <Alert type="warning" message={error} style={{ marginBottom: 16 }} />}<Row gutter={[16, 16]}>{metrics.length ? metrics.map(([k, v]) => <Col xs={24} sm={12} xl={6} key={k}><Card className="metric"><Statistic title={k} value={String(v)} /></Card></Col>) : ['鸡群存栏', '今日集蛋', '待出库订单', '应收余额'].map((x) => <Col xs={24} sm={12} xl={6} key={x}><Card className="metric"><Statistic title={x} value="—" /></Card></Col>)}</Row><Card title="业务控制提醒" style={{ marginTop: 20 }}><Space direction="vertical"><span><Tag color="blue">FEFO</Tag> 销售预占自动排除过期与停药期批次</span><span><Tag color="blue">MRP</Tag> 净需求包含安全库存、预占与在途采购</span><span><Tag color="blue">财务</Tag> 收付款核销、信用占用和总账借贷平衡联动</span></Space></Card></div>;
}

function MrpPanel() {
  const [open, setOpen] = useState(false); const { message } = AntApp.useApp();
  const run = (v: MrpValues) => { void (async () => { try { await api('/api/v1/proc/mrp-runs', { method: 'POST', body: JSON.stringify({ demands: [{ materialId: v.materialId, requiredDate: v.requiredDate, grossRequirement: v.grossRequirement }], convert: v.convert === true }) }); message.success('MRP 已计算并保存建议采购申请'); setOpen(false); } catch (e) { message.error((e as Error).message); } })(); };
  return <><Button style={{ margin: '0 24px 16px' }} type="primary" onClick={() => setOpen(true)}>运行 MRP</Button><Modal title="运行物料需求计划" open={open} onCancel={() => setOpen(false)} footer={null}><Form layout="vertical" onFinish={run}><Form.Item name="requiredDate" label="需求日期" rules={[{ required: true }]}><Input type="date" /></Form.Item><Form.Item name="materialId" label="物料 ID" rules={[{ required: true }]}><InputNumber style={{ width: '100%' }} /></Form.Item><Form.Item name="grossRequirement" label="毛需求" rules={[{ required: true }]}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item><Form.Item name="convert" label="生成采购申请"><Select options={[{ value: true, label: '是' }, { value: false, label: '仅计算' }]} /></Form.Item><Button type="primary" htmlType="submit" block>计算净需求</Button></Form></Modal></>;
}

function PrintPanel() {
  const [open, setOpen] = useState(false); const [submitting, setSubmitting] = useState(false); const { message } = AntApp.useApp();
  const submit = (v: PrintValues) => { void (async () => { setSubmitting(true); try { const result = await api<{ id: number }>('/api/v1/print/print-job/submit', { method: 'POST', body: JSON.stringify({ templateId: v.templateId, deviceId: v.deviceId, lines: v.lines.split('\n').map((line) => line.trim()).filter(Boolean) }) }); message.success(`打印任务 ${result.id} 已生成并等待适配器发送`); if (v.dispatchNow) { await api(`/api/v1/print/print-job/${result.id}/dispatch`, { method: 'POST' }); message.success('打印适配器已确认完成'); } setOpen(false); } catch (e) { message.error((e as Error).message); } finally { setSubmitting(false); } })(); };
  return <><Button style={{ margin: '0 24px 16px' }} type="primary" icon={<PrinterOutlined />} onClick={() => setOpen(true)}>提交打印</Button><Modal title="受控打印任务" open={open} onCancel={() => setOpen(false)} footer={null}><Alert type="info" showIcon message="任务完成状态以打印适配器真实返回为准；设备纸张由后端矩阵校验。" style={{ marginBottom: 16 }} /><Form layout="vertical" onFinish={submit}><Form.Item name="templateId" label="模板 ID" rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item><Form.Item name="deviceId" label="设备 ID" rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item><Form.Item name="lines" label="打印内容（每行一条）" rules={[{ required: true }]}><Input.TextArea rows={5} /></Form.Item><Form.Item name="dispatchNow" label="生成后立即发送"><Select options={[{ value: false, label: '仅生成任务' }, { value: true, label: '立即发送' }]} /></Form.Item><Button type="primary" htmlType="submit" block loading={submitting}>生成打印任务</Button></Form></Modal></>;
}

type DesignerElement = {
  id: string;
  type: 'text' | 'barcode' | 'line' | 'rectangle';
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  rotation: 0 | 90;
  content?: string;
  fontSizePt?: number;
  bold?: boolean;
  align?: 'left' | 'center' | 'right';
  value?: string;
  barcodeFormat?: 'CODE128';
  humanReadable?: boolean;
};

function PrintDesignerPanel() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [templateId, setTemplateId] = useState<number>(1);
  const [widthMm, setWidthMm] = useState(80);
  const [heightMm, setHeightMm] = useState(60);
  const [elements, setElements] = useState<DesignerElement[]>([]);
  const [elementType, setElementType] = useState<DesignerElement['type']>('text');
  const [textValue, setTextValue] = useState('EGG-001');
  const [xMm, setXMm] = useState(5);
  const [yMm, setYMm] = useState(5);
  const [dragId, setDragId] = useState<string>();
  const [saving, setSaving] = useState(false);
  const { message } = AntApp.useApp();
  const scale = 6;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#1f2937';
    ctx.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);
    for (const element of elements) {
      const x = element.xMm * scale; const y = element.yMm * scale; const w = element.widthMm * scale; const h = element.heightMm * scale;
      ctx.strokeStyle = '#2563eb'; ctx.fillStyle = '#111827';
      if (element.type === 'rectangle') { ctx.strokeStyle = '#2563eb'; ctx.strokeRect(x, y, w, h); }
      if (element.type === 'line') { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y + h); ctx.stroke(); }
      if (element.type === 'text') {
        ctx.font = `${element.bold === true ? '700' : '400'} ${(element.fontSizePt ?? 10) * 1.2}px sans-serif`;
        ctx.textAlign = element.align ?? 'left';
        const textX = element.align === 'center' ? x + w / 2 : element.align === 'right' ? x + w : x;
        ctx.fillText(element.content ?? '', textX, y + h / 2, w);
      }
      if (element.type === 'barcode') {
        ctx.strokeRect(x, y, w, h);
        let cursor = x + 2;
        for (let index = 0; index < 28; index += 1) {
          if (index % 2 === 0) { ctx.fillRect(cursor, y + 3, Math.max(1, w / 36), h - 14); }
          cursor += w / 30;
        }
        ctx.font = '8px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(element.value ?? '', x + w / 2, y + h - 3);
      }
    }
  }, [elements, heightMm, scale, widthMm]);

  useEffect(() => draw(), [draw]);

  const addElement = () => {
    const id = `el-${Date.now()}`;
    const base = { id, xMm, yMm, rotation: 0 as const };
    if (elementType === 'text') setElements((current) => [...current, { ...base, type: 'text', widthMm: 35, heightMm: 8, content: textValue, fontSizePt: 10, bold: false, align: 'left' }]);
    if (elementType === 'barcode') setElements((current) => [...current, { ...base, type: 'barcode', widthMm: 45, heightMm: 18, value: textValue, barcodeFormat: 'CODE128', humanReadable: true }]);
    if (elementType === 'line') setElements((current) => [...current, { ...base, type: 'line', widthMm: 20, heightMm: 1 }]);
    if (elementType === 'rectangle') setElements((current) => [...current, { ...base, type: 'rectangle', widthMm: 25, heightMm: 12 }]);
  };

  const onCanvasMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const clickX = (event.clientX - rect.left) / scale; const clickY = (event.clientY - rect.top) / scale;
    const hit = [...elements].reverse().find((element) => clickX >= element.xMm && clickX <= element.xMm + element.widthMm && clickY >= element.yMm && clickY <= element.yMm + element.heightMm);
    if (hit) setDragId(hit.id);
  };
  const onCanvasMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragId === undefined) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const nextX = Math.max(0, Math.min(widthMm, (event.clientX - rect.left) / scale));
    const nextY = Math.max(0, Math.min(heightMm, (event.clientY - rect.top) / scale));
    setElements((current) => current.map((element) => element.id === dragId ? { ...element, xMm: Math.max(0, Math.min(widthMm - element.widthMm, nextX)), yMm: Math.max(0, Math.min(heightMm - element.heightMm, nextY)) } : element));
  };

  const load = async () => {
    try {
      const data = await api<Json | null>(`/api/v1/print/print-templates/${templateId}/design`);
      if (data && Array.isArray(data.elements)) setElements(data.elements as DesignerElement[]);
      else message.info('该模板暂无设计版本');
    } catch (e) { message.error((e as Error).message); }
  };

  const save = async () => {
    setSaving(true);
    try {
      const saved = await api<{ id: number }>(`/api/v1/print/print-templates/${templateId}/design`, { method: 'POST', body: JSON.stringify({ widthMm, heightMm, elements }) });
      message.success(`设计版本已保存：${saved.id}`);
      await api(`/api/v1/print/print-templates/${templateId}/design/${saved.id}/publish`, { method: 'POST' });
      message.success('设计已发布，可用于真实打印任务');
    } catch (e) { message.error((e as Error).message); } finally { setSaving(false); }
  };

  const preview = async () => {
    try {
      const token = session()?.accessToken;
      const response = await fetch('/api/v1/print/design-preview', { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ widthMm, heightMm, elements, format: 'pdf' }) });
      if (!response.ok) throw new Error('预览生成失败');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = `print-template-${templateId}-preview.pdf`; anchor.click();
      URL.revokeObjectURL(url);
    } catch (e) { message.error((e as Error).message); }
  };

  return <Card title="拖拽式打印设计器（Canvas）" style={{ margin: '0 24px 20px' }} extra={<Space><Button onClick={() => { void load(); }}>载入版本</Button><Button onClick={() => { void preview(); }}>PDF 预览</Button><Button type="primary" loading={saving} onClick={() => { void save(); }}>保存并发布</Button></Space>}>
    <Alert type="info" showIcon message="WebUSB/蓝牙必须由用户在浏览器中授权真实设备；未授权前只生成受控字节，不伪称物理样张。" style={{ marginBottom: 16 }} />
    <Row gutter={16}>
      <Col xs={24} lg={14}><canvas ref={canvasRef} width={widthMm * scale} height={heightMm * scale} style={{ maxWidth: '100%', border: '1px solid #d1d5db', cursor: dragId ? 'grabbing' : 'default' }} onMouseDown={onCanvasMouseDown} onMouseMove={onCanvasMouseMove} onMouseUp={() => setDragId(undefined)} onMouseLeave={() => setDragId(undefined)} /></Col>
      <Col xs={24} lg={10}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Row gutter={8}><Col span={12}><InputNumber addonBefore="模板" min={1} value={templateId} onChange={(value) => value && setTemplateId(value)} /></Col><Col span={6}><InputNumber addonBefore="宽" min={1} value={widthMm} onChange={(value) => value && setWidthMm(value)} /></Col><Col span={6}><InputNumber addonBefore="高" min={1} value={heightMm} onChange={(value) => value && setHeightMm(value)} /></Col></Row>
          <Select value={elementType} onChange={(value: DesignerElement['type']) => setElementType(value)} options={[{ value: 'text', label: '文本' }, { value: 'barcode', label: '条码' }, { value: 'line', label: '直线' }, { value: 'rectangle', label: '矩形' }]} />
          <Input value={textValue} onChange={(event) => setTextValue(event.target.value)} placeholder="文本或条码值" />
          <Row gutter={8}><Col span={12}><InputNumber addonBefore="X" min={0} value={xMm} onChange={(value) => value !== null && setXMm(value)} /></Col><Col span={12}><InputNumber addonBefore="Y" min={0} value={yMm} onChange={(value) => value !== null && setYMm(value)} /></Col></Row>
          <Button block type="dashed" icon={<PlusOutlined />} onClick={addElement}>添加元素</Button>
          <Button block danger onClick={() => setElements((current) => current.slice(0, -1))}>删除最后元素</Button>
        </Space>
      </Col>
    </Row>
  </Card>;
}

function SupplierPortalPanel() {
  const [open, setOpen] = useState(false); const [orders, setOrders] = useState<Json[]>([]); const [loading, setLoading] = useState(false); const { message } = AntApp.useApp();
  const load = useCallback(async () => { setLoading(true); try { const result = await api<{ items: Json[] }>('/api/v1/proc/portal/purchase-orders'); setOrders(result.items); } catch (e) { message.error((e as Error).message); } finally { setLoading(false); } }, [message]);
  useEffect(() => { if (open) void load(); }, [open, load]);
  const submit = (mode: 'confirm' | 'asn', v: PortalValues) => { void (async () => { try { if (mode === 'confirm') await api(`/api/v1/proc/portal/purchase-orders/${v.purchaseOrderId}/confirm`, { method: 'POST', body: JSON.stringify({ confirmedDeliveryDate: v.confirmedDeliveryDate }) }); else await api('/api/v1/proc/portal/advance-shipping-notices', { method: 'POST', body: JSON.stringify(v) }); message.success(mode === 'confirm' ? '供应商交期已确认' : 'ASN 已提交并执行订单限量校验'); await load(); } catch (e) { message.error((e as Error).message); } })(); };
  return <><Button style={{ margin: '0 0 16px' }} onClick={() => setOpen(true)}>供应商门户</Button><Modal title="供应商订单确认与 ASN" open={open} onCancel={() => setOpen(false)} footer={null} width={860}><Alert type="info" showIcon message="账号必须绑定供应商；只能查看和操作本供应商订单。" style={{ marginBottom: 12 }} /><Table rowKey="id" loading={loading} dataSource={orders} pagination={false} columns={[{ title: '订单号', dataIndex: 'order_no' }, { title: '数量', dataIndex: 'quantity' }, { title: '确认交期', dataIndex: 'confirmed_delivery_date', render: display }, { title: 'ASN 数量', dataIndex: 'asn_quantity' }]} /><Row gutter={16} style={{ marginTop: 16 }}><Col span={12}><Card size="small" title="确认交期"><Form layout="vertical" onFinish={(v: PortalValues) => submit('confirm', v)}><Form.Item name="purchaseOrderId" label="采购订单 ID" rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item><Form.Item name="confirmedDeliveryDate" label="确认交期" rules={[{ required: true }]}><Input type="date" /></Form.Item><Button htmlType="submit" type="primary" block>确认</Button></Form></Card></Col><Col span={12}><Card size="small" title="提交 ASN"><Form layout="vertical" onFinish={(v: PortalValues) => submit('asn', v)}><Form.Item name="purchaseOrderId" label="采购订单 ID" rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item><Form.Item name="asnNo" label="ASN 编号" rules={[{ required: true }]}><Input /></Form.Item><Form.Item name="quantity" label="数量" rules={[{ required: true }]}><InputNumber min={0.01} style={{ width: '100%' }} /></Form.Item><Form.Item name="batchNo" label="批次号" rules={[{ required: true }]}><Input /></Form.Item><Space.Compact block><Form.Item name="productionDate" label="生产日期" rules={[{ required: true }]} style={{ width: '50%' }}><Input type="date" /></Form.Item><Form.Item name="expiryDate" label="有效期" rules={[{ required: true }]} style={{ width: '50%' }}><Input type="date" /></Form.Item></Space.Compact><Button htmlType="submit" type="primary" block>提交 ASN</Button></Form></Card></Col></Row></Modal></>;
}

function AsnReceiptPanel() {
  const [open, setOpen] = useState(false); const { message } = AntApp.useApp();
  const submit = (v: Json) => { void (async () => { try { await api(`/api/v1/proc/advance-shipping-notices/${String(v.asnId)}/receive`, { method: 'POST', body: JSON.stringify({ warehouseId: v.warehouseId, locationId: v.locationId, qualityStatus: v.qualityStatus }) }); message.success('ASN 收货质检、库存及应付已按原子事务处理'); setOpen(false); } catch (e) { message.error((e as Error).message); } })(); };
  return <><Button style={{ margin: '0 0 16px 12px' }} onClick={() => setOpen(true)}>仓库 ASN 收货</Button><Modal title="ASN 收货与质检" open={open} onCancel={() => setOpen(false)} footer={null}><Alert type="info" showIcon message="合格将入库并生成应付；拒收仅保留收货记录，不增加库存与应付。" style={{ marginBottom: 16 }} /><Form layout="vertical" onFinish={submit}><Row gutter={12}><Col span={12}><Form.Item name="asnId" label="ASN ID" rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col><Col span={12}><Form.Item name="warehouseId" label="仓库 ID" rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col></Row><Form.Item name="locationId" label="库位 ID" rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item><Form.Item name="qualityStatus" label="质检结论" rules={[{ required: true }]}><Select options={[{ value: 'accepted', label: '合格入库' }, { value: 'rejected', label: '拒收' }]} /></Form.Item><Button htmlType="submit" type="primary" block>执行收货</Button></Form></Modal></>;
}

function RequisitionConversionPanel() {
  const [open, setOpen] = useState(false); const [requisitions, setRequisitions] = useState<Json[]>([]); const [suppliers, setSuppliers] = useState<Json[]>([]); const [loading, setLoading] = useState(false); const [result, setResult] = useState<Json>(); const { message } = AntApp.useApp();
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const requisitionPage = await api<{ items: Json[] }>('/api/v1/proc/purchase-requisitions?page=1&pageSize=200');
      const supplierPage = await api<{ items: Json[] }>('/api/v1/proc/suppliers?page=1&pageSize=200');
      setRequisitions(requisitionPage.items.filter((item) => item.approval_status === 'approved'));
      setSuppliers(supplierPage.items);
    } catch (e) { message.error((e as Error).message); } finally { setLoading(false); }
  }, [message]);
  useEffect(() => { if (open) void load(); }, [open, load]);
  const submit = (v: Json) => { void (async () => { try { const converted = await api<Json>(`/api/v1/proc/purchase-requisitions/${String(v.requisitionId)}/actions`, { method: 'POST', body: JSON.stringify({ action: 'convert_to_purchase_order', data: { supplier_id: v.supplierId, price: v.price } }) }); setResult(converted); message.success('已批准采购申请已原子转换为采购订单'); await load(); } catch (e) { message.error((e as Error).message); } })(); };
  return <><Button style={{ margin: '0 0 16px 12px' }} onClick={() => setOpen(true)}>采购申请转订单</Button><Modal title="采购申请转采购订单" open={open} onCancel={() => setOpen(false)} footer={null} width={820}><Alert type="info" showIcon message="仅已批准申请可转换；系统校验供应商可供应物料、申请数量和重复转换。" style={{ marginBottom: 16 }} /><Table rowKey="id" loading={loading} size="small" dataSource={requisitions} pagination={{ pageSize: 5 }} columns={[{ title: '申请号', dataIndex: 'requisition_no' }, { title: '物料', dataIndex: 'material_id' }, { title: '数量', dataIndex: 'quantity' }, { title: '状态', dataIndex: 'approval_status' }]} /><Form layout="vertical" onFinish={submit} style={{ marginTop: 16 }}><Row gutter={12}><Col span={8}><Form.Item name="requisitionId" label="采购申请 ID" rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col><Col span={8}><Form.Item name="supplierId" label="供应商 ID" rules={[{ required: true }]}><Select options={suppliers.map((item) => ({ value: Number(item.id), label: display(item.supplier_name) }))} /></Form.Item></Col><Col span={8}><Form.Item name="price" label="采购单价" rules={[{ required: true }]}><InputNumber min={0.01} precision={2} style={{ width: '100%' }} /></Form.Item></Col></Row><Button type="primary" htmlType="submit" block>转换并关闭采购申请</Button></Form>{result && <Card size="small" title="转换结果" style={{ marginTop: 16 }}><Space><Tag color="green">{display((result.purchaseOrder as Json)?.order_no)}</Tag><span>采购申请状态：{display((result.requisition as Json)?.approval_status)}</span></Space></Card>}</Modal></>;
}

function PurchaseOrderApprovalPanel() {
  const [open, setOpen] = useState(false); const [orders, setOrders] = useState<Json[]>([]); const [loading, setLoading] = useState(false); const [savingId, setSavingId] = useState<number>(); const { message } = AntApp.useApp();
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const page = await api<{ items: Json[] }>('/api/v1/proc/purchase-orders?page=1&pageSize=200');
      setOrders(page.items);
    } catch (e) { message.error((e as Error).message); } finally { setLoading(false); }
  }, [message]);
  useEffect(() => { if (open) void load(); }, [open, load]);
  const act = (record: Json, action: 'approve' | 'open') => { void (async () => {
    const id = Number(record.id);
    setSavingId(id);
    try {
      await api(`/api/v1/proc/purchase-orders/${String(id)}/actions`, { method: 'POST', body: JSON.stringify({ action }) });
      message.success(action === 'approve' ? '采购订单已批准' : '采购订单已开放执行');
      await load();
    } catch (e) { message.error((e as Error).message); } finally { setSavingId(undefined); }
  })(); };
  return <><Button style={{ margin: '0 0 16px 12px' }} onClick={() => setOpen(true)}>采购订单审批</Button><Modal title="采购订单审批与开放执行" open={open} onCancel={() => setOpen(false)} footer={null} width={900}>
    <Alert type="info" showIcon message="草稿订单先审批，再开放执行；供应商只有在订单 approved/open 后才能确认交期并提交 ASN。" style={{ marginBottom: 16 }} />
    <Table rowKey="id" loading={loading} size="small" dataSource={orders} locale={{ emptyText: '暂无采购订单' }} pagination={{ pageSize: 6 }} columns={[
      { title: '订单号', dataIndex: 'order_no' }, { title: '数量', dataIndex: 'quantity' }, { title: '单价', dataIndex: 'price' },
      { title: '状态', dataIndex: 'execution_close', render: (value: unknown) => <Tag color={value === 'draft' ? 'default' : value === 'approved' ? 'blue' : 'green'}>{display(value)}</Tag> },
      { title: '操作', render: (_, record) => <Space><Button size="small" type="primary" disabled={record.execution_close !== 'draft' || savingId === Number(record.id)} loading={savingId === Number(record.id)} onClick={() => act(record, 'approve')}>批准</Button><Button size="small" disabled={record.execution_close !== 'approved' || savingId === Number(record.id)} onClick={() => act(record, 'open')}>开放执行</Button></Space> },
    ]} />
  </Modal></>;
}

function FeedIssuePanel() {
  const [open, setOpen] = useState(false); const { message } = AntApp.useApp();
  const submit = (v: Json) => { void (async () => { try { const result = await api<Json>(`/api/v1/farm/feeding-management/${String(v.recordId)}/issue`, { method: 'POST', body: JSON.stringify({ warehouseId: v.warehouseId, locationId: v.locationId, incurredOn: v.incurredOn }) }); message.success(`FEFO 饲喂出库完成，归集成本 PHP ${display(result.costAmount)}`); setOpen(false); } catch (e) { message.error((e as Error).message); } })(); };
  return <><Button style={{ margin: '0 24px 16px' }} type="primary" onClick={() => setOpen(true)}>执行饲喂出库</Button><Modal title="FEFO 饲喂出库与成本归集" open={open} onCancel={() => setOpen(false)} footer={null}><Alert type="info" showIcon message="按有效期优先扣减可用库存，排除销售预占，并按实际批次成本自动归集到鸡群。" style={{ marginBottom: 16 }} /><Form layout="vertical" onFinish={submit}><Form.Item name="recordId" label="饲喂记录 ID" rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item><Row gutter={12}><Col span={12}><Form.Item name="warehouseId" label="仓库 ID" rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col><Col span={12}><Form.Item name="locationId" label="库位 ID" rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col></Row><Form.Item name="incurredOn" label="出库与成本日期" rules={[{ required: true }]}><Input type="date" /></Form.Item><Button htmlType="submit" type="primary" block>扣减库存并归集成本</Button></Form></Modal></>;
}


function FlockCostPanel() {
  const [open, setOpen] = useState(false); const [cost, setCost] = useState<Json>(); const [form] = Form.useForm<Json>(); const { message } = AntApp.useApp();
  const snapshot = cost?.snapshot as Json | undefined;
  const submit = (v: Json) => { void (async () => { try { const result = await api<Json>(`/api/v1/farm/flock-batches/${String(v.batchId)}/cost-postings`, { method: 'POST', body: JSON.stringify({ batchId: v.batchId, costType: v.costType, amount: v.amount, incurredOn: v.incurredOn, sourceType: v.sourceType, sourceId: v.sourceId }) }); setCost(result); message.success('鸡群成本已归集并刷新剩余单位成本'); } catch (e) { message.error((e as Error).message); } })(); };
  const query = (v: Json) => { void (async () => { try { setCost(await api<Json>(`/api/v1/farm/flock-batches/${String(v.batchId)}/cost`)); } catch (e) { message.error((e as Error).message); } })(); };
  return <><Button style={{ margin: '0 24px 16px' }} type="primary" onClick={() => setOpen(true)}>鸡群成本归集</Button><Modal title="鸡群成本与销售成本快照" open={open} onCancel={() => setOpen(false)} footer={null} width={760}><Form form={form} layout="vertical" onFinish={submit}><Row gutter={12}><Col span={12}><Form.Item name="batchId" label="鸡群批次 ID" rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col><Col span={12}><Form.Item name="costType" label="成本类型" rules={[{ required: true }]}><Select options={['chick', 'feed', 'vaccine', 'medication', 'labor', 'utility', 'other'].map((value) => ({ value, label: value }))} /></Form.Item></Col></Row><Row gutter={12}><Col span={12}><Form.Item name="amount" label="成本金额（PHP）" rules={[{ required: true }]}><InputNumber min={0.01} style={{ width: '100%' }} /></Form.Item></Col><Col span={12}><Form.Item name="incurredOn" label="发生日期" rules={[{ required: true }]}><Input type="date" /></Form.Item></Col></Row><Row gutter={12}><Col span={12}><Form.Item name="sourceType" label="来源类型"><Input /></Form.Item></Col><Col span={12}><Form.Item name="sourceId" label="来源单据 ID"><Input /></Form.Item></Col></Row><Space><Button htmlType="submit" type="primary">归集成本</Button><Button onClick={() => { const batchId: unknown = form.getFieldValue('batchId'); if (typeof batchId === 'number') query({ batchId }); else message.warning('请输入鸡群批次 ID'); }}>查询成本</Button></Space></Form>{cost && <Card size="small" title="剩余成本快照" style={{ marginTop: 16 }}><Row gutter={16}><Col span={8}><Statistic title="剩余成本" value={display(snapshot?.accumulated_cost)} /></Col><Col span={8}><Statistic title="剩余存栏" value={display(snapshot?.remaining_flock)} /></Col><Col span={8}><Statistic title="单位成本" value={display(snapshot?.unit_cost)} /></Col></Row></Card>}</Modal></>;
}
function LivestockSalePanel() {
  const [open, setOpen] = useState(false); const [profit, setProfit] = useState<Json>(); const { message } = AntApp.useApp();
  const submit = (v: LivestockValues) => { void (async () => { try { const sale = await api<{ sales_order_id: number }>('/api/v1/sales/livestock-sales', { method: 'POST', body: JSON.stringify(v) }); const result = await api<Json>(`/api/v1/fin/sales-orders/${sale.sales_order_id}/profit`); setProfit(result); message.success('销售已扣减存栏、生成应收并完成批次成本快照'); setOpen(false); } catch (e) { message.error((e as Error).message); } })(); };
  return <><Button style={{ margin: '0 24px 16px' }} type="primary" onClick={() => setOpen(true)}>禽苗 / 淘汰鸡销售</Button><Modal title="禽苗与淘汰鸡销售" open={open} onCancel={() => setOpen(false)} footer={null}><Form layout="vertical" onFinish={submit}><Form.Item name="saleNo" label="销售单号" rules={[{ required: true }]}><Input /></Form.Item><Form.Item name="saleType" label="销售类型" rules={[{ required: true }]}><Select options={[{ value: 'chick', label: '禽苗' }, { value: 'cull', label: '淘汰鸡' }]} /></Form.Item><Row gutter={12}><Col span={12}><Form.Item name="customerId" label="客户 ID" rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col><Col span={12}><Form.Item name="flockBatchId" label="鸡群批次 ID" rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col></Row><Form.Item name="quantity" label="销售数量（羽）" rules={[{ required: true }]}><InputNumber min={1} precision={0} style={{ width: '100%' }} /></Form.Item><Row gutter={12}><Col span={12}><Form.Item name="unitPrice" label="销售单价" rules={[{ required: true }]}><InputNumber min={0.01} style={{ width: '100%' }} /></Form.Item></Col><Col span={12}><Form.Item name="unitCost" label="批次单位成本（留空自动读取成本快照）"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col></Row><Form.Item name="saleDate" label="销售日期" rules={[{ required: true }]}><Input type="date" /></Form.Item><Button htmlType="submit" type="primary" block>执行销售</Button></Form></Modal><Modal title="批次毛利（PHP）" open={profit !== undefined} onCancel={() => setProfit(undefined)} footer={<Button onClick={() => setProfit(undefined)}>关闭</Button>}>{profit && <Row gutter={16}><Col span={12}><Statistic title="净收入" value={display(profit.netRevenue)} /></Col><Col span={12}><Statistic title="销售成本" value={display(profit.cogs)} /></Col><Col span={12}><Statistic title="毛利" value={display(profit.grossProfit)} /></Col><Col span={12}><Statistic title="毛利率" value={display(profit.marginRate)} /></Col></Row>}</Modal></>;
}

function DeliveryMobilePanel() {
  const [open, setOpen] = useState(false);
  const [tasks, setTasks] = useState<Json[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signTask, setSignTask] = useState<Json>();
  const { message } = AntApp.useApp();
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api<{ items: Json[] }>('/api/v1/sales/delivery-tasks');
      setTasks(result.items);
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [message]);
  useEffect(() => { if (open) void load(); }, [open, load]);
  const submitDispatch = (values: DispatchValues) => {
    void (async () => {
      setSaving(true);
      try {
        await api('/api/v1/sales/delivery-tasks/dispatch', { method: 'POST', body: JSON.stringify(values) });
        message.success('配送任务已派发并生成 assigned 状态');
        await load();
      } catch (e) {
        message.error((e as Error).message);
      } finally {
        setSaving(false);
      }
    })();
  };
  const sendEvent = (task: Json, status: string, body: Json = {}) => {
    void (async () => {
      setSaving(true);
      try {
        await api(`/api/v1/sales/delivery-tasks/${String(task.id)}/events`, { method: 'POST', body: JSON.stringify({ status, ...body }) });
        message.success(`配送状态已更新为 ${status}`);
        await load();
      } catch (e) {
        message.error((e as Error).message);
      } finally {
        setSaving(false);
      }
    })();
  };
  const submitSign = (values: SignValues) => {
    const task = signTask;
    if (task === undefined) return;
    sendEvent(task, 'signed', { proof: { attachmentId: values.proofId } });
    setSignTask(undefined);
  };
  const tagColor = (status: unknown) => status === 'signed' ? 'green' : status === 'failed' || status === 'cancelled' ? 'red' : 'blue';
  return <>
    <Button style={{ margin: '0 24px 16px' }} onClick={() => setOpen(true)}>移动端配送工作台</Button>
    <Drawer title="配送任务工作台" open={open} onClose={() => setOpen(false)} width={420} loading={loading}>
      <Alert type="info" showIcon message="适配手机卡片流；配送动作由后端状态机、凭证和公司范围校验。" style={{ marginBottom: 12 }} />
      <Card size="small" title="派发配送任务" style={{ marginBottom: 12 }}>
        <Form layout="vertical" onFinish={submitDispatch}>
          <Form.Item name="taskNo" label="任务编号" rules={[{ required: true }]}><Input /></Form.Item>
          <Row gutter={8}>
            <Col span={12}><Form.Item name="salesOrderId" label="销售订单 ID" rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={12}><Form.Item name="cargo" label="货物摘要"><Input /></Form.Item></Col>
          </Row>
          <Row gutter={8}>
            <Col span={12}><Form.Item name="vehicleId" label="车辆 ID" rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={12}><Form.Item name="routeId" label="路线 ID" rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>
          </Row>
          <Row gutter={8}>
            <Col span={12}><Form.Item name="driverNo" label="司机 ID" rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={12}><Form.Item name="courierNo" label="配送员 ID" rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>
          </Row>
          <Button type="primary" htmlType="submit" block loading={saving}>派发任务</Button>
        </Form>
      </Card>
      {tasks.length === 0 && <Alert type="info" message="暂无配送任务" />}
      {tasks.map((task) => <Card key={String(task.id)} size="small" style={{ marginBottom: 10 }} title={<Space><span>{display(task.task_no)}</span><Tag color={tagColor(task.latest_status)}>{display(task.latest_status)}</Tag></Space>}>
        <div className="muted">订单：{display(task.order_no)} · 客户：{display(task.customer_name)}</div>
        <Space wrap style={{ marginTop: 10 }}>
          {task.latest_status === 'assigned' && <Button size="small" onClick={() => sendEvent(task, 'departed')} loading={saving}>出发</Button>}
          {task.latest_status === 'departed' && <Button size="small" onClick={() => sendEvent(task, 'arrived')} loading={saving}>到达</Button>}
          {task.latest_status === 'arrived' && <Button size="small" type="primary" onClick={() => setSignTask(task)} loading={saving}>确认签收</Button>}
          {['assigned', 'departed', 'arrived'].includes(String(task.latest_status)) && <Button size="small" danger onClick={() => sendEvent(task, 'failed')}>异常失败</Button>}
        </Space>
      </Card>)}
    </Drawer>
    <Modal title="提交签收凭证" open={signTask !== undefined} onCancel={() => setSignTask(undefined)} footer={null}>
      <Form layout="vertical" onFinish={submitSign}>
        <Form.Item name="proofId" label="签收附件 ID" rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
        <Button type="primary" htmlType="submit" block>提交签收</Button>
      </Form>
    </Modal>
  </>;
}

function DiscountApprovalPanel() {
  const [open, setOpen] = useState(false);
  const [records, setRecords] = useState<Json[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { message } = AntApp.useApp();
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api<{ items: Json[] }>('/api/v1/sales/discount-approvals');
      setRecords(result.items);
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [message]);
  useEffect(() => { if (open) void load(); }, [open, load]);
  const requestDiscount = (values: DiscountRequestValues) => {
    void (async () => {
      setSaving(true);
      try {
        await api(`/api/v1/sales/sales-orders/${values.salesOrderId}/discount`, { method: 'POST', body: JSON.stringify({ discountPercent: values.discountPercent, reason: values.reason }) });
        message.success('折扣申请已提交；不超过 5% 将自动批准');
        await load();
      } catch (e) {
        message.error((e as Error).message);
      } finally {
        setSaving(false);
      }
    })();
  };
  const review = (record: Json, action: 'approve' | 'reject') => {
    void (async () => {
      setSaving(true);
      try {
        await api(`/api/v1/sales/discount-approvals/${String(record.id)}/actions`, { method: 'POST', body: JSON.stringify({ action, note: action === 'approve' ? '审批通过' : '审批驳回' }) });
        message.success(action === 'approve' ? '折扣已批准并回写订单价格' : '折扣已驳回，订单保持原价');
        await load();
      } catch (e) {
        message.error((e as Error).message);
      } finally {
        setSaving(false);
      }
    })();
  };
  const tagColor = (status: unknown) => status === 'approved' ? 'green' : status === 'rejected' ? 'red' : 'orange';
  return <>
    <Button style={{ margin: '0 24px 16px' }} onClick={() => setOpen(true)}>折扣申请与审批</Button>
    <Modal title="销售折扣申请与审批" open={open} onCancel={() => setOpen(false)} footer={null} width={900}>
      <Alert type="info" showIcon message="折扣上限 25%；待审批折扣会阻断库存预占，批准后预占、信用占用和应收均按净额计算。" style={{ marginBottom: 16 }} />
      <Card size="small" title="提交折扣申请" style={{ marginBottom: 16 }}>
        <Form layout="vertical" onFinish={requestDiscount}>
          <Row gutter={12}>
            <Col span={8}><Form.Item name="salesOrderId" label="销售订单 ID" rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="discountPercent" label="折扣比例（%）" rules={[{ required: true }]}><InputNumber min={0.01} max={25} precision={2} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="reason" label="申请原因" rules={[{ required: true }]}><Input /></Form.Item></Col>
          </Row>
          <Button type="primary" htmlType="submit" block loading={saving}>提交申请</Button>
        </Form>
      </Card>
      <Table rowKey="id" size="small" loading={loading} dataSource={records} pagination={{ pageSize: 6 }} locale={{ emptyText: '暂无折扣审批记录' }} columns={[
        { title: '订单 ID', dataIndex: 'sales_order_id' },
        { title: '折扣率', dataIndex: 'discount_percent', render: (value) => `${display(value)}%` },
        { title: '原因', dataIndex: 'reason', ellipsis: true },
        { title: '状态', dataIndex: 'status', render: (value) => <Tag color={tagColor(value)}>{display(value)}</Tag> },
        { title: '操作', render: (_, record) => record.status === 'pending' ? <Space><Button size="small" type="primary" loading={saving} onClick={() => review(record, 'approve')}>批准</Button><Button size="small" danger loading={saving} onClick={() => review(record, 'reject')}>驳回</Button></Space> : <span className="muted">已处理</span> },
      ]} />
    </Modal>
  </>;
}

function CustomerStatementPanel() {
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState<number>();
  const [statement, setStatement] = useState<Json>();
  const [loading, setLoading] = useState(false);
  const { message } = AntApp.useApp();
  const load = async () => {
    if (customerId === undefined) { message.warning('请输入客户 ID'); return; }
    setLoading(true);
    try {
      setStatement(await api(`/api/v1/sales/customers/${customerId}/statement`));
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  const receivables = statement && Array.isArray(statement.receivables) ? statement.receivables : [];
  return <>
    <Button style={{ margin: '0 24px 16px' }} onClick={() => setOpen(true)}>客户对账单</Button>
    <Modal title="客户对账单" open={open} onCancel={() => setOpen(false)} width={760} footer={null}>
      <Space style={{ marginBottom: 12 }}><InputNumber min={1} placeholder="客户 ID" onChange={(value) => setCustomerId(value === null ? undefined : Number(value))} /><Button type="primary" onClick={() => void load()} loading={loading}>查询</Button></Space>
      {statement && <Row gutter={16} style={{ marginBottom: 12 }}>
        <Col span={8}><Statistic title="信用额度" value={display((statement.credit as Json)?.credit_amount)} /></Col>
        <Col span={8}><Statistic title="已占用额度" value={display((statement.credit as Json)?.occupied_amount)} /></Col>
        <Col span={8}><Statistic title="应收余额" value={display(statement.balance)} /></Col>
      </Row>}
      <Table rowKey="id" size="small" loading={loading} dataSource={receivables} pagination={false} columns={[
        { title: '订单 ID', dataIndex: 'order_id' }, { title: '账期', dataIndex: 'payment_term' },
        { title: '余额', dataIndex: 'receivable_balance' }, { title: '已签收', dataIndex: 'signed' }, { title: '逾期', dataIndex: 'overdue' },
      ]} />
    </Modal>
  </>;
}

function EventNotificationPanel({ companyCode }: { companyCode?: string | undefined }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('未连接');
  const [events, setEvents] = useState<Json[]>([]);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!open) return;
    const token = session()?.accessToken;
    if (!token) { setStatus('缺少登录令牌'); return; }
    const scheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${scheme}//${window.location.host}/api/v1/events/ws?token=${encodeURIComponent(token)}`);
    socketRef.current = socket;
    setStatus('连接中');
    socket.onopen = () => {
      setStatus('已连接');
      socket.send(JSON.stringify({ type: 'subscribe', channel: `company:${companyCode ?? ''}` }));
    };
    socket.onmessage = (message) => {
      if (typeof message.data !== 'string') return;
      const payload = JSON.parse(message.data) as Json;
      if (payload.type === 'ready' || payload.type === 'subscribed' || payload.type === 'pong') setStatus('已连接');
      if (payload.type === 'event') {
        const event = payload.event as Json;
        setEvents((current) => [{ sequence: payload.sequence, eventType: event.eventType, aggregateType: event.aggregateType, aggregateId: event.aggregateId, occurredAt: event.occurredAt, payload: event.payload }, ...current].slice(0, 50));
      }
      if (payload.type === 'error') setStatus('服务返回错误');
    };
    socket.onerror = () => setStatus('连接异常');
    socket.onclose = () => { setStatus('已断开'); socketRef.current = null; };
    return () => { socket.close(); socketRef.current = null; };
  }, [open]);

  const send = (message: Json) => { const socket = socketRef.current; if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message)); };
  const tagColor = status === '已连接' ? 'green' : status === '连接中' ? 'blue' : 'red';
  return <>
    <Button style={{ margin: '0 24px 16px' }} type="primary" icon={<ThunderboltOutlined />} onClick={() => setOpen(true)}>实时事件通知</Button>
    <Drawer title="队列事件与 WebSocket 通知" open={open} onClose={() => setOpen(false)} width={520}>
      <Alert type="info" showIcon message="业务单据写入 Outbox 后，经 Valkey/BullMQ 与幂等消费者投递；重放只返回本公司事件。" style={{ marginBottom: 12 }} />
      <Space style={{ marginBottom: 12 }} wrap>
        <Tag color={tagColor}>{status}</Tag>
        <Button size="small" onClick={() => send({ type: 'replay', afterSequence: 0 })}>重放事件</Button>
        <Button size="small" onClick={() => send({ type: 'ping' })}>心跳检测</Button>
        <Button size="small" onClick={() => setEvents([])}>清空</Button>
      </Space>
      {events.length === 0 ? <Alert type="info" message="暂无实时事件，可提交业务单据或点击重放事件" /> : events.map((event, index) => <Card key={`${String(event.sequence)}-${index}`} size="small" style={{ marginBottom: 10 }}>
        <Space wrap><Tag color="blue">{display(event.eventType)}</Tag><span className="muted">#{display(event.sequence)}</span></Space>
        <div className="muted" style={{ marginTop: 6 }}>{display(event.aggregateType)} · {display(event.aggregateId)} · {display(event.occurredAt)}</div>
        <Typography.Paragraph code style={{ marginTop: 8, marginBottom: 0 }}>{display(event.payload)}</Typography.Paragraph>
      </Card>)}
    </Drawer>
  </>;
}

function FinanceClosePanel() {
  const today = new Date().toISOString().slice(0, 10);
  const [open, setOpen] = useState(false);
  const [asOf, setAsOf] = useState(today);
  const [periods, setPeriods] = useState<Json[]>([]);
  const [ar, setAr] = useState<Json>();
  const [ap, setAp] = useState<Json>();
  const [trial, setTrial] = useState<Json>();
  const [statements, setStatements] = useState<Json>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { message } = AntApp.useApp();

  const refreshPeriods = useCallback(async () => {
    setLoading(true);
    try { setPeriods(await api<Json[]>('/api/v1/fin/periods')); }
    catch (e) { message.error((e as Error).message); }
    finally { setLoading(false); }
  }, [message]);

  useEffect(() => { if (open) void refreshPeriods(); }, [open, refreshPeriods]);

  const openPeriod = (values: PeriodValues) => { void (async () => {
    setSaving(true);
    try { await api('/api/v1/fin/periods', { method: 'POST', body: JSON.stringify(values) }); message.success('会计期间已开放'); await refreshPeriods(); }
    catch (e) { message.error((e as Error).message); }
    finally { setSaving(false); }
  })(); };

  const changePeriod = (record: Json, action: 'close' | 'reopen') => { void (async () => {
    setSaving(true);
    try {
      await api(`/api/v1/fin/periods/${String(record.id)}/${action}`, { method: 'POST', body: JSON.stringify({ note: action === 'close' ? 'Period close' : 'Period reopened' }) });
      message.success(action === 'close' ? '期间已关闭并生成余额快照' : '期间已重新开放');
      await refreshPeriods();
    } catch (e) { message.error((e as Error).message); }
    finally { setSaving(false); }
  })(); };

  const loadAging = () => { void (async () => {
    setLoading(true);
    try {
      setAr(await api(`/api/v1/fin/ar-aging?asOf=${asOf}`));
      setAp(await api(`/api/v1/fin/ap-aging?asOf=${asOf}`));
    } catch (e) { message.error((e as Error).message); }
    finally { setLoading(false); }
  })(); };

  const loadLedger = () => { void (async () => {
    setLoading(true);
    try {
      setTrial(await api(`/api/v1/fin/trial-balance?from=2000-01-01&to=${asOf}`));
      setStatements(await api(`/api/v1/fin/financial-statements?asOf=${asOf}`));
    } catch (e) { message.error((e as Error).message); }
    finally { setLoading(false); }
  })(); };

  const download = (path: string, filename: string) => { void (async () => {
    try {
      const blob = await apiBlob(path);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = filename; link.click();
      URL.revokeObjectURL(url);
    } catch (e) { message.error((e as Error).message); }
  })(); };

  const periodColumns = [
    { title: '期间', dataIndex: 'period_code' }, { title: '开始', dataIndex: 'period_start' }, { title: '结束', dataIndex: 'period_end' },
    { title: '状态', dataIndex: 'status', render: (value: unknown) => <Tag color={value === 'closed' ? 'red' : value === 'closing' ? 'orange' : 'green'}>{display(value)}</Tag> },
    { title: '操作', render: (_: unknown, record: Json) => record.status === 'open'
      ? <Button size="small" danger loading={saving} onClick={() => changePeriod(record, 'close')}>关闭期间</Button>
      : record.status === 'closed' ? <Button size="small" loading={saving} onClick={() => changePeriod(record, 'reopen')}>重新开放</Button> : <span className="muted">处理中</span> },
  ];
  const arRows = ar && Array.isArray(ar.rows) ? ar.rows : [];
  const apRows = ap && Array.isArray(ap.rows) ? ap.rows : [];
  const trialRows = trial && Array.isArray(trial.lines) ? trial.lines : [];
  const statementAccounts = statements && Array.isArray(statements.accounts) ? statements.accounts : [];
  const income = statements?.incomeStatement as Json | undefined;
  const balance = statements?.balanceSheet as Json | undefined;

  return <>
    <Button style={{ margin: '0 24px 16px' }} type="primary" onClick={() => setOpen(true)}>期间关账与财务报表</Button>
    <Modal title="期间关账、账龄、总账与 BIR 报表" open={open} onCancel={() => setOpen(false)} footer={null} width={1080}>
      <Alert type="info" showIcon message="关闭期间会冻结记账并生成科目余额快照；报表金额由已过账分录实时复算。" style={{ marginBottom: 16 }} />
      <Space style={{ marginBottom: 16 }}><Input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} /><Button onClick={loadAging} loading={loading}>查询账龄</Button><Button type="primary" onClick={loadLedger} loading={loading}>查询总账报表</Button></Space>
      <Tabs items={[
        { key: 'period', label: '期间关账', children: <>
          <Card size="small" title="开放会计期间" style={{ marginBottom: 16 }}>
            <Form layout="inline" onFinish={openPeriod}>
              <Form.Item name="periodCode" rules={[{ required: true }]}><Input placeholder="如 2026-11" /></Form.Item>
              <Form.Item name="periodStart" rules={[{ required: true }]}><Input type="date" /></Form.Item>
              <Form.Item name="periodEnd" rules={[{ required: true }]}><Input type="date" /></Form.Item>
              <Button type="primary" htmlType="submit" loading={saving}>开放</Button>
            </Form>
          </Card>
          <Table rowKey="id" size="small" loading={loading} dataSource={periods} columns={periodColumns} pagination={false} locale={{ emptyText: '暂无期间' }} />
        </> },
        { key: 'aging', label: '应收/应付账龄', children: <Row gutter={16}>
          <Col span={12}><Card title="应收账龄" size="small"><Table rowKey="id" size="small" loading={loading} dataSource={arRows} pagination={false} columns={[{ title: '订单', dataIndex: 'order_no' }, { title: '客户', dataIndex: 'customer_name' }, { title: '到期日', dataIndex: 'due_date' }, { title: '余额', dataIndex: 'receivable_balance' }, { title: '账龄', dataIndex: 'aging_bucket' }]} /></Card></Col>
          <Col span={12}><Card title="应付账龄" size="small"><Table rowKey="id" size="small" loading={loading} dataSource={apRows} pagination={false} columns={[{ title: '供应商', dataIndex: 'supplier_name' }, { title: '到期日', dataIndex: 'due_date' }, { title: '余额', dataIndex: 'payable_balance' }, { title: '账龄', dataIndex: 'aging_bucket' }]} /></Card></Col>
        </Row> },
        { key: 'ledger', label: '总账与报表', children: <>
          {statements && <Row gutter={16} style={{ marginBottom: 16 }}>
            {Object.entries(income ?? {}).map(([key, value]) => <Col span={8} key={key}><Card><Statistic title={key} value={display(value)} /></Card></Col>)}
            {Object.entries(balance ?? {}).map(([key, value]) => <Col span={8} key={key}><Card><Statistic title={key} value={display(value)} /></Card></Col>)}
          </Row>}
          <Table rowKey="accountCode" size="small" loading={loading} dataSource={statementAccounts} pagination={{ pageSize: 8 }} columns={[{ title: '科目', dataIndex: 'accountCode' }, { title: '类别', dataIndex: 'kind' }, { title: '借方', dataIndex: 'debit' }, { title: '贷方', dataIndex: 'credit' }, { title: '余额', dataIndex: 'balance' }]} />
          <Table rowKey="account_code" size="small" dataSource={trialRows} style={{ marginTop: 12 }} pagination={{ pageSize: 8 }} columns={[{ title: '科目', dataIndex: 'account_code' }, { title: '类别', dataIndex: 'kind' }, { title: '借方', dataIndex: 'debit' }, { title: '贷方', dataIndex: 'credit' }, { title: '余额', dataIndex: 'balance' }]} />
        </> },
        { key: 'export', label: '多语言导出', children: <Space wrap>
          <Button onClick={() => download(`/api/v1/fin/aging-export?type=ar&asOf=${asOf}&locale=zh-CN`, 'ar-aging-zh.csv')}>应收账龄中文 CSV</Button>
          <Button onClick={() => download(`/api/v1/fin/aging-export?type=ap&asOf=${asOf}&locale=en-US`, 'ap-aging-en.csv')}>应付账龄英文 CSV</Button>
          <Button onClick={() => download(`/api/v1/fin/tax-report-export?from=2026-01-01&to=${asOf}&birForm=2550Q&locale=zh-CN`, 'bir-2550q-zh.csv')}>BIR 2550Q 中文</Button>
          <Button onClick={() => download(`/api/v1/fin/financial-statements-export?asOf=${asOf}&locale=en-US`, 'financial-statements-en.csv')}>财务报表英文 CSV</Button>
        </Space> },
      ]} />
    </Modal>
  </>;
}

export default function App() {
  const [authenticated, setAuthenticated] = useState(!!session()); const [me, setMe] = useState<Me>(); const [active, setActive] = useState('dashboard'); const { message } = AntApp.useApp();
  useEffect(() => { if (authenticated) api<Me>('/api/v1/auth/me').then(setMe).catch((e: unknown) => message.error((e as Error).message)); }, [authenticated, message]);
  if (!authenticated) return <AntApp><Login onSuccess={() => setAuthenticated(true)} /></AntApp>;
  const current = modules.find((m) => m.key === active);
  return <AntApp><Layout style={{ minHeight: '100vh' }}><Layout.Sider breakpoint="lg" collapsedWidth="0" width={228} style={{ background: '#17233c' }}><div className="brand"><span className="brand-mark">禽</span>禽牧云 ERP</div><Menu theme="dark" style={{ background: 'transparent' }} selectedKeys={[active]} onClick={(e) => setActive(e.key)} items={[{ key: 'dashboard', icon: <DashboardOutlined />, label: '经营驾驶舱' }, ...modules.map((m) => ({ key: m.key, icon: m.icon, label: m.label }))]} /></Layout.Sider><Layout><header className="app-header"><div><b>{current?.label ?? '经营驾驶舱'}</b><div className="muted desktop-only">数据按公司与岗位范围隔离</div></div><Space><Tag color="blue">{me?.companyCode ?? '加载中'}</Tag><span className="desktop-only">{me?.employeeNo} · {me?.roles.join(' / ')}</span><Button type="text" icon={<LogoutOutlined />} onClick={() => { void api('/api/v1/auth/logout', { method: 'POST' }).finally(() => { logoutLocal(); setAuthenticated(false); }); }}>退出</Button></Space></header>{active === 'dashboard' && me ? <Dashboard me={me} /> : current ? <>{current.key === 'procurement' && <><MrpPanel /><SupplierPortalPanel /><AsnReceiptPanel /><RequisitionConversionPanel /><PurchaseOrderApprovalPanel /></>}{current.key === 'flock' && <FlockCostPanel />}{current.key === 'feed' && <FeedIssuePanel />}{current.key === 'sales' && <><LivestockSalePanel /><DeliveryMobilePanel /><DiscountApprovalPanel /><CustomerStatementPanel /></>}{current.key === 'finance' && <FinanceClosePanel />}{current.key === 'events' && <EventNotificationPanel companyCode={me?.companyCode} />}{current.key === 'print' && <><PrintDesignerPanel /><PrintPanel /></>}{current.key !== 'events' && <ResourcePage key={current.path} module={current} />}</> : null}</Layout></Layout></AntApp>;
}
