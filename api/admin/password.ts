import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getBaseApiFromEnv } from '../_shared';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PATCH') return res.status(405).json({ success: false, message: 'Method Not Allowed' });

  const auth = req.headers['authorization'] || req.headers['Authorization' as any];
  if (!auth || Array.isArray(auth)) {
    return res.status(401).json({ success: false, message: 'Authorization header ausente' });
  }

  try {
    const base = getBaseApiFromEnv();
    const bodyObj = typeof req.body === 'object' && req.body ? req.body : (req.body ? JSON.parse(req.body) : {});
    const upstream = await fetch(`${base}/admin/password`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': auth as string },
      body: JSON.stringify(bodyObj ?? {}),
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

