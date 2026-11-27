import { useState } from 'react';
import { Button, Card, Input, InputNumber, Space, Tag } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { api, apiPdf } from '../api';

type DesignElement = {
  id: string;
  type: 'text';
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  rotation: number;
  content: string;
  fontSizePt: number;
  bold: boolean;
  align: 'left' | 'center' | 'right';
};

type SavedDesign = { id: number };

function makeElement(index: number): DesignElement {
  return {
    id: `el-${Date.now()}-${index}`,
    type: 'text',
    xMm: 2,
    yMm: 2 + index * 12,
    widthMm: 50,
    heightMm: 10,
    rotation: 0,
    content: 'THL LABEL',
    fontSizePt: 10,
    bold: false,
    align: 'left',
  };
}

export default function PrintDesignerCard() {
  const [templateId, setTemplateId] = useState('');
  const [widthMm, setWidthMm] = useState(80);
  const [heightMm, setHeightMm] = useState(60);
  const [elements, setElements] = useState<DesignElement[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const requireTemplateId = (): number => {
    const id = Number(templateId);
    if (!Number.isSafeInteger(id) || id < 1) throw new Error('请先输入有效的打印模板编号');
    return id;
  };

  const saveAndPublish = async (): Promise<void> => {
    setError('');
    setNotice('');
    setPublishing(true);
    try {
      const id = requireTemplateId();
      const canvas = { widthMm, heightMm, elements };
      const saved = await api<SavedDesign>(`/api/v1/print/print-templates/${id}/design`, {
        method: 'POST',
        body: JSON.stringify(canvas),
      });
      await api(`/api/v1/print/print-templates/${id}/design/${saved.id}/publish`, { method: 'POST' });
      setNotice('设计已发布，可用于真实打印任务');
    } catch (err) {
      setError(err instanceof Error ? err.message : '打印设计保存或发布失败');
    } finally {
      setPublishing(false);
    }
  };

  const previewPdf = async (): Promise<void> => {
    setError('');
    setPreviewing(true);
    try {
      requireTemplateId();
      const blob = await apiPdf('/api/v1/print/design-preview', {
        format: 'pdf',
        widthMm,
        heightMm,
        elements,
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'preview.pdf';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PDF 预览失败');
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <Card className="print-designer-card" title="打印设计器" extra={<Tag color="blue">打印模板</Tag>}>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Input
          aria-label="打印模板编号"
          placeholder="打印模板编号"
          value={templateId}
          onChange={(event) => setTemplateId(event.target.value)}
        />
        <Space wrap>
          <span>纸张宽度（mm）</span>
          <InputNumber min={20} max={500} value={widthMm} onChange={(value) => setWidthMm(Number(value ?? 80))} />
          <span>纸张高度（mm）</span>
          <InputNumber min={20} max={500} value={heightMm} onChange={(value) => setHeightMm(Number(value ?? 60))} />
        </Space>
        <Space wrap>
          <Button icon={<PlusOutlined />} onClick={() => setElements((current) => [...current, makeElement(current.length)])}>
            添加元素
          </Button>
          <Button type="primary" loading={publishing} onClick={() => { void saveAndPublish(); }}>
            保存并发布
          </Button>
          <Button loading={previewing} onClick={() => { void previewPdf(); }}>
            PDF 预览
          </Button>
        </Space>
        <div className="design-canvas" style={{ width: widthMm * 2, height: heightMm * 2, border: '1px solid #d9d9d9', position: 'relative', background: '#fff' }}>
          {elements.map((element) => (
            <div
              key={element.id}
              style={{
                position: 'absolute',
                left: element.xMm * 2,
                top: element.yMm * 2,
                width: element.widthMm * 2,
                height: element.heightMm * 2,
                border: '1px dashed #2563eb',
                padding: 2,
                fontSize: element.fontSizePt,
                fontWeight: element.bold ? 700 : 400,
                textAlign: element.align,
              }}
            >
              {element.content}
            </div>
          ))}
        </div>
        {notice ? <div className="ant-alert ant-alert-success" role="status">{notice}</div> : null}
        {error ? <div className="ant-alert ant-alert-error" role="alert">{error}</div> : null}
      </Space>
    </Card>
  );
}
