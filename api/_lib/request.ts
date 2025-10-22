import type { VercelRequest } from '@vercel/node';

export function getClientIp(req: VercelRequest): string {
  const xfwd = req.headers['x-forwarded-for'];
  const xreal = req.headers['x-real-ip'];
  let ip = '';
  if (typeof xfwd === 'string' && xfwd) ip = xfwd.split(',')[0].trim();
  else if (Array.isArray(xfwd) && xfwd.length) ip = (xfwd[0] || '').trim();
  if (!ip && typeof xreal === 'string') ip = xreal.trim();
  if (!ip) ip = (req.socket as any)?.remoteAddress || '';
  return ip;
}

export function getGeoFromHeaders(req: VercelRequest) {
  return {
    country: (req.headers['x-vercel-ip-country'] as string) || '',
    region: (req.headers['x-vercel-ip-country-region'] as string) || '',
    city: (req.headers['x-vercel-ip-city'] as string) || '',
    timezone: (req.headers['x-vercel-ip-timezone'] as string) || '',
    latitude: (req.headers['x-vercel-ip-latitude'] as string) || '',
    longitude: (req.headers['x-vercel-ip-longitude'] as string) || '',
  };
}

export function getClientHeaders(req: VercelRequest) {
  return {
    ua: (req.headers['user-agent'] as string) || '',
    acceptLanguage: (req.headers['accept-language'] as string) || '',
    referer: (req.headers['referer'] as string) || '',
    origin: (req.headers['origin'] as string) || '',
    secChUa: (req.headers['sec-ch-ua'] as string) || '',
    secChUaMobile: (req.headers['sec-ch-ua-mobile'] as string) || '',
    secChUaPlatform: (req.headers['sec-ch-ua-platform'] as string) || '',
  };
}

