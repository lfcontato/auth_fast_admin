import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getBaseApiFromEnv } from '../_lib/env';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = req.headers['authorization'] || req.headers['Authorization' as any];

  if (req.method === 'GET') {
    if (!auth || Array.isArray(auth)) {
      return res.status(401).json({ success: false, message: 'Authorization header ausente' });
    }
    try {
      const base = getBaseApiFromEnv();
      const q = req.query || {};
      const offRaw = Array.isArray(q.offset) ? q.offset[0] : (q.offset as string | undefined);
      const limRaw = Array.isArray(q.limit) ? q.limit[0] : (q.limit as string | undefined);
      let offset = Number.parseInt(offRaw ?? '0', 10);
      let limit = Number.parseInt(limRaw ?? '20', 10);
      if (!Number.isFinite(offset) || offset < 0) offset = 0;
      if (!Number.isFinite(limit) || limit <= 0) limit = 20;
      if (limit > 100) limit = 100;
      const url = `${base}/admin?offset=${encodeURIComponent(String(offset))}&limit=${encodeURIComponent(String(limit))}`;

      const upstream = await fetch(url, {
        method: 'GET',
        headers: { 'Authorization': auth as string },
      });
      const text = await upstream.text();
      const ct = upstream.headers.get('content-type') || '';
      res.status(upstream.status);
      if (ct.includes('application/json')) { res.setHeader('content-type', ct); return res.send(text); }
      return res.json({ success: upstream.ok, raw: text });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: 'Erro interno', detail: String(err?.message || err) });
    }
  }

  if (req.method === 'POST') {
    if (!auth || Array.isArray(auth)) {
      return res.status(401).json({ success: false, message: 'Authorization header ausente' });
    }
    try {
      const base = getBaseApiFromEnv();
      const bodyObj = typeof req.body === 'object' && req.body ? req.body : (req.body ? JSON.parse(req.body) : {});
      const upstream = await fetch(`${base}/admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': auth as string },
        body: JSON.stringify(bodyObj),
      });
      const text = await upstream.text();
      const ct = upstream.headers.get('content-type') || '';
      res.status(upstream.status);
      if (ct.includes('application/json')) { res.setHeader('content-type', ct); return res.send(text); }
      return res.json({ success: upstream.ok, raw: text });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: 'Erro interno', detail: String(err?.message || err) });
    }
  }

  return res.status(405).json({ success: false, message: 'Method Not Allowed' });
}
