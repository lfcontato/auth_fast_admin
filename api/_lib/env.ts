export function getBaseApiFromEnv(): string {
  const raw = process.env.END_POINT_API;
  let v = typeof raw === 'string' && raw ? raw : 'http://localhost:8080/';
  v = v.trim();
  if (v.length >= 2) {
    const first = v[0];
    const last = v[v.length - 1];
    if ((first === '"' && last === '"') || (first === '\'' && last === '\'')) v = v.slice(1, -1);
  }
  if (v.endsWith('/')) v = v.slice(0, -1);
  try { new URL(v); } catch { v = 'http://localhost:8080'; }
  return v;
}

