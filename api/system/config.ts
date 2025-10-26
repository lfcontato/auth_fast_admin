import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getBaseApiFromEnv } from '../_lib/env';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  const base = getBaseApiFromEnv();
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ base });
}

