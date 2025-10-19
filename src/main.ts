let accessToken: string | null = null;
let refreshTimer: number | null = null;
let mfaTx: string | null = null;

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

function mapAuthCode(code?: string): string | null {
  if (!code || typeof code !== 'string') return null;
  const map: Record<string, string> = {
    // Comuns
    'AUTH_401_005': 'Token ausente ou inválido',
    'HTTP_404': 'Rota não encontrada no backend',
    // System-role
    'AUTH_400_020': 'JSON inválido ou valor de papel inválido',
    'AUTH_403_010': 'Papel insuficiente para alterar este alvo ou novo papel',
    'AUTH_404_002': 'Administrador alvo não encontrado',
    // Subscription-plan
    'AUTH_400_021': 'Plano inválido ou ausente',
    'AUTH_403_011': 'Permissão insuficiente para definir este plano',
    // Alterar senha
    'AUTH_400_030': 'JSON inválido ou campos ausentes',
    'AUTH_400_031': 'Campos obrigatórios ausentes',
    'AUTH_400_005': 'Senha nova fora da política de segurança',
    'AUTH_401_006': 'Senha atual inválida',
    'AUTH_404_001': 'Administrador não encontrado',
  };
  return map[code] || null;
}

async function login(username: string, password: string) {
  const r = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }), credentials: 'same-origin' });
  const j = await r.json().catch(() => ({}));
  setText('#last-response', JSON.stringify(j, null, 2));
  if (r.status === 202 && j?.mfa_required) {
    // Habilita UI de MFA e guarda a transação
    mfaTx = j?.mfa_tx || null;
    const mfaArea = document.getElementById('mfa-area'); if (mfaArea) mfaArea.style.display = '';
    const codeInput = document.getElementById('mfa-code') as HTMLInputElement | null; if (codeInput) codeInput.focus();
    return; // não define tokens ainda
  }
  if (!r.ok) throw new Error(j?.message || `Login falhou (${r.status})`);
  accessToken = j.access_token || null;
  setText('#access-token', accessToken ?? '—');
  setText('#jwt-payload', JSON.stringify(decodeJwtPayload(accessToken || ''), null, 2));
  if (accessToken) scheduleAutoRefresh(accessToken);
}

async function verifyMfa(code: string) {
  if (!mfaTx) throw new Error('Transação MFA ausente. Faça login novamente.');
  const r = await fetch('/api/admin/auth/mfa/verify', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mfa_tx: mfaTx, code }), credentials: 'same-origin'
  });
  const j = await r.json().catch(() => ({}));
  setText('#last-response', JSON.stringify(j, null, 2));
  if (!r.ok) throw new Error(j?.message || `MFA falhou (${r.status})`);
  // sucesso → tokens
  accessToken = j.access_token || null;
  setText('#access-token', accessToken ?? '—');
  setText('#jwt-payload', JSON.stringify(decodeJwtPayload(accessToken || ''), null, 2));
  if (accessToken) scheduleAutoRefresh(accessToken);
  // Esconde área de MFA e limpa tx
  const mfaArea = document.getElementById('mfa-area'); if (mfaArea) mfaArea.style.display = 'none';
  mfaTx = null;
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
  // Aviso de privacidade para o usuário (sem consentimento explícito)
  try {
    let notice = document.getElementById('privacy-notice') as HTMLDivElement | null;
    if (!notice) {
      const container = document.querySelector('main.container') as HTMLElement | null;
      if (container) {
        notice = document.createElement('div');
        notice.id = 'privacy-notice';
        notice.className = 'alert alert-info small';
        notice.textContent = 'Aviso de privacidade: coletamos automaticamente IP, user-agent e preferências de idioma para operação e segurança (base legal: interesse legítimo/operacional). Não coletamos geolocalização precisa; a localização aproximada pode ser inferida por cabeçalhos da rede (ex.: país/cidade do provedor).';
        const serverless = document.getElementById('serverless-warning');
        container.insertBefore(notice, serverless ? serverless.nextSibling : container.firstChild);
      }
    }
  } catch {}

  // Marcar itens que requerem autenticação com ícone de cadeado
  try {
    const addLock = (el: HTMLElement | null) => {
      if (!el) return;
      if (el.querySelector('.lock-icon')) return; // evita duplicar
      const span = document.createElement('span');
      span.className = 'lock-icon me-1';
      span.setAttribute('aria-hidden', 'true');
      span.textContent = '🔒';
      // Inserir no início
      if (el.firstChild) el.insertBefore(span, el.firstChild);
      else el.appendChild(span);
    };

    // Botão de listar admins (usa Authorization Bearer)
    addLock(document.getElementById('btn-admin-list'));

    // Card "Criar Administrador" (toda a seção requer token)
    const formAdmin = document.getElementById('form-admin-create');
    const adminCard = formAdmin?.closest('.card') as HTMLElement | null;
    const adminHeader = adminCard ? adminCard.querySelector('.card-header') as HTMLElement | null : null;
    addLock(adminHeader);

    // Card "Alterar Papel" (requer token)
    const formRole = document.getElementById('form-admin-role');
    const roleCard = formRole?.closest('.card') as HTMLElement | null;
    const roleHeader = roleCard ? roleCard.querySelector('.card-header') as HTMLElement | null : null;
    addLock(roleHeader);

    // Card "Alterar Plano" (requer token)
    const formPlan = document.getElementById('form-admin-plan');
    const planCard = formPlan?.closest('.card') as HTMLElement | null;
    const planHeader = planCard ? planCard.querySelector('.card-header') as HTMLElement | null : null;
    addLock(planHeader);

    // Card "Alterar Senha" (requer token)
    const formPwd = document.getElementById('form-admin-password');
    const pwdCard = formPwd?.closest('.card') as HTMLElement | null;
    const pwdHeader = pwdCard ? pwdCard.querySelector('.card-header') as HTMLElement | null : null;
    addLock(pwdHeader);
  } catch {}

  try {
    const nav: any = navigator as any;
    const uaCh = nav.userAgentData && typeof nav.userAgentData === 'object' ? {
      mobile: !!nav.userAgentData.mobile,
      platform: nav.userAgentData.platform || '',
      brands: Array.isArray(nav.userAgentData.brands) ? nav.userAgentData.brands : [],
    } : null;
    const conn: any = (nav.connection || (nav as any).mozConnection || (nav as any).webkitConnection || null);
    const connection = conn ? {
      effectiveType: conn.effectiveType || '',
      downlink: typeof conn.downlink === 'number' ? conn.downlink : null,
      rtt: typeof conn.rtt === 'number' ? conn.rtt : null,
      saveData: !!conn.saveData,
    } : null;

    const client: Record<string, any> = {
      // Locale e idioma
      lang: nav.language || '',
      languages: nav.languages || [],
      docLang: (document.documentElement.getAttribute('lang') || document.documentElement.lang || ''),
      locale: Intl.DateTimeFormat().resolvedOptions().locale,
      // Tempo e fuso
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      tzOffset: new Date().getTimezoneOffset(),
      // Tela e viewport
      dpr: (window as any).devicePixelRatio || 1,
      viewport: { w: window.innerWidth, h: window.innerHeight },
      screen: { w: (window as any).screen?.width || 0, h: (window as any).screen?.height || 0 },
      // Plataforma / Agente
      ua: nav.userAgent || '',
      platform: nav.platform || '',
      vendor: nav.vendor || '',
      uaCh,
      // Capacidades
      cpu: nav.hardwareConcurrency ?? null,
      mem: nav.deviceMemory ?? null,
      touch: nav.maxTouchPoints ?? 0,
      // Preferências do usuário
      dark: (typeof matchMedia === 'function') && matchMedia('(prefers-color-scheme: dark)').matches || false,
      reducedMotion: (typeof matchMedia === 'function') && matchMedia('(prefers-reduced-motion: reduce)').matches || false,
      dnt: nav.doNotTrack ?? null,
      // Estado e conexao
      cookieEnabled: nav.cookieEnabled ?? null,
      online: nav.onLine ?? null,
      connection,
      // Documento
      referrer: document.referrer || '',
      visibility: document.visibilityState || '',
    };

    // Função para renderizar na UI dentro do card "Estado"
    const renderClientTelemetry = (obj: unknown) => {
      try {
        let pre = document.getElementById('client-telemetry') as HTMLPreElement | null;
        if (!pre) {
          const lastRespPre = document.getElementById('last-response');
          const cardBody = lastRespPre?.closest('.card-body') as HTMLElement | null;
          if (cardBody) {
            const wrap = document.createElement('div');
            wrap.className = 'mt-2';
            const title = document.createElement('strong');
            title.textContent = 'Telemetry (cliente):';
            pre = document.createElement('pre');
            pre.id = 'client-telemetry';
            pre.className = 'mb-0 bg-light p-2 rounded';
            pre.style.whiteSpace = 'pre-wrap';
            pre.style.wordBreak = 'break-all';
            wrap.appendChild(title);
            wrap.appendChild(pre);
            cardBody.appendChild(wrap);
          }
        }
        if (pre) pre.textContent = JSON.stringify(obj, null, 2);
      } catch {}
    };

    // Render inicial
    renderClientTelemetry(client);

    // Envio para o backend (não bloqueante)
    const payload = JSON.stringify(client);
    if ((navigator as any).sendBeacon) {
      (navigator as any).sendBeacon('/api/telemetry', new Blob([payload], { type: 'application/json' }));
    } else {
      fetch('/api/telemetry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true, credentials: 'same-origin' }).catch(() => {});
    }

    // Enriquecimento assíncrono: IP e localização aproximada do servidor
    try {
      fetch('/api/whoami', { credentials: 'same-origin' })
        .then(r => r.ok ? r.json() : null)
        .then(j => {
          if (!j) return;
          client.server = {
            ip: j.ip || '',
            country: j.country || '',
            region: j.region || '',
            city: j.city || '',
            timezone: j.timezone || '',
          };
          renderClientTelemetry(client);
        })
        .catch(() => {});
    } catch {}

    // Enriquecimento assíncrono: storage estimate
    try {
      const storageAny: any = (navigator as any).storage;
      if (storageAny && typeof storageAny.estimate === 'function') {
        storageAny.estimate()
          .then((est: any) => {
            client.storage = { usage: est?.usage ?? null, quota: est?.quota ?? null };
            renderClientTelemetry(client);
          })
          .catch(() => {});
      }
    } catch {}

  } catch {}

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
  document.getElementById('btn-mfa-verify')?.addEventListener('click', async () => {
    try {
      const code = (document.getElementById('mfa-code') as HTMLInputElement)?.value?.trim() || '';
      if (!code) { setText('#last-response', 'Informe o código MFA.'); return; }
      await verifyMfa(code);
    } catch (err: any) {
      setText('#last-response', String(err?.message || err));
    }
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

  // Alterar papel (system_role) autenticado
  const formAdminRole = document.getElementById('form-admin-role') as HTMLFormElement | null;
  formAdminRole?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const idRaw = (document.getElementById('role-admin-id') as HTMLInputElement)?.value?.trim();
    const newRole = (document.getElementById('role-new') as HTMLSelectElement)?.value || 'user';
    try {
      const id = Number.parseInt(idRaw || '', 10);
      if (!Number.isFinite(id) || id <= 0) throw new Error('Admin ID inválido');
      const r = await apiFetch(`/api/admin/${encodeURIComponent(String(id))}/system-role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ system_role: newRole }),
        credentials: 'same-origin',
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        const msg = mapAuthCode(j?.code) || j?.message || `Erro (${r.status})`;
        setText('#last-response', `${msg}\n${JSON.stringify(j, null, 2)}`);
      } else {
        setText('#last-response', JSON.stringify(j, null, 2));
      }
    } catch (err: any) {
      setText('#last-response', String(err?.message || err));
    }
  });

  // Alterar plano (subscription_plan) autenticado
  const formAdminPlan = document.getElementById('form-admin-plan') as HTMLFormElement | null;
  formAdminPlan?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const idRaw = (document.getElementById('plan-admin-id') as HTMLInputElement)?.value?.trim();
    const newPlan = (document.getElementById('plan-new') as HTMLSelectElement)?.value || 'monthly';
    try {
      const id = Number.parseInt(idRaw || '', 10);
      if (!Number.isFinite(id) || id <= 0) throw new Error('Admin ID inválido');
      const r = await apiFetch(`/api/admin/${encodeURIComponent(String(id))}/subscription-plan`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription_plan: newPlan }),
        credentials: 'same-origin',
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        const msg = mapAuthCode(j?.code) || j?.message || `Erro (${r.status})`;
        setText('#last-response', `${msg}\n${JSON.stringify(j, null, 2)}`);
      } else {
        setText('#last-response', JSON.stringify(j, null, 2));
      }
    } catch (err: any) {
      setText('#last-response', String(err?.message || err));
    }
  });

  // Alterar senha (própria)
  const formAdminPassword = document.getElementById('form-admin-password') as HTMLFormElement | null;
  formAdminPassword?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const current_password = (document.getElementById('pwd-current') as HTMLInputElement)?.value ?? '';
    const new_password = (document.getElementById('pwd-new') as HTMLInputElement)?.value ?? '';
    try {
      const r = await apiFetch(`/api/admin/password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password, new_password }),
        credentials: 'same-origin',
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        const msg = mapAuthCode(j?.code) || j?.message || `Erro (${r.status})`;
        setText('#last-response', `${msg}\n${JSON.stringify(j, null, 2)}`);
      } else {
        setText('#last-response', JSON.stringify(j, null, 2));
      }
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
