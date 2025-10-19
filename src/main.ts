let accessToken: string | null = null;
let refreshTimer: number | null = null;

const $ = (sel: string) => document.querySelector(sel) as HTMLElement | null;
const setText = (sel: string, text: string) => { const el = $(sel); if (el) el.textContent = text; };

function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  try {
    const [, payload] = jwt.split(".");
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(atob(base64).split("").map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join(""));
    return JSON.parse(json);
  } catch { return null; }
}

function scheduleAutoRefresh(token: string) {
  if (refreshTimer) { clearTimeout(refreshTimer); refreshTimer = null; }
  const payload: any = decodeJwtPayload(token);
  const expMs = payload?.exp ? Number(payload.exp) * 1000 : 0;
  if (!expMs) return;
  let ms = expMs - Date.now() - 60_000; // 1 min antes
  if (ms < 5_000) ms = 5_000;
  refreshTimer = window.setTimeout(() => { forceRefresh().catch(() => {}); }, ms);
}

async function apiFetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : (input instanceof Request ? input.url : String(input ?? ''));
  const headers = new Headers(init?.headers || {});
  if (accessToken && !(url && url.startsWith('/api/refresh'))) headers.set('Authorization', `Bearer ${accessToken}`);
  const res = await fetch(input, { ...init, headers, credentials: 'same-origin' });
  if (res.status !== 401 || (url && url.startsWith('/api/refresh'))) return res;
  // tenta refresh 1x e refaz
  const rr = await fetch('/api/refresh', { method: 'POST', credentials: 'same-origin' });
  if (rr.ok) {
    const j = await rr.json().catch(() => ({}));
    if (j?.access_token) {
      accessToken = j.access_token;
      setText('#access-token', accessToken);
      setText('#jwt-payload', JSON.stringify(decodeJwtPayload(accessToken), null, 2));
      scheduleAutoRefresh(accessToken);
      return fetch(input, { ...init, headers: new Headers({ ...Object.fromEntries(headers), Authorization: `Bearer ${accessToken}` }), credentials: 'same-origin' });
    }
  }
  return res;
}

async function login(username: string, password: string) {
  const r = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }), credentials: 'same-origin' });
  const j = await r.json().catch(() => ({}));
  setText('#last-response', JSON.stringify(j, null, 2));
  if (!r.ok) throw new Error(j?.message || `Login falhou (${r.status})`);
  accessToken = j.access_token || null;
  setText('#access-token', accessToken ?? '—');
  setText('#jwt-payload', JSON.stringify(decodeJwtPayload(accessToken || ''), null, 2));
  if (accessToken) scheduleAutoRefresh(accessToken);
}

async function forceRefresh() {
  const r = await fetch('/api/refresh', { method: 'POST', credentials: 'same-origin' });
  const j = await r.json().catch(() => ({}));
  setText('#last-response', JSON.stringify(j, null, 2));
  if (!r.ok) throw new Error(j?.message || `Refresh falhou (${r.status})`);
  accessToken = j.access_token || null;
  setText('#access-token', accessToken ?? '—');
  setText('#jwt-payload', JSON.stringify(decodeJwtPayload(accessToken || ''), null, 2));
  if (accessToken) scheduleAutoRefresh(accessToken);
}

async function health() {
  const r = await fetch('/api/health');
  const j = await r.json().catch(() => ({}));
  setText('#last-response', JSON.stringify(j, null, 2));
}

function clearSession() {
  accessToken = null;
  setText('#access-token', '(não autenticado)');
  setText('#jwt-payload', '—');
  setText('#last-response', '—');
  if (refreshTimer) { clearTimeout(refreshTimer); refreshTimer = null; }
  fetch('/api/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
}

function showServerlessWarning() { const el = document.getElementById('serverless-warning'); if (el) el.style.display = ''; }
async function checkServerlessAvailable() {
  try {
    const r = await fetch('/api/health');
    if (!r.ok) showServerlessWarning();
    await r.json().catch(() => showServerlessWarning());
  } catch { showServerlessWarning(); }
}

window.addEventListener('DOMContentLoaded', () => {
  checkServerlessAvailable();
  // restaura sessão
  fetch('/api/refresh', { method: 'POST', credentials: 'same-origin' })
    .then(r => r.ok ? r.json() : null)
    .then(j => {
      if (j?.access_token) {
        accessToken = j.access_token;
        setText('#access-token', accessToken);
        setText('#jwt-payload', JSON.stringify(decodeJwtPayload(accessToken), null, 2));
        scheduleAutoRefresh(accessToken);
      }
    }).catch(() => {});

  const form = document.getElementById('login-form') as HTMLFormElement | null;
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const u = (document.getElementById('username') as HTMLInputElement)?.value?.trim();
    const p = (document.getElementById('password') as HTMLInputElement)?.value ?? '';
    try { await login(u, p); } catch (err: any) { setText('#last-response', String(err?.message || err)); }
  });
  document.getElementById('btn-logout')?.addEventListener('click', () => clearSession());
  document.getElementById('btn-health')?.addEventListener('click', () => health());
  document.getElementById('btn-refresh')?.addEventListener('click', () => forceRefresh());
  document.getElementById('btn-admin-list')?.addEventListener('click', async () => {
    try {
      const off = (document.getElementById('admin-offset') as HTMLInputElement | null)?.value?.trim();
      const lim = (document.getElementById('admin-limit') as HTMLInputElement | null)?.value?.trim();
      const params = new URLSearchParams();
      if (off) params.set('offset', off);
      if (lim) params.set('limit', lim);
      const qs = params.toString();
      const r = await apiFetch(`/api/admin${qs ? `?${qs}` : ''}`, { method: 'GET', credentials: 'same-origin' });
      const j = await r.json().catch(() => ({}));
      setText('#last-response', JSON.stringify(j, null, 2));
    } catch (err: any) {
      setText('#last-response', String(err?.message || err));
    }
  });

  // Criar administrador
  const formAdmin = document.getElementById('form-admin-create') as HTMLFormElement | null;
  formAdmin?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = (document.getElementById('admin-email') as HTMLInputElement)?.value?.trim();
    const username = (document.getElementById('admin-username') as HTMLInputElement)?.value?.trim();
    const password = (document.getElementById('admin-password') as HTMLInputElement)?.value ?? '';
    const system_role = (document.getElementById('admin-role') as HTMLSelectElement)?.value ?? 'user';
    try {
      const payload: Record<string, unknown> = { email, username, system_role };
      if (password && password.trim() !== '') payload.password = password;
      const r = await apiFetch('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), credentials: 'same-origin' });
      const j = await r.json().catch(() => ({}));
      setText('#last-response', JSON.stringify(j, null, 2));
    } catch (err: any) {
      setText('#last-response', String(err?.message || err));
    }
  });

  // Verificar conta com código
  const formCodeVerify = document.getElementById('form-code-verify') as HTMLFormElement | null;
  formCodeVerify?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = (document.getElementById('verify-code') as HTMLInputElement)?.value?.trim();
    const password = (document.getElementById('verify-password') as HTMLInputElement)?.value ?? '';
    try {
      const r = await fetch(`/api/admin/auth/verify-code/${encodeURIComponent(code)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
        credentials: 'same-origin',
      });
      const j = await r.json().catch(() => ({}));
      setText('#last-response', JSON.stringify(j, null, 2));
    } catch (err: any) {
      setText('#last-response', String(err?.message || err));
    }
  });

  // Gerar link a partir de END_POINT_API
  document.getElementById('btn-build-verify-link')?.addEventListener('click', async () => {
    try {
      const code = (document.getElementById('verify-code') as HTMLInputElement)?.value?.trim();
      if (!code) { setText('#last-response', 'Informe o código para gerar link.'); return; }
      const r = await fetch(`/api/link/code-verified/${encodeURIComponent(code)}`);
      const j = await r.json().catch(() => ({}));
      if (r.ok && j?.url) {
        const out = document.getElementById('built-verify-link') as HTMLInputElement | null;
        if (out) out.value = j.url;
      } else {
        setText('#last-response', JSON.stringify(j, null, 2));
      }
    } catch (err: any) {
      setText('#last-response', String(err?.message || err));
    }
  });

  // Recuperação de senha (não autenticada)
  const formRecovery = document.getElementById('form-password-recovery') as HTMLFormElement | null;
  formRecovery?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = (document.getElementById('recovery-email') as HTMLInputElement)?.value?.trim();
    try {
      const r = await fetch('/api/admin/auth/password-recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
        credentials: 'same-origin',
      });
      const j = await r.json().catch(() => ({}));
      setText('#last-response', JSON.stringify(j, null, 2));
    } catch (err: any) {
      setText('#last-response', String(err?.message || err));
    }
  });

  // Se a URL for /admin/code-verified/{code}, pré-preenche e mostra dica
  try {
    const m = window.location.pathname.match(/^\/admin\/code-verified\/([A-Fa-f0-9]{64})$/);
    if (m) {
      const code = m[1];
      const codeInput = document.getElementById('verify-code') as HTMLInputElement | null;
      if (codeInput) codeInput.value = code;
      const tip = document.getElementById('verify-link-tip');
      if (tip) { tip.textContent = 'Código pré-preenchido a partir do link de verificação.'; tip.style.display = ''; }
    }
  } catch {}
});
