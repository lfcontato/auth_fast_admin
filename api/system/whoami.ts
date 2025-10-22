import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getClientIp, getGeoFromHeaders, getClientHeaders } from '../_lib/request';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const ip = getClientIp(req);
  const geo = getGeoFromHeaders(req);
  const client = getClientHeaders(req);

  const out = {
    ip,
    ua: client.ua,
    acceptLanguage: client.acceptLanguage,
    ...geo,
  };

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json(out);
}
