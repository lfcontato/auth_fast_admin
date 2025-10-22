import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getBaseApiFromEnv } from '../_lib/env';
import { cookieAttrs, parseCookies, clearCookieAttrs } from '../_lib/cookies';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  try {
    const cookies = parseCookies(req.headers.cookie);
    const refresh = cookies['refresh_token'];
    if (!refresh) return res.status(401).json({ success: false, message: 'Sem refresh_token' });
    const base = getBaseApiFromEnv();
    const upstream = await fetch(`${base}/admin/auth/token/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: refresh }) });
    const data = await upstream.json().catch(() => ({} as any));
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
