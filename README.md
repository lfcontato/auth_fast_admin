Proposta Recomendada (segura e simples)

Resumo
- SPA estática com Vite + TypeScript
- Bootstrap 5 (CDN) para UI
- Funções Serverless na Vercel para login e refresh
  - Armazenam o refresh_token em cookie HttpOnly + SameSite=Strict
  - Cliente guarda apenas o access_token em memória

Estrutura
- index.html – página com formulário de login e botões de teste
- src/main.ts – lógica de autenticação, refresh e UI
- api/login.ts – proxy seguro para /admin/auth/token
- api/refresh.ts – proxy seguro para /admin/auth/token/refresh
- api/health.ts – proxy para /healthz
- vercel.json – build estático para dist/

Pré‑requisitos
- Node 18+
- Vercel CLI (opcional para local): `npm i -g vercel`

Variáveis de ambiente
- `END_POINT_API` (obrigatória em produção) – base da API de autenticação.
  - Ex.: `https://seu-dominio-backend.com` ou `http://localhost:8080`
  - Em Vercel, defina em Project Settings → Environment Variables.

Rodando localmente (opção 1: Vercel dev)
1) Crie `.env` na raiz com `END_POINT_API=http://localhost:8080`
2) Instale deps: `npm install`
3) Rode: `vercel dev`
   - As funções serverless estarão em `/api/*`

Rodando localmente (opção 2: Vite + backend próprio)
1) Instale deps: `npm install`
2) Rode a SPA: `npm run dev` (http://localhost:5173)
3) Para usar as funções /api/*, rode `vercel dev` em outro terminal; do contrário, a SPA sozinha não expõe `/api/*`.

Deploy na Vercel
1) Configure `END_POINT_API` no projeto
2) `vercel --prod` (ou CI automático do GitHub)

Notas de segurança
- O cookie de refresh é HttpOnly e SameSite=Strict; em produção usa também Secure.
- O cliente nunca persiste refresh_token; apenas mantém access_token em memória.
- Interceptação de 401 faz refresh automático via `/api/refresh` quando necessário.

Aviso automático na página
- A SPA testa `/api/health` ao carregar. Se as funções serverless não estiverem rodando, exibe um alerta sugerindo usar `vercel dev` (ou verificar deploy/variáveis em produção).
