const SENSITIVE_KEY = /(?:pass(?:word)?|secret|token|authorization|cookie|credential|api[-_]?key|connection(?:string)?)/i;

export function redactText(value: string): string {
  return value
    .replace(/(?:postgres(?:ql)?|redis|valkey):\/\/[^\s]+/gi, '[REDACTED_CONNECTION]')
    .replace(/(authorization\s*[:=]\s*)(?:bearer\s+)?[^\s,;]+/gi, '$1[REDACTED]')
    .replace(/((?:password|secret|token|api[-_]?key)\s*[:=]\s*)[^\s,;]+/gi, '$1[REDACTED]');
}

export function redactLogValue(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[TRUNCATED]';
  if (typeof value === 'string') return redactText(value);
  if (Array.isArray(value)) return value.map((item) => redactLogValue(item, depth + 1));
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        SENSITIVE_KEY.test(key) ? '[REDACTED]' : redactLogValue(child, depth + 1),
      ]),
    );
  }
  return value;
}
