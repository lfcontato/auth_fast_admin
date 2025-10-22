import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getBaseApiFromEnv } from '../../_lib/env';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const hash = (req.query?.hash as string) || '';
  if (!hash || !/^[A-Fa-f0-9]{64}$/.test(hash)) {
    return res.status(400).json({ success: false, message: 'hash inválido' });
  }
  const base = getBaseApiFromEnv();
  const url = `${base}/admin/code-verified/${hash}`;
  return res.status(200).json({ success: true, url });
}

