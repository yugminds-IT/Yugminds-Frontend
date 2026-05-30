/**
 * API utilities - param building, etc.
 */

export function buildParams(params?: Record<string, string | number | boolean | undefined>): string {
  if (!params) return '';
  const search = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && v !== null) search.set(k, String(v));
  });
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export function withParams(path: string, params?: Record<string, string | number | boolean | undefined>): string {
  return `${path}${buildParams(params)}`;
}
