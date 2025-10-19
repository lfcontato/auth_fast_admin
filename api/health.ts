import type { VercelRequest, VercelResponse } from '@vercel/node';

function getBaseApi(): string {
  const raw = process.env.END_POINT_API || 'http://localhost:8080/';
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const base = getBaseApi();
    const upstream = await fetch(`${base}/healthz`);
    const data = await upstream.json().catch(() => ({} as any));
    return res.status(upstream.status).json(data);
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Erro interno', detail: String(err?.message || err) });
  }
}

