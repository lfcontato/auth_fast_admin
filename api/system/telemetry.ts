import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getClientIp, getClientHeaders } from '../_lib/request';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  try {
    const bodyObj = typeof req.body === 'object' && req.body ? req.body : (req.body ? JSON.parse(req.body) : {});

    const ip = getClientIp(req);
    const client = getClientHeaders(req);

    const server = {
      ip,
      ...client,
      country: (req.headers['x-vercel-ip-country'] as string) || '',
      region: (req.headers['x-vercel-ip-country-region'] as string) || '',
      city: (req.headers['x-vercel-ip-city'] as string) || '',
      timezone: (req.headers['x-vercel-ip-timezone'] as string) || '',
      method: req.method,
      path: req.url || '',
    };

    const event = {
      ts: new Date().toISOString(),
      server,
      client: bodyObj || {},
    };

    console.log('[telemetry]', JSON.stringify(event));
    res.setHeader('Cache-Control', 'no-store');
    return res.status(204).end();
  } catch (err: any) {
    return res.status(400).json({ success: false, message: 'Bad Request', detail: String(err?.message || err) });
  }
}
