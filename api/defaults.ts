import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  const username = process.env.ROOT_AUTH_USER || '';
  const email = process.env.ROOT_AUTH_EMAIL || '';
  return res.status(200).json({
    success: true,
    username_default: username || undefined,
    email_default: email || undefined,
  });
}

