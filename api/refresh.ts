import type { VercelRequest, VercelResponse } from '@vercel/node';

function getBaseApi(): string {
  const raw = process.env.END_POINT_API || 'http://localhost:8080/';
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

function parseCookies(cookieHeader?: string) {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  const parts = cookieHeader.split(/;\s*/);
  for (const p of parts) {
    const idx = p.indexOf('=');
    if (idx > -1) out[p.slice(0, idx)] = decodeURIComponent(p.slice(idx + 1));
  }
  return out;
}

function cookieAttrs(maxAgeSeconds = 2592000) {
  const isProd = process.env.NODE_ENV === 'production' || !!process.env.VERCEL_ENV;
  const attrs = [
    `Path=/api`,
    `HttpOnly`,
    `SameSite=Strict`,
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (isProd) attrs.push('Secure');
  return attrs.join('; ');
}

function clearCookie() {
  const isProd = process.env.NODE_ENV === 'production' || !!process.env.VERCEL_ENV;
  const attrs = [`Path=/api`, `HttpOnly`, `SameSite=Strict`, `Max-Age=0`];
  if (isProd) attrs.push('Secure');
  return attrs.join('; ');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const cookies = parseCookies(req.headers.cookie);
    const refresh = cookies['refresh_token'];
    if (!refresh) {
      return res.status(401).json({ success: false, message: 'Sem refresh_token' });
    }

    const base = getBaseApi();
    const upstream = await fetch(`${base}/admin/auth/token/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
    });

    const data = await upstream.json().catch(() => ({} as any));
    if (!upstream.ok) {
      // Limpa cookie inválido
      res.setHeader('Set-Cookie', `refresh_token=; ${clearCookie()}`);
      return res.status(upstream.status).json(data);
    }

    const { access_token, refresh_token } = data || {};
    if (!access_token || !refresh_token) {
      return res.status(502).json({ success: false, message: 'Resposta inválida do servidor de autenticação' });
    }

    res.setHeader('Set-Cookie', `refresh_token=${encodeURIComponent(refresh_token)}; ${cookieAttrs()}`);
    return res.status(200).json({ success: true, access_token });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Erro interno', detail: String(err?.message || err) });
  }
}

