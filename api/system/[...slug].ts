import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getBaseApiFromEnv } from '../_lib/env';
import { getClientIp, getGeoFromHeaders, getClientHeaders } from '../_lib/request';

function getParts(req: VercelRequest) {
  const path = (req.url || '').split('?')[0] || '';
  const sub = path.replace(/^\/?api\/?system\/?/, '');
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

  // GET /api/system/health → /healthz
  if (parts.length === 1 && parts[0] === 'health' && req.method === 'GET') {
    try {
      const upstream = await fetch(`${base}/healthz`);
      const data = await upstream.json().catch(() => ({} as any));
      return res.status(upstream.status).json(data);
    } catch (err: any) {
      return res.status(500).json({ success: false, message: 'Erro interno', detail: String(err?.message || err) });
    }
  }

  // GET /api/system/whoami → dados do request
  if (parts.length === 1 && parts[0] === 'whoami' && req.method === 'GET') {
    const ip = getClientIp(req);
    const geo = getGeoFromHeaders(req);
    const client = getClientHeaders(req);
    const out = { ip, ua: client.ua, acceptLanguage: client.acceptLanguage, ...geo };
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(out);
  }

  // POST /api/system/telemetry → log estruturado
  if (parts.length === 1 && parts[0] === 'telemetry' && req.method === 'POST') {
    try {
      const bodyObj = typeof req.body === 'object' && req.body ? req.body : ((req as any).body ? JSON.parse((req as any).body) : {});
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
      const event = { ts: new Date().toISOString(), server, client: bodyObj || {} };
      console.log('[telemetry]', JSON.stringify(event));
      res.setHeader('Cache-Control', 'no-store');
      return res.status(204).end();
    } catch (err: any) {
      return res.status(400).json({ success: false, message: 'Bad Request', detail: String(err?.message || err) });
    }
  }

  // GET /api/system/config → base do backend
  if (parts.length === 1 && parts[0] === 'config' && req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ base });
  }

  // Fallback: proxy generico para /system/* se existir no backend
  try {
    const upstreamPath = `/${parts.join('/')}`;
    const method = req.method || 'GET';
    const headers: Record<string, string> = {};
    if (req.headers['content-type']) headers['Content-Type'] = String(req.headers['content-type']);
    const bodyNeeded = !['GET','HEAD'].includes(method.toUpperCase());
    const bodyObj = bodyNeeded ? (typeof req.body === 'object' && req.body ? req.body : ((req as any).body ? JSON.parse((req as any).body) : {})) : undefined;
    const upstream = await fetch(`${base}${upstreamPath}`, { method, headers, body: bodyNeeded ? JSON.stringify(bodyObj ?? {}) : undefined });
    return pass(upstream, res);
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Erro interno', detail: String(err?.message || err) });
  }
}

