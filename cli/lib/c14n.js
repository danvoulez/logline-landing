export function c14nDeep(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(v => c14nDeep(v)).join(',')}]`;
  if (value instanceof Date) return `"${value.toISOString()}"`;
  const keys = Object.keys(value).sort();
  const entries = keys.map(k => `"${k}":${c14nDeep(value[k])}`);
  return `{${entries.join(',')}}`;
}