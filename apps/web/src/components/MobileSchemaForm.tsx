import { useMemo, useState } from 'react';
import { Button, DatePicker, Input, Picker, Selector, Switch, TextArea } from 'antd-mobile';
import type { FormFieldSchema, PageFormSchema } from './form-schema';
import { useReferenceOptions } from './reference-options';

interface MobileSchemaFormProps {
  schema: PageFormSchema;
  initialValues: Record<string, unknown>;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (values: Record<string, unknown>) => Promise<void> | void;
}

type FieldErrors = Record<string, string>;

function displayInputValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value);
  return JSON.stringify(value);
}

function pickerValue(value: unknown): (string | number)[] {
  return typeof value === 'string' || typeof value === 'number' ? [value] : [];
}

function asDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

export default function MobileSchemaForm({
  schema,
  initialValues,
  submitting,
  onCancel,
  onSubmit,
}: MobileSchemaFormProps) {
  const [values, setValues] = useState<Record<string, unknown>>({ ...initialValues });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [openPicker, setOpenPicker] = useState<string | null>(null);
  const [openDate, setOpenDate] = useState<string | null>(null);
  const { optionsByPath, loading, error: referenceError } = useReferenceOptions(schema.fields);
  const fieldByName = useMemo(() => new Map(schema.fields.map((field) => [field.name, field])), [schema.fields]);

  const updateValue = (name: string, value: unknown): void => {
    setValues((previous) => ({ ...previous, [name]: value }));
    setErrors((previous) => ({ ...previous, [name]: '' }));
  };

  const validate = (): boolean => {
    const nextErrors: FieldErrors = {};
    for (const field of schema.fields) {
      const value = values[field.name];
      if (field.required && (value === undefined || value === null || value === '')) {
        nextErrors[field.name] = `请填写${field.label}`;
      }
      if (field.control === 'number' && value !== undefined && value !== null && value !== '') {
        const numericValue = Number(value);
        if (!Number.isFinite(numericValue)) nextErrors[field.name] = '请输入合法数字';
        else if (field.type === 'integer' && !Number.isInteger(numericValue)) nextErrors[field.name] = '请输入整数';
      }
      if (field.control === 'json' && value !== undefined && value !== null && value !== '') {
        try {
          const parsed = JSON.parse(displayInputValue(value)) as unknown;
          if (field.jsonShape === 'array' && !Array.isArray(parsed)) {
            nextErrors[field.name] = '请输入 JSON 数组';
          }
        } catch { nextErrors[field.name] = '请输入合法 JSON'; }
      }
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submit = (): void => {
    if (!validate()) return;
    const payload: Record<string, unknown> = {};
    for (const field of schema.fields) {
      const value = values[field.name];
      if (value === undefined || value === null || value === '') continue;
      if (field.control === 'number') {
        payload[field.name] = field.type === 'integer' ? Number.parseInt(displayInputValue(value), 10) : Number.parseFloat(displayInputValue(value));
      } else if (field.control === 'json') {
        payload[field.name] = JSON.parse(displayInputValue(value));
      } else {
        payload[field.name] = value;
      }
    }
    void onSubmit(payload);
  };

  return (
    <div className="mobile-schema-form">
      {referenceError ? <div style={{ color: '#ff3141', marginBottom: 12 }}>{referenceError}</div> : null}
      {loading ? <div style={{ color: '#666', marginBottom: 12 }}>正在加载外键选项...</div> : null}
      {schema.fields.map((field) => (
        <div key={field.name} data-field={field.name} style={{ marginBottom: 18 }}>
          <div style={{ marginBottom: 8, fontWeight: 600 }}>
            {field.label}{field.required ? <span className="mobile-required-mark" style={{ color: '#ff3141' }}> *</span> : null}
          </div>
          {field.description ? <div style={{ color: '#888', fontSize: 12, marginBottom: 8 }}>{field.description}</div> : null}
          {renderField(field, values, updateValue, optionsByPath, setOpenPicker, setOpenDate)}
          {errors[field.name] ? <div style={{ color: '#ff3141', fontSize: 12, marginTop: 4 }}>{errors[field.name]}</div> : null}
        </div>
      ))}
      <Picker
        visible={openPicker !== null && fieldByName.get(openPicker)?.control !== 'date' && fieldByName.get(openPicker)?.control !== 'date-time'}
        title={openPicker ? fieldByName.get(openPicker)?.label : ''}
        columns={[pickerColumns(openPicker, fieldByName, optionsByPath, values)]}
        value={openPicker ? pickerValue(values[openPicker]) : []}
        onConfirm={(selected) => {
          if (openPicker) {
            updateValue(openPicker, selected[0]);
          }
          setOpenPicker(null);
        }}
        onCancel={() => setOpenPicker(null)}
        onClose={() => setOpenPicker(null)}
      />
      <DatePicker
        visible={openDate !== null}
        title={openDate ? fieldByName.get(openDate)?.label : ''}
        precision={fieldByName.get(openDate ?? '')?.control === 'date-time' ? 'second' : 'day'}
        value={openDate ? asDate(values[openDate]) : new Date()}
        onConfirm={(date) => {
          if (!openDate) return;
          const field = fieldByName.get(openDate);
          updateValue(openDate, field?.control === 'date' ? date.toISOString().slice(0, 10) : date.toISOString());
          setOpenDate(null);
        }}
        onCancel={() => setOpenDate(null)}
      />
      <div style={{ display: 'flex', gap: 12, marginTop: 20, position: 'sticky', bottom: 0, zIndex: 20, background: '#fff', padding: '12px 0 calc(12px + env(safe-area-inset-bottom))' }}>
        <Button block disabled={submitting} onClick={onCancel}>取消</Button>
        <Button block color="primary" loading={submitting} onClick={submit}>保存</Button>
      </div>
    </div>
  );
}

function renderField(
  field: FormFieldSchema,
  values: Record<string, unknown>,
  updateValue: (name: string, value: unknown) => void,
  optionsByPath: Record<string, { label: string; value: string | number }[]>,
  setOpenPicker: (value: string | null) => void,
  setOpenDate: (value: string | null) => void,
) {
  const value = values[field.name];
  if (field.control === 'switch') {
    return <Switch checked={Boolean(value)} onChange={(checked) => updateValue(field.name, checked)} />;
  }
  if (field.control === 'textarea' || field.control === 'json') {
    return <TextArea rows={field.control === 'json' ? 6 : 4} value={displayInputValue(value)} onChange={(event) => updateValue(field.name, event)} />;
  }
  if (field.control === 'number') {
    return <Input type="number" value={displayInputValue(value)} placeholder={field.placeholder} onChange={(event) => updateValue(field.name, event)} />;
  }
  if (field.control === 'date' || field.control === 'date-time') {
    return <Button block fill="outline" onClick={() => setOpenDate(field.name)}>{value ? displayInputValue(value) : '请选择日期'}</Button>;
  }
  if (field.control === 'select') {
    const options = (field.enum ?? []).map((item) => ({ label: item, value: item }));
    if (options.length <= 6) {
      return (
        <Selector
          options={options}
          value={value === undefined || value === null ? [] : [value as string | number]}
          onChange={(selected) => updateValue(field.name, selected[0])}
        />
      );
    }
    return <Button block fill="outline" onClick={() => setOpenPicker(field.name)}>{value ? displayInputValue(value) : '请选择'}</Button>;
  }
  if (field.control === 'reference' && field.reference) {
    return <Button block fill="outline" onClick={() => setOpenPicker(field.name)}>{value ? displayInputValue(value) : '请选择'}</Button>;
  }
  return <Input value={displayInputValue(value)} maxLength={field.maxLength ?? undefined} placeholder={field.placeholder} onChange={(event) => updateValue(field.name, event)} />;
}

function pickerColumns(
  openPicker: string | null,
  fieldByName: Map<string, FormFieldSchema>,
  optionsByPath: Record<string, { label: string; value: string | number }[]>,
  values: Record<string, unknown>,
): { label: string; value: string | number }[] {
  if (!openPicker) return [];
  const field = fieldByName.get(openPicker);
  if (field?.control === 'reference' && field.reference) return optionsByPath[field.reference.path] ?? [];
  if (field?.control === 'select') {
    return (field.enum ?? []).map((value) => ({ label: value, value }));
  }
  const current = values[openPicker];
  return current === undefined ? [] : [{ label: displayInputValue(current), value: current as string | number }];
}
