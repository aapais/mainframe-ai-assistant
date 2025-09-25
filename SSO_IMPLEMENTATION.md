# 🔐 Sistema SSO - Implementação Completa

## ✅ Status da Implementação

### Componentes Instalados:
- ✅ **Dependências NPM**: pg, bcryptjs, jsonwebtoken, helmet, express-rate-limit, winston, zod
- ✅ **Tabelas PostgreSQL**: users, sso_configurations, user_sessions, encrypted_api_keys, audit_logs, security_events
- ✅ **Código SSO**: Sistema completo em `/src/auth/`
- ✅ **Integração**: Módulo de integração em `/src/backend/sso-integration.js`

## 📋 Tabelas Criadas no PostgreSQL

```sql
- users                 # Gestão de utilizadores
- sso_configurations    # Configurações OAuth/SSO
- user_sessions        # Sessões ativas
- encrypted_api_keys   # Chaves API encriptadas (AES-256-GCM)
- audit_logs          # Logs de auditoria
- security_events     # Eventos de segurança
```

## 🚀 Como Usar

### 1. Configurar Ambiente

```bash
# Copiar arquivo de configuração
cp .env.example .env

# Editar .env com suas credenciais
nano .env
```

### 2. Configurar Provedores OAuth

No arquivo `.env`, configure:

```env
# Google OAuth
GOOGLE_CLIENT_ID=seu-client-id-aqui
GOOGLE_CLIENT_SECRET=seu-secret-aqui

# Microsoft Azure AD
AZURE_CLIENT_ID=seu-client-id-aqui
AZURE_CLIENT_SECRET=seu-secret-aqui
AZURE_TENANT_ID=seu-tenant-id

# Chaves de Segurança (IMPORTANTE: Mude estas!)
JWT_SECRET=uma-chave-secreta-muito-forte
ENCRYPTION_KEY=chave-de-32-bytes-para-encriptacao
```

### 3. Integrar no Servidor Existente

O sistema SSO já está integrado em `/src/backend/enhanced-server.js`. Para ativar:

```javascript
// No seu servidor principal, adicione:
const SSOIntegration = require('./sso-integration');

// Após conectar ao PostgreSQL:
const sso = new SSOIntegration(app, dbConnection);
await sso.initialize();
```

### 4. Iniciar o Servidor

```bash
# Opção 1: Servidor enhanced com SSO
npm run start:backend:enhanced

# Opção 2: Criar novo script no package.json
"sso:server": "node src/backend/enhanced-server.js"
```

## 🔑 Endpoints Disponíveis

### Autenticação
- `POST /api/auth/login` - Login tradicional
- `POST /api/auth/register` - Registro de novo usuário
- `POST /api/auth/logout` - Logout
- `GET /api/auth/status` - Status da autenticação

### SSO
- `GET /api/auth/sso/google` - Login com Google
- `GET /api/auth/sso/microsoft` - Login com Microsoft
- `GET /api/auth/sso/google/callback` - Callback Google
- `GET /api/auth/sso/microsoft/callback` - Callback Microsoft

### Gestão de Usuários
- `GET /api/users/profile` - Perfil do usuário
- `PUT /api/users/profile` - Atualizar perfil
- `GET /api/users/api-keys` - Listar chaves API
- `POST /api/users/api-keys` - Criar chave API
- `DELETE /api/users/api-keys/:id` - Remover chave API

### Admin (requer role: admin)
- `GET /api/admin/system/status` - Status do sistema
- `GET /api/admin/users` - Listar todos usuários
- `GET /api/admin/security/events` - Eventos de segurança

## 🔐 Recursos de Segurança

### Encriptação
- **Chaves API**: AES-256-GCM com IV único por chave
- **Senhas**: bcrypt com salt rounds configurável
- **Tokens JWT**: Assinados com HS256

### Proteções
- ✅ Rate limiting (100 req/15min por IP)
- ✅ Helmet.js para headers de segurança
- ✅ CORS configurado
- ✅ SQL Injection protection (prepared statements)
- ✅ XSS protection
- ✅ CSRF protection via tokens
- ✅ Audit logging completo
- ✅ Detecção de atividade suspeita

### Middleware Stack
1. `SecurityMiddleware` - Headers de segurança
2. `RateLimitMiddleware` - Limite de requisições
3. `AuthenticationMiddleware` - Validação JWT
4. `RBACMiddleware` - Controle de acesso por roles
5. `PermissionMiddleware` - Verificação de permissões
6. `AuditMiddleware` - Log de todas ações
7. `ValidationMiddleware` - Validação de input
8. `ErrorHandler` - Tratamento seguro de erros
9. `CacheMiddleware` - Cache inteligente
10. `SessionManager` - Gestão de sessões

## 👤 Credenciais Padrão

**Admin Account:**
- Email: `admin@mainframe.local`
- Password: `Admin@123456`

⚠️ **IMPORTANTE**: Mude a senha do admin imediatamente após o primeiro login!

## 📊 Estrutura de Arquivos

```
/src/auth/
├── services/
│   └── SecureKeyManager.ts    # Gestão de chaves encriptadas
├── sso/
│   └── SSOService.ts          # Serviço principal SSO
├── middleware/
│   ├── AuthMiddleware.ts      # Autenticação JWT
│   ├── RBACMiddleware.ts      # Controle de acesso
│   └── MiddlewareComposer.ts  # Composição de middleware
└── schemas/
    └── UserSchema.ts          # Validação com Zod

/src/backend/
├── sso-integration.js         # Integração com servidor
└── enhanced-server.js         # Servidor com SSO

/src/api/routes/
├── auth.js                    # Rotas de autenticação
├── auth/sso.js               # Rotas SSO
└── users/users.js            # Gestão de usuários
```

## 🧪 Testar o Sistema

### 1. Verificar Instalação
```bash
node scripts/final-sso-migration.js
```

### 2. Testar Autenticação
```bash
# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@mainframe.local","password":"Admin@123456"}'

# Status
curl http://localhost:3001/api/auth/status
```

### 3. Testar SSO
Acesse no navegador:
- Google: http://localhost:3001/api/auth/sso/google
- Microsoft: http://localhost:3001/api/auth/sso/microsoft

## 📝 Scripts Úteis

Adicione ao `package.json`:

```json
{
  "scripts": {
    "sso:migrate": "node scripts/final-sso-migration.js",
    "sso:server": "node src/backend/enhanced-server.js",
    "sso:test": "curl http://localhost:3001/api/auth/status"
  }
}
```

## 🚨 Troubleshooting

### Erro: "Cannot find module 'pg'"
```bash
cd sso-deps && npm install
cp -r node_modules/* ../node_modules/
```

### Erro: "relation does not exist"
```bash
node scripts/final-sso-migration.js
```

### Erro: "Permission denied"
```bash
chmod 755 scripts/*.js
chmod 755 scripts/*.sh
```

## 📚 Referências

- [OAuth 2.0 RFC](https://tools.ietf.org/html/rfc6749)
- [OpenID Connect](https://openid.net/connect/)
- [JWT.io](https://jwt.io/)
- [OWASP Authentication Cheatsheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)

## ✅ Checklist de Produção

- [ ] Mudar senha do admin
- [ ] Configurar OAuth real (não localhost)
- [ ] Ativar HTTPS
- [ ] Configurar backup do PostgreSQL
- [ ] Monitorar logs de segurança
- [ ] Configurar alertas para eventos críticos
- [ ] Revisar rate limits
- [ ] Testar recuperação de senha
- [ ] Implementar 2FA (opcional)
- [ ] Configurar CDN para assets

---

**Sistema SSO implementado com sucesso!** 🎉

Para suporte: Consulte os logs em `/src/monitoring/` ou eventos de segurança na tabela `security_events`.