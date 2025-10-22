import type { VercelRequest, VercelResponse } from '@vercel/node';
import { clearCookieAttrs } from '../_lib/cookies';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Set-Cookie', `refresh_token=; ${clearCookieAttrs()}`);
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ success: true });
}
