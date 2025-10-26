# Guia de Administradores (Rotas + cURL)

Use estes exemplos para validar os fluxos de administrador em ambiente local.

Pré‑requisitos
- Backend rodando em `http://localhost:8080` (ou ajuste `END_POINT_API` no `.env`).
- Seed opcional do admin root: `ROOT_AUTH_USER`, `ROOT_AUTH_EMAIL`, `ROOT_AUTH_PASSWORD`.

Healthcheck
- GET `/healthz`
- curl -i http://localhost:8080/healthz

Login (obter tokens)
- POST `/admin/auth/token`
- Body: { "username": "<user>", "password": "<pass>" }
- curl -sS -X POST http://localhost:8080/admin/auth/token -H 'Content-Type: application/json' -d '{"username":"admin","password":"stringst"}'

Refresh
- POST `/admin/auth/token/refresh`
- Body: { "refresh_token": "<refresh>" }

Listar administradores
- GET `/admin?offset=0&limit=20` (Authorization: Bearer <access>)
- curl -sS -H "Authorization: Bearer $ACCESS" http://localhost:8080/admin

Criar administrador
- POST `/admin` (Authorization: Bearer)
- Body: { "email":"x@x.com","username":"novo","password":"opcional","system_role":"user","subscription_plan":"trial" }

Alterar senha (própria)
- PATCH `/admin/password` (Authorization: Bearer)
- Body: { "current_password":"old","new_password":"new" }

Alterar system_role
- PATCH `/admin/{admin_id}/system-role` (Authorization: Bearer)
- Body: { "system_role":"admin" }

Alterar subscription_plan
- PATCH `/admin/{admin_id}/subscription-plan` (Authorization: Bearer)
- Body: { "subscription_plan":"monthly" }

Verificação de conta
- POST `/admin/auth/verify` (body com code+password)
- POST `/admin/auth/verify-code/{code}` (code na URL; body { password })

Token MCP (PAT)
- POST `/admin/mcp/token` (Authorization: Bearer)
- Body opcional: { "name":"n8n", "ttl_hours": 720 }
