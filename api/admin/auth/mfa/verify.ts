import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getBaseApiFromEnv } from '../../../_shared';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  try {
    const base = getBaseApiFromEnv();
    const bodyObj = typeof req.body === 'object' && req.body ? req.body : (req.body ? JSON.parse(req.body) : {});
    const upstream = await fetch(`${base}/admin/auth/mfa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

