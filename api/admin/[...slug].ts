import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getBaseApiFromEnv } from '../_lib/env';

function getParts(req: VercelRequest) {
  const path = (req.url || '').split('?')[0] || '';
  const sub = path.replace(/^\/?api\/?admin\/?/, '');
  const parts = sub.split('/').filter(Boolean);
  return parts;
}

async function pass(upstream: Response, res: VercelResponse) {
  const text = await upstream.text();
  const ct = upstream.headers.get('content-type') || '';
  res.status(upstream.status);
  if (ct.includes('application/json')) { res.setHeader('content-type', ct); return res.send(text); }
  return res.json({ success: upstream.ok, raw: text });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const base = getBaseApiFromEnv();
  const parts = getParts(req);
  const auth = req.headers['authorization'] || (req.headers as any)['Authorization'];

  // GET/POST /api/admin → lista/cria
  if (parts.length === 0) {
    if (req.method === 'GET') {
      if (!auth || Array.isArray(auth)) return res.status(401).json({ success: false, message: 'Authorization header ausente' });
      try {
        const q = req.query || {} as any;
        const offRaw = Array.isArray(q.offset) ? q.offset[0] : (q.offset as string | undefined);
        const limRaw = Array.isArray(q.limit) ? q.limit[0] : (q.limit as string | undefined);
        let offset = Number.parseInt(offRaw ?? '0', 10);
        let limit = Number.parseInt(limRaw ?? '20', 10);
        if (!Number.isFinite(offset) || offset < 0) offset = 0;
        if (!Number.isFinite(limit) || limit <= 0) limit = 20;
        if (limit > 100) limit = 100;
        const url = `${base}/admin?offset=${encodeURIComponent(String(offset))}&limit=${encodeURIComponent(String(limit))}`;
        const upstream = await fetch(url, { method: 'GET', headers: { 'Authorization': auth as string } });
        return pass(upstream, res);
      } catch (err: any) {
        return res.status(500).json({ success: false, message: 'Erro interno', detail: String(err?.message || err) });
      }
    }
    if (req.method === 'POST') {
      if (!auth || Array.isArray(auth)) return res.status(401).json({ success: false, message: 'Authorization header ausente' });
      try {
        const bodyObj = typeof req.body === 'object' && req.body ? req.body : ((req as any).body ? JSON.parse((req as any).body) : {});
        const upstream = await fetch(`${base}/admin`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': auth as string }, body: JSON.stringify(bodyObj ?? {}) });
        return pass(upstream, res);
      } catch (err: any) {
        return res.status(500).json({ success: false, message: 'Erro interno', detail: String(err?.message || err) });
      }
    }
  }

  // GET local helper: /api/admin/code-verified/{hash} → monta URL
  if (parts.length === 2 && parts[0] === 'code-verified' && req.method === 'GET') {
    const hash = parts[1] || '';
    if (!hash || !/^[A-Fa-f0-9]{64}$/.test(hash)) return res.status(400).json({ success: false, message: 'hash inválido' });
    const url = `${base}/admin/code-verified/${hash}`;
    return res.status(200).json({ success: true, url });
  }

  // Demais rotas de admin → proxy genérico (Authorization obrigatório quando presente)
  try {
    const upstreamPath = `/admin/${parts.join('/')}`;
    const method = req.method || 'GET';
    const headers: Record<string, string> = {};
    if (auth && !Array.isArray(auth)) headers['Authorization'] = auth as string;
    if (req.headers['content-type']) headers['Content-Type'] = String(req.headers['content-type']);
    const bodyNeeded = !['GET','HEAD'].includes(method.toUpperCase());
    const bodyObj = bodyNeeded ? (typeof req.body === 'object' && req.body ? req.body : ((req as any).body ? JSON.parse((req as any).body) : {})) : undefined;
    const upstream = await fetch(`${base}${upstreamPath}`, { method, headers, body: bodyNeeded ? JSON.stringify(bodyObj ?? {}) : undefined });
    return pass(upstream, res);
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Erro interno', detail: String(err?.message || err) });
  }
}

