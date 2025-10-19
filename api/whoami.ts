import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const xfwd = req.headers['x-forwarded-for'];
  const xreal = req.headers['x-real-ip'];
  let ip = '';
  if (typeof xfwd === 'string' && xfwd) ip = xfwd.split(',')[0].trim();
  else if (Array.isArray(xfwd) && xfwd.length) ip = (xfwd[0] || '').trim();
  if (!ip && typeof xreal === 'string') ip = xreal.trim();
  if (!ip) ip = (req.socket as any)?.remoteAddress || '';

  const out = {
    ip,
    ua: (req.headers['user-agent'] as string) || '',
    acceptLanguage: (req.headers['accept-language'] as string) || '',
    // Vercel Edge geolocation headers (quando disponíveis)
    country: (req.headers['x-vercel-ip-country'] as string) || '',
    region: (req.headers['x-vercel-ip-country-region'] as string) || '',
    city: (req.headers['x-vercel-ip-city'] as string) || '',
    timezone: (req.headers['x-vercel-ip-timezone'] as string) || '',
    latitude: (req.headers['x-vercel-ip-latitude'] as string) || '',
    longitude: (req.headers['x-vercel-ip-longitude'] as string) || '',
  };

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json(out);
}

