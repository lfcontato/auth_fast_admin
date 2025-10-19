let accessToken: string | null = null;

// Helpers
const $ = (sel: string) => document.querySelector(sel) as HTMLElement | null;
const setText = (sel: string, text: string) => { const el = $(sel); if (el) el.textContent = text; };

function showServerlessWarning() {
  const el = document.getElementById('serverless-warning');
  if (el) el.style.display = '';
}

async function checkServerlessAvailable() {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 2500);
    const r = await fetch('/api/health', { credentials: 'same-origin', signal: controller.signal });
    clearTimeout(t);
    if (!r.ok) { showServerlessWarning(); return; }
    const ct = r.headers.get('content-type') || '';
    if (!ct.includes('application/json')) { showServerlessWarning(); return; }
    // Try to parse JSON; if fails, likely not our serverless
    await r.json().catch(() => { showServerlessWarning(); });
  } catch {
    showServerlessWarning();
  }
}

function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  try {
    const [, payload] = jwt.split(".");
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

async function apiFetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
  const url = typeof input === "string" ? input : input.toString();
  const headers = new Headers(init?.headers || {});

  if (accessToken && !url.startsWith("/api/refresh")) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const res = await fetch(input, { ...init, headers, credentials: "same-origin" });
  if (res.status !== 401 || url.startsWith("/api/")) {
    return res;
  }

  // 401 when calling a backend directly (not used now). Try refresh then retry once.
  const refreshRes = await fetch("/api/refresh", { method: "POST", credentials: "same-origin" });
  if (refreshRes.ok) {
    const data = await refreshRes.json();
    if (data?.access_token) {
      accessToken = data.access_token;
      setText("#access-token", accessToken);
      const payload = decodeJwtPayload(accessToken);
      setText("#jwt-payload", JSON.stringify(payload, null, 2));
      // retry original request
      return fetch(input, { ...init, headers: new Headers({ ...Object.fromEntries(headers), Authorization: `Bearer ${accessToken}` }), credentials: "same-origin" });
    }
  }
  return res; // propagate original 401
}

async function login(username: string, password: string) {
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  ($("#last-response") as HTMLElement).textContent = JSON.stringify(data, null, 2);
  if (!res.ok) {
    throw new Error(data?.message || `Login falhou (${res.status})`);
  }
  accessToken = data?.access_token || null;
  setText("#access-token", accessToken ?? "—");
  const payload = accessToken ? decodeJwtPayload(accessToken) : null;
  setText("#jwt-payload", JSON.stringify(payload, null, 2));
}

async function forceRefresh() {
  const res = await fetch("/api/refresh", { method: "POST", credentials: "same-origin" });
  const data = await res.json().catch(() => ({}));
  ($("#last-response") as HTMLElement).textContent = JSON.stringify(data, null, 2);
  if (!res.ok) throw new Error(data?.message || `Refresh falhou (${res.status})`);
  accessToken = data?.access_token || null;
  setText("#access-token", accessToken ?? "—");
  const payload = accessToken ? decodeJwtPayload(accessToken) : null;
  setText("#jwt-payload", JSON.stringify(payload, null, 2));
}

async function health() {
  const res = await fetch("/api/health", { method: "GET", credentials: "same-origin" });
  const data = await res.json().catch(() => ({}));
  ($("#last-response") as HTMLElement).textContent = JSON.stringify(data, null, 2);
}

function clearSession() {
  accessToken = null;
  setText("#access-token", "(não autenticado)");
  setText("#jwt-payload", "—");
  setText("#last-response", "—");
}

// Wire UI
window.addEventListener("DOMContentLoaded", () => {
  const form = $("#login-form") as HTMLFormElement | null;
  // Verifica disponibilidade de /api/* (serverless). Se indisponível, alerta para usar `vercel dev`.
  checkServerlessAvailable();
  // Carrega defaults do backend (ROOT_AUTH_USER/EMAIL) e preenche UI
  (async () => {
    try {
      const r = await fetch('/api/defaults', { credentials: 'same-origin' });
      if (r.ok) {
        const j = await r.json();
        if (j?.username_default) {
          const u = document.getElementById('username') as HTMLInputElement | null;
          if (u && !u.value) u.value = j.username_default;
        }
        const info = document.getElementById('defaults-info');
        if (info && (j?.username_default || j?.email_default)) {
          info.style.display = '';
          const parts = [] as string[];
          if (j?.username_default) parts.push(`Usuário padrão: ${j.username_default}`);
          if (j?.email_default) parts.push(`Email padrão: ${j.email_default}`);
          info.textContent = parts.join(' · ');
        }
      }
    } catch {
      /* ignora erros silenciosamente */
    }
  })();
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = (document.getElementById("username") as HTMLInputElement)?.value?.trim();
    const password = (document.getElementById("password") as HTMLInputElement)?.value ?? "";
    try {
      await login(username, password);
    } catch (err: any) {
      ($("#last-response") as HTMLElement).textContent = String(err?.message || err);
    }
  });

  $("#btn-refresh")?.addEventListener("click", async () => {
    try { await forceRefresh(); } catch (err: any) { ($("#last-response") as HTMLElement).textContent = String(err?.message || err); }
  });
  $("#btn-health")?.addEventListener("click", async () => {
    try { await health(); } catch (err: any) { ($("#last-response") as HTMLElement).textContent = String(err?.message || err); }
  });
  $("#btn-logout")?.addEventListener("click", () => clearSession());
});
