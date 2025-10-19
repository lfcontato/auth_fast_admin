import type { VercelRequest, VercelResponse } from '@vercel/node';

function buildFromEnv(): string {
  const raw = process.env.END_POINT_API;
  let v = typeof raw === 'string' && raw ? raw : '';
  v = v.trim();
  if (v && (v.startsWith('"') && v.endsWith('"') || v.startsWith('\'') && v.endsWith('\''))) v = v.slice(1, -1);
  if (v.endsWith('/')) v = v.slice(0, -1);
  return v;
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  const hash = (req.query?.hash as string) || '';
  if (!hash || !/^[A-Fa-f0-9]{64}$/.test(hash)) {
    return res.status(400).json({ success: false, message: 'hash inválido' });
  }
  const base = buildFromEnv();
  if (!base) {
    return res.status(500).json({ success: false, message: 'END_POINT_API não configurado' });
  }
  const url = `${base}/admin/code-verified/${hash}`;
  return res.status(200).json({ success: true, url });
}

