import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getBaseApiFromEnv } from '../_lib/env';
import { cookieAttrs, parseCookies, clearCookieAttrs } from '../_lib/cookies';

function getParts(req: VercelRequest) {
  const path = (req.url || '').split('?')[0] || '';
  const sub = path.replace(/^\/?api\/?auth\/?/, '');
  const parts = sub.split('/').filter(Boolean);
  return parts;
}

async function passJson(upstream: Response, res: VercelResponse) {
  const text = await upstream.text();
  const ct = upstream.headers.get('content-type') || '';
  res.status(upstream.status);
  if (ct.includes('application/json')) { res.setHeader('content-type', ct); return res.send(text); }
  return res.json({ success: upstream.ok, raw: text });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const parts = getParts(req);
  const base = getBaseApiFromEnv();

  // POST /api/auth/login → /admin/auth/token (gera cookie refresh)
  if (parts.length === 1 && parts[0] === 'login' && req.method === 'POST') {
    try {
      const { username, password } = typeof req.body === 'object' && req.body ? req.body : JSON.parse((req as any).body || '{}');
      if (!username || !password) return res.status(400).json({ success: false, message: 'username e password são obrigatórios' });
      const upstream = await fetch(`${base}/admin/auth/token`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
      const data: any = await upstream.json().catch(() => ({}));
      if (upstream.status === 202) return res.status(202).json(data);
      if (!upstream.ok) return res.status(upstream.status).json(data);
      const { access_token, refresh_token } = data || {};
      if (!access_token || !refresh_token) return res.status(502).json({ success: false, message: 'Resposta inválida do servidor de autenticação' });
      res.setHeader('Set-Cookie', `refresh_token=${encodeURIComponent(refresh_token)}; ${cookieAttrs()}`);
      return res.status(200).json({ success: true, access_token });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: 'Erro interno', detail: String(err?.message || err) });
    }
  }

  // POST /api/auth/refresh → /admin/auth/token/refresh (usa cookie refresh)
  if (parts.length === 1 && parts[0] === 'refresh' && req.method === 'POST') {
    try {
      const cookies = parseCookies(req.headers.cookie);
      const refresh = cookies['refresh_token'];
      if (!refresh) return res.status(401).json({ success: false, message: 'Sem refresh_token' });
      const upstream = await fetch(`${base}/admin/auth/token/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: refresh }) });
      const data: any = await upstream.json().catch(() => ({}));
      if (!upstream.ok) {
        res.setHeader('Set-Cookie', `refresh_token=; ${clearCookieAttrs()}`);
        return res.status(upstream.status).json(data);
      }
      const { access_token, refresh_token } = data || {};
      if (!access_token || !refresh_token) return res.status(502).json({ success: false, message: 'Resposta inválida do servidor de autenticação' });
      res.setHeader('Set-Cookie', `refresh_token=${encodeURIComponent(refresh_token)}; ${cookieAttrs()}`);
      return res.status(200).json({ success: true, access_token });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: 'Erro interno', detail: String(err?.message || err) });
    }
  }

  // POST /api/auth/logout → limpa cookie
  if (parts.length === 1 && parts[0] === 'logout' && req.method === 'POST') {
    res.setHeader('Set-Cookie', `refresh_token=; ${clearCookieAttrs()}`);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ success: true });
  }

  // POST /api/auth/password-recovery → /admin/auth/password-recovery
  if (parts.length === 1 && parts[0] === 'password-recovery' && req.method === 'POST') {
    try {
      const bodyObj = typeof req.body === 'object' && req.body ? req.body : ((req as any).body ? JSON.parse((req as any).body) : {});
      const upstream = await fetch(`${base}/admin/auth/password-recovery`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bodyObj ?? {}) });
      return passJson(upstream, res);
    } catch (err: any) {
      return res.status(500).json({ success: false, message: 'Erro interno', detail: String(err?.message || err) });
    }
  }

  // POST /api/auth/verify → /admin/auth/verify
  if (parts.length === 1 && parts[0] === 'verify' && req.method === 'POST') {
    try {
      const bodyObj = typeof req.body === 'object' && req.body ? req.body : ((req as any).body ? JSON.parse((req as any).body) : {});
      const upstream = await fetch(`${base}/admin/auth/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bodyObj ?? {}) });
      return passJson(upstream, res);
    } catch (err: any) {
      return res.status(500).json({ success: false, message: 'Erro interno', detail: String(err?.message || err) });
    }
  }

  // POST /api/auth/mfa/verify → /admin/auth/mfa/verify
  if (parts.length === 2 && parts[0] === 'mfa' && parts[1] === 'verify' && req.method === 'POST') {
    try {
      const bodyObj = typeof req.body === 'object' && req.body ? req.body : ((req as any).body ? JSON.parse((req as any).body) : {});
      const upstream = await fetch(`${base}/admin/auth/mfa/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bodyObj ?? {}) });
      return passJson(upstream, res);
    } catch (err: any) {
      return res.status(500).json({ success: false, message: 'Erro interno', detail: String(err?.message || err) });
    }
  }

  // POST /api/auth/verify-code/{code}
  if (parts.length === 2 && parts[0] === 'verify-code' && req.method === 'POST') {
    try {
      const code = parts[1];
      if (!code || !/^[A-Fa-f0-9]{64}$/.test(code)) return res.status(400).json({ success: false, message: 'Código inválido' });
      const bodyObj = typeof req.body === 'object' && req.body ? req.body : ((req as any).body ? JSON.parse((req as any).body) : {});
      const upstream = await fetch(`${base}/admin/auth/verify-code/${code}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bodyObj ?? {}) });
      return passJson(upstream, res);
    } catch (err: any) {
      return res.status(500).json({ success: false, message: 'Erro interno', detail: String(err?.message || err) });
    }
  }

  return res.status(404).json({ success: false, message: 'Not Found' });
}

