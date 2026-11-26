import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import type { FormFieldSchema, ReferenceMeta } from './form-schema';

export interface ReferenceOption {
  label: string;
  value: string | number;
}

type ListResponse = { items: Record<string, unknown>[]; total: number };
const referenceCache = new Map<string, Promise<ReferenceOption[]>>();

function isScalar(value: unknown): value is string | number {
  return typeof value === 'string' || typeof value === 'number';
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function pickLabel(record: Record<string, unknown>, reference: ReferenceMeta): string {
  for (const fieldName of reference.labelFields) {
    const value = record[fieldName];
    if (isScalar(value) && value !== '') return String(value);
  }
  const fallback = record[reference.valueField];
  return displayValue(fallback);
}

function loadReferenceOptions(reference: ReferenceMeta): Promise<ReferenceOption[]> {
  const cached = referenceCache.get(reference.path);
  if (cached) return cached;
  const request = api<ListResponse>(`${reference.path}?page=1&pageSize=200`).then((response) => {
    const options: ReferenceOption[] = [];
    const seen = new Set<string | number>();
    for (const record of response.items ?? []) {
      const value = record[reference.valueField];
      if (!isScalar(value) || seen.has(value)) continue;
      seen.add(value);
      options.push({ label: pickLabel(record, reference), value });
    }
    return options;
  });
  referenceCache.set(reference.path, request);
  request.catch(() => referenceCache.delete(reference.path));
  return request;
}

export function useReferenceOptions(fields: FormFieldSchema[]): {
  optionsByPath: Record<string, ReferenceOption[]>;
  loading: boolean;
  error: string;
} {
  const references = useMemo(() => {
    const unique = new Map<string, ReferenceMeta>();
    for (const field of fields) {
      if (field.reference) unique.set(field.reference.path, field.reference);
    }
    return [...unique.values()];
  }, [fields]);
  const [optionsByPath, setOptionsByPath] = useState<Record<string, ReferenceOption[]>>({});
  const [loading, setLoading] = useState(references.length > 0);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (references.length === 0) {
      setLoading(false);
      setOptionsByPath({});
      return () => { cancelled = true; };
    }
    setLoading(true);
    Promise.all(references.map(async (reference) => [reference.path, await loadReferenceOptions(reference)] as const))
      .then((entries) => {
        if (cancelled) return;
        setOptionsByPath(Object.fromEntries(entries));
        setError('');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : '外键选项加载失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [references]);

  return { optionsByPath, loading, error };
}
