export function cookieAttrs(maxAgeSeconds = 2592000) {
  const isProd = process.env.NODE_ENV === 'production' || !!process.env.VERCEL_ENV;
  const attrs = [
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (isProd) attrs.push('Secure');
  return attrs.join('; ');
}

export function clearCookieAttrs() {
  const isProd = process.env.NODE_ENV === 'production' || !!process.env.VERCEL_ENV;
  const attrs = [`Path=/`, `HttpOnly`, `SameSite=Lax`, `Max-Age=0`];
  if (isProd) attrs.push('Secure');
  return attrs.join('; ');
}

export function parseCookies(cookieHeader?: string) {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(/;\s*/)) {
    const i = part.indexOf('=');
    if (i > -1) out[part.slice(0, i)] = decodeURIComponent(part.slice(i + 1));
  }
  return out;
}

