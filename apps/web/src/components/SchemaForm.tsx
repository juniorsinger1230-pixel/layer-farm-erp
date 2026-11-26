import dayjs from 'dayjs';
import { Button, DatePicker, Form, Input, InputNumber, Select, Space, Switch } from 'antd';
import type { FormFieldSchema, PageFormSchema } from './form-schema';
import { useReferenceOptions } from './reference-options';

function displayInputValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value);
  return JSON.stringify(value);
}

interface SchemaFormProps {
  schema: PageFormSchema;
  initialValues: Record<string, unknown>;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (values: Record<string, unknown>) => Promise<void> | void;
}

function fieldRules(field: FormFieldSchema) {
  const rules: NonNullable<NonNullable<Parameters<typeof Form.Item>[0]>['rules']> = [];
  if (field.required) rules.push({ required: true, message: `请填写${field.label}` });
  if (field.minLength !== null) rules.push({ min: field.minLength, message: `最少 ${field.minLength} 个字符` });
  if (field.maxLength !== null) rules.push({ max: field.maxLength, message: `最多 ${field.maxLength} 个字符` });
  if (field.control === 'json') {
    rules.push({
      validator: (_rule, value: unknown) => {
        if (value === undefined || value === null || value === '') return Promise.resolve();
        try {
          const parsed = JSON.parse(displayInputValue(value)) as unknown;
          if (field.jsonShape === 'array' && !Array.isArray(parsed)) {
            return Promise.reject(new Error('请输入 JSON 数组'));
          }
          return Promise.resolve();
        } catch {
          return Promise.reject(new Error('请输入合法 JSON'));
        }
      },
    });
  }
  return rules;
}

export default function SchemaForm({ schema, initialValues, submitting, onCancel, onSubmit }: SchemaFormProps) {
  const [form] = Form.useForm();
  const { optionsByPath, loading, error } = useReferenceOptions(schema.fields);

  const transformValues = (values: Record<string, unknown>): Record<string, unknown> => {
    const result: Record<string, unknown> = {};
    for (const field of schema.fields) {
      const value = values[field.name];
      if (value === undefined || value === null || value === '') continue;
      if (dayjs.isDayjs(value)) {
        result[field.name] = field.control === 'date' ? value.format('YYYY-MM-DD') : value.toISOString();
      } else if (field.control === 'json') {
        result[field.name] = JSON.parse(displayInputValue(value));
      } else if (field.type === 'integer' || field.type === 'number') {
        result[field.name] = Number(value);
      } else {
        result[field.name] = value;
      }
    }
    return result;
  };

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={initialValues}
      disabled={submitting}
      onFinish={(values: Record<string, unknown>) => void onSubmit(transformValues(values))}
    >
      {error ? <div className="ant-form-item-explain-error" style={{ marginBottom: 16 }}>{error}</div> : null}
      {schema.fields.map((field) => (
        <Form.Item
          key={field.name}
          name={field.name}
          label={field.label}
          tooltip={field.description || undefined}
          valuePropName={field.control === 'switch' ? 'checked' : 'value'}
          rules={fieldRules(field)}
        >
          {renderControl(field, optionsByPath, loading)}
        </Form.Item>
      ))}
      <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
        <Button onClick={onCancel} disabled={submitting}>取消</Button>
        <Button type="primary" htmlType="submit" loading={submitting}>保存</Button>
      </Space>
    </Form>
  );
}

function renderControl(
  field: FormFieldSchema,
  optionsByPath: Record<string, { label: string; value: string | number }[]>,
  referenceLoading: boolean,
) {
  if (field.control === 'switch') return <Switch />;
  if (field.control === 'textarea') {
    return <Input.TextArea rows={4} maxLength={field.maxLength ?? undefined} showCount placeholder={field.placeholder} />;
  }
  if (field.control === 'json') return <Input.TextArea rows={6} placeholder='例如：{"key":"value"}' />;
  if (field.control === 'number') {
    const numberProps: Parameters<typeof InputNumber>[0] = {
      style: { width: '100%' },
      step: field.scale === null ? 1 : 1 / (10 ** field.scale),
      placeholder: field.placeholder,
    };
    if (field.min !== null) numberProps.min = field.min;
    if (field.max !== null) numberProps.max = field.max;
    if (field.type === 'integer') {
      numberProps.precision = 0;
    } else if (field.scale !== null) {
      numberProps.precision = field.scale;
    }
    return <InputNumber {...numberProps} />;
  }
  if (field.control === 'select') {
    return (
      <Select
        allowClear={!field.required}
        placeholder={`请选择${field.label}`}
        options={(field.enum ?? []).map((value) => ({ label: value, value }))}
      />
    );
  }
  if (field.control === 'reference' && field.reference) {
    return (
      <Select
        showSearch
        allowClear={!field.required}
        loading={referenceLoading}
        placeholder={`请选择${field.label}`}
        optionFilterProp="label"
        options={optionsByPath[field.reference.path] ?? []}
      />
    );
  }
  if (field.control === 'date' || field.control === 'date-time') {
    return (
      <DatePicker
        style={{ width: '100%' }}
        showTime={field.control === 'date-time' ? { format: 'HH:mm:ss' } : false}
        format={field.control === 'date' ? 'YYYY-MM-DD' : 'YYYY-MM-DD HH:mm:ss'}
      />
    );
  }
  return <Input maxLength={field.maxLength ?? undefined} placeholder={field.placeholder} />;
}
