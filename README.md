Auth Admin Tester (mínimo)

Resumo
- SPA estática (Vite + TypeScript) com Bootstrap para UI.
- Funções Serverless na Vercel para login, refresh e health.
- Usa `END_POINT_API` do `.env` exatamente como definido (ex.: `http://localhost:8080`).

Estrutura
- index.html – UI de login e ações (Health, Refresh)
- src/main.ts – fluxo de autenticação + restauração de sessão
- api/login.ts – POST /admin/auth/token (salva refresh HttpOnly)
- api/refresh.ts – POST /admin/auth/token/refresh (rotaciona cookie)
- api/health.ts – GET /healthz
- api/logout.ts – apaga cookie de refresh
- vercel.json – build estático para dist/

Como rodar (local)
1) `.env` na raiz: `END_POINT_API=http://localhost:8080`
2) `npm install`
3) `vercel dev`
   - UI em `http://localhost:3000`
   - Proxies em `/api/*`

Notas
- Cookie: HttpOnly, Path=/, SameSite=Lax (Secure em produção).
- A página restaura a sessão automaticamente no carregamento via `/api/refresh`.
