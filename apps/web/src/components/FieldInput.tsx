import { DatePicker, Input, InputNumber, Select, Switch } from 'antd';
import type { FieldSchema } from '../types';

export function FieldInput({ field }: { field: FieldSchema }) {
  if (field.kind === 'number' || field.kind === 'currency') {
    return <InputNumber
      className="full-width"
      precision={field.precision ?? (field.kind === 'currency' ? 2 : 0)}
      min={0}
      prefix={field.kind === 'currency' ? '₱' : undefined}
      suffix={field.kind === 'number' ? field.unit : undefined}
      placeholder={`请输入${field.label}`}
    />;
  }
  if (field.kind === 'date') return <DatePicker className="full-width" />;
  if (field.kind === 'select') return <Select showSearch options={(field.options ?? []).map((value) => ({ label: value, value }))} placeholder={`请选择${field.label}`} />;
  if (field.kind === 'switch') return <Switch />;
  if (field.kind === 'textarea') return <Input.TextArea rows={3} maxLength={500} showCount />;
  return <Input maxLength={120} placeholder={`请输入${field.label}`} />;
}

export function formatFieldValue(field: FieldSchema, value: string | number | boolean | undefined): string {
  if (value === undefined || value === '') return '—';
  if (field.kind === 'switch') return value ? '启用' : '停用';
  if (field.kind === 'currency') return `₱ ${Number(value).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (field.kind === 'number') return `${Number(value).toLocaleString('en-US')}${field.unit ? ` ${field.unit}` : ''}`;
  return String(value);
}
