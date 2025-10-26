import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getBaseApiFromEnv } from './_lib/env';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const base = getBaseApiFromEnv();
    const upstream = await fetch(`${base}/openapi.json`);
    const text = await upstream.text();
    const ct = upstream.headers.get('content-type') || 'application/json; charset=utf-8';
    res.status(upstream.status);
    res.setHeader('content-type', ct);
    return res.send(text);
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Erro interno', detail: String(err?.message || err) });
  }
}

