import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getBaseApiFromEnv } from './_shared';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const base = getBaseApiFromEnv();
    const upstream = await fetch(`${base}/healthz`);
    const data = await upstream.json().catch(() => ({} as any));
    return res.status(upstream.status).json(data);
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Erro interno', detail: String(err?.message || err) });
  }
}

