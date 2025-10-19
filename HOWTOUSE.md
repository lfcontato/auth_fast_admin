Arquivo: HOWTOUSE.md
Resumo: Guia completo e descritivo de consumo da API (autenticação, endpoints, formatos de requisição e resposta, exemplos e boas práticas). Adequado para uso por agentes/IA e integradores.

# Visão Geral

Esta API implementa autenticação via JWT com fluxo de Access Token (curta duração) e Refresh Token (longa duração). Endpoints atuais permitem:
- Verificação de saúde do serviço.
- Login de administrador (username/password) e emissão de tokens.
- Renovação de tokens (rotação de refresh token).

Outros recursos (CRUD de administradores, verificação de conta, recuperação de senha, bloqueios, ACL por papéis) constam no README e serão adicionados em fases futuras. Este documento descreve em detalhes como autenticar e consumir os endpoints disponíveis hoje, com notas para os endpoints planejados.

# Bases de URL

- Ambiente local (servidor de desenvolvimento):
  - Base: `http://localhost:8080`
- Ambiente Vercel (serverless, com rewrites):
  - Base: `https://<seu-projeto>.vercel.app/api`

As rotas documentadas abaixo assumem a base local. Em Vercel, prefixe com `/api` se necessário (ex.: `/api/admin/auth/token`).

# Autenticação e Tokens

- Login retorna dois tokens:
  - `access_token`: JWT assinado (HS256), válido por tempo curto (default 1800s).
  - `refresh_token`: token opaco aleatório, válido por tempo maior (default 2592000s) e rotacionado a cada refresh.
- Para rotas protegidas, envie o Access Token no cabeçalho HTTP:
  - `Authorization: Bearer <ACCESS_TOKEN>`
- Quando o Access expirar, use o Refresh no endpoint de refresh para obter novo par de tokens. O refresh anterior é revogado (rotação) e um novo é emitido.

## Conteúdo do JWT (Access Token)

O payload do JWT inclui, no mínimo:
- `sub`: Identificador do sujeito, formato `"admin|<id>"`.
- `sid`: ID da sessão (para auditoria/possível revogação futura).
- `sro`: Papel global de sistema (ex.: `root`, `admin`).
- `wss`: Mapa de papéis por workspace (futuro; hoje retorna vazio `{}`).
- `exp`: Época de expiração em segundos.

Assinatura: HS256 usando `SECRET_KEY` do servidor.

# Formato de Erros

Respostas de erro seguem um envelope consistente:
```json
{
  "success": false,
  "code": "AUTH_401_001",
  "message": "Descrição do erro",
  "locale_key": "error.not_implemented" (opcional),
  "path": "/rota" (quando 404)
}
```

Exemplos de códigos já utilizados:
- `AUTH_400_001`: JSON inválido no login
- `AUTH_400_002`: refresh_token ausente
- `AUTH_401_001`: credenciais inválidas/nao autorizadas no login
- `AUTH_401_002`: refresh inválido/nao autorizado
- `HTTP_404`: rota não encontrada

# Endpoints Atuais

## Health Check
- Método: GET
- Rota: `/healthz`
- Autenticação: Não necessária
- 200 OK
  - Corpo:
  ```json
  {"ok": true, "service": "auth_fast_api", "status": "healthy"}
  ```

## Login de Administrador
- Método: POST
- Rota: `/admin/auth/token`
- Autenticação: Não necessária
- Corpo (JSON):
  ```json
  {"username": "<string>", "password": "<string>"}
  ```
- 200 OK
  - Corpo:
  ```json
  {"success": true, "access_token": "<jwt>", "refresh_token": "<opaque>"}
  ```
- 400 Bad Request: JSON inválido
- 401 Unauthorized: credenciais inválidas

Exemplo curl:
```
curl -X POST http://localhost:8080/admin/auth/token \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"stringst"}'
```

## Renovação de Tokens (Refresh)
- Método: POST
- Rota: `/admin/auth/token/refresh`
- Autenticação: Não necessária (usa token opaco de refresh no corpo)
- Corpo (JSON):
  ```json
  {"refresh_token": "<opaque>"}
  ```
- 200 OK
  - Corpo:
  ```json
  {"success": true, "access_token": "<jwt>", "refresh_token": "<opaque>"}
  ```
- 400 Bad Request: body ausente/malformado
- 401 Unauthorized: refresh inválido/expirado/revogado

Exemplo curl:
```
curl -X POST http://localhost:8080/admin/auth/token/refresh \
  -H 'Content-Type: application/json' \
  -d '{"refresh_token":"<REFRESH_TOKEN_DO_LOGIN>"}'
```

# Fluxo Recomendado para Clientes/IA
1. Efetue login com `username` e `password` e armazene `access_token` e `refresh_token` de forma segura.
2. Para chamadas a recursos protegidos, envie `Authorization: Bearer <access_token>`.
3. Ao receber 401 por expiração do access, chame o endpoint de refresh com o `refresh_token` atual, substitua ambos os tokens pelo novo par e repita a chamada original.
4. Nunca reutilize um refresh já rotacionado (ele é revogado após o uso com sucesso).

# Exemplos com REST Client (VS Code)

Arquivos prontos em `tests/`:
- `tests/health.http` – GET `/healthz`.
- `tests/auth.http` – fluxo de login e refresh, lendo `ROOT_AUTH_USER` e `ROOT_AUTH_PASSWORD` do `.env` via `{{$dotenv ...}}`.

Passos:
1) Inicie a API: `go run ./cmd/server`
2) Abra `tests/auth.http` e clique em “Send Request” no bloco `@login`, depois no bloco `@refresh`.

# Ambiente e Configuração

- Banco de dados padrão: SQLite (arquivo `database_test.db`).
- Mudar para Postgres: defina `DATABASE_URL` como `postgres://user:pass@host:port/dbname?sslmode=disable`.
- Variáveis relevantes:
  - `SECRET_KEY` (HS256)
  - `TOKEN_ACCESS_EXPIRE_SECONDS` (default 1800)
  - `TOKEN_REFRESH_EXPIRE_SECONDS` (default 2592000)
  - `ROOT_AUTH_USER`, `ROOT_AUTH_EMAIL`, `ROOT_AUTH_PASSWORD` (seed do usuário root na primeira execução)

# Endpoints Planejados (Não implementados ainda)

Os itens abaixo constam no README e serão expandidos. Interfaces e semântica previstas:

- Verificação e recuperação de conta (rotas `/admin/auth/verify`, `/admin/auth/verify-link`, `/admin/auth/password-recovery`, `/admin/auth/verification-code`).
  - Objetivo: confirmar e-mail, reenviar código, iniciar e concluir recuperação de senha.
- Gerenciamento hierárquico de administradores (`/admin/` CRUD e detalhes, alteração de senha/e-mail próprios).
  - Regras por `system_role` (guest < user < admin < root) e prevenção de operações em papéis superiores.
- Bloqueios e segurança (`/admin/unlock`, `/admin/unlock/all`).
  - Consultar e remover bloqueios (rate limit, tentativas malsucedidas), com autorização adequada.

Quando estes endpoints forem disponibilizados, utilizarão `Authorization: Bearer <ACCESS_TOKEN>` e respostas com envelope padronizado (`success`, `code`, `message`).

# Boas Práticas

- Proteja os tokens: armazene `refresh_token` em local seguro (ex.: armazenamento seguro do servidor/cliente), evite expô-lo em logs.
- Renove tokens próximo do vencimento do `access_token` para minimizar falhas por expiração.
- Trate códigos 4xx/5xx com retentativas prudentes e backoff quando apropriado.
- Não compartilhe `SECRET_KEY` do servidor. A validação do JWT pelo cliente é opcional; caso deseje validar, use HS256 e a chave compartilhada conforme seu contexto de confiança.

# Compatibilidade

- Local: `go run ./cmd/server` expõe `http://localhost:8080`.
- Vercel: `vercel dev` expõe `/api/...` com o mesmo handler (recomenda-se preferir chamadas via `/api`).

