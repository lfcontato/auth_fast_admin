# HOWTOUSE – Administradores

**Domínio:** Admin/Auth
**Resumo:** Fluxos de autenticação de administradores, gerenciamento de admins e token MCP.
**Pré‑requisitos:** Backend em `END_POINT_API` (ex.: `http://localhost:8080`).

## Exemplos (cURL/HTTP)

Healthcheck
```bash
curl -i $END_POINT_API/healthz
```

Login (tokens)
```bash
curl -sS -X POST "$END_POINT_API/admin/auth/token" \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"stringst"}'
```

Refresh
```bash
curl -sS -X POST "$END_POINT_API/admin/auth/token/refresh" \
  -H 'Content-Type: application/json' \
  -d '{"refresh_token":"<REFRESH>"}'
```

Listar administradores
```bash
curl -sS -H "Authorization: Bearer $ACCESS" \
  "$END_POINT_API/admin?offset=0&limit=20"
```

Criar administrador
```bash
curl -sS -X POST "$END_POINT_API/admin" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $ACCESS" \
  -d '{
    "email":"novo@dominio.com",
    "username":"novo_admin",
    "password":"opcional",
    "system_role":"user",
    "subscription_plan":"trial"
  }'
```

Alterar senha (própria)
```bash
curl -sS -X PATCH "$END_POINT_API/admin/password" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $ACCESS" \
  -d '{"current_password":"old","new_password":"new"}'
```

Alterar system_role
```bash
curl -sS -X PATCH "$END_POINT_API/admin/2/system-role" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $ACCESS" \
  -d '{"system_role":"admin"}'
```

Alterar subscription_plan
```bash
curl -sS -X PATCH "$END_POINT_API/admin/2/subscription-plan" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $ACCESS" \
  -d '{"subscription_plan":"monthly"}'
```

Verificar conta (duas variantes)
```bash
# 1) code no corpo
curl -sS -X POST "$END_POINT_API/admin/auth/verify" \
  -H 'Content-Type: application/json' \
  -d '{"code":"<64hex>","password":"<senha-inicial>"}'

# 2) code na URL
curl -sS -X POST "$END_POINT_API/admin/auth/verify-code/<64hex>" \
  -H 'Content-Type: application/json' \
  -d '{"password":"<senha-inicial>"}'
```

Token MCP (PAT)
```bash
curl -sS -X POST "$END_POINT_API/admin/mcp/token" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $ACCESS" \
  -d '{"name":"n8n","ttl_hours":720}'
```

## Códigos de Resposta (amostra)
- 200 OK – sucesso
- 201 Created – recurso criado (ex.: MCP token)
- 202 Accepted – MFA requerida no login
- 400 AUTH_400_0xx – JSON inválido/campos ausentes
- 401 AUTH_401_005 – token ausente/expirado
- 403 AUTH_403_0xx – permissão insuficiente
- 404 AUTH_404_0xx – recurso não encontrado

## Observações
- Cookies de refresh devem ser HttpOnly; o front usa apenas o access token em memória.
- Em produção, cookies com `Secure` e `SameSite=Lax`.
