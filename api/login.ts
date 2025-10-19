import type { VercelRequest, VercelResponse } from '@vercel/node';

function getBaseApi(): string {
  const raw = process.env.END_POINT_API || 'http://localhost:8080/';
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const { username, password } = typeof req.body === 'object' && req.body ? req.body : JSON.parse(req.body || '{}');
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'username e password são obrigatórios' });
    }

    const base = getBaseApi();
    const upstream = await fetch(`${base}/admin/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await upstream.json().catch(() => ({} as any));
    if (!upstream.ok) {
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

