import rawFormSchemas from '../generated/form-schemas.json';

export type FormControl =
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'reference'
  | 'switch'
  | 'date'
  | 'date-time'
  | 'json';

export interface ReferenceMeta {
  table: string;
  path: string;
  valueField: string;
  labelFields: string[];
}

export interface FormFieldSchema {
  name: string;
  label: string;
  type: string;
  format: string | null;
  control: FormControl;
  required: boolean;
  nullable: boolean;
  description: string;
  default: unknown;
  enum: string[] | null;
  min: number | null;
  max: number | null;
  minLength: number | null;
  maxLength: number | null;
  precision: number | null;
  scale: number | null;
  placeholder: string;
  jsonShape?: 'array' | 'object';
  reference?: ReferenceMeta;
}

export interface PageFormSchema {
  path: string;
  table: string;
  companyField: string | null;
  hiddenFields: string[];
  fields: FormFieldSchema[];
}

export interface FormSchemaFile {
  version: number;
  generatedAt: string;
  summary: {
    pageCount: number;
    totalVisibleFields: number;
    referenceFieldCount: number;
  };
  pages: Record<string, PageFormSchema>;
}

export const formSchemaFile = rawFormSchemas as FormSchemaFile;

export function getPageFormSchema(pageId: string): PageFormSchema | undefined {
  return formSchemaFile.pages[pageId];
}

export function buildInitialValues(schema: PageFormSchema, record?: Record<string, unknown>): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const field of schema.fields) {
    const sourceValue = record?.[field.name];
    if (sourceValue !== undefined) {
      values[field.name] = sourceValue;
    } else if (field.default !== null) {
      values[field.name] = field.default;
    } else if (field.control === 'switch') {
      values[field.name] = false;
    }
  }
  return values;
}
