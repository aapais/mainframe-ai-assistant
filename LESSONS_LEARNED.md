# Lições Aprendidas - Persistência de Configurações

## Data: 2025-09-25

### Problema Identificado
As configurações do usuário (nome, email, tema, idioma, configurações avançadas) não estavam sendo persistidas entre sessões de login/logout.

### Causas Raiz

1. **Inconsistência de Props nos Modais**
   - Alguns modais recebiam `user` como prop, outros recebiam `userId`
   - Fallback para valores hardcoded (userId = 1) causando problemas

2. **Conflito de Rotas no Backend**
   - Router duplicado em `settings-api.js` com validação incorreta
   - Validação esperava userId numérico mas recebia UUID string

3. **Tratamento Incorreto de Dados Complexos**
   - Campo `notifications` no banco era boolean mas tentávamos salvar objeto
   - Settings avançadas não eram incluídas no `settings_json`

4. **Métodos HTTP Inconsistentes**
   - Frontend usando PUT mas backend esperando POST
   - SettingsService não sincronizado com endpoints do backend

### Soluções Implementadas

1. **Padronização de Props**
   ```javascript
   // Modais agora aceitam ambos user e userId
   const effectiveUserId = userId || (user && user.id);
   ```

2. **Correção do Backend**
   - Removido router conflitante de `settings-api.js`
   - Notificações complexas salvas em `settings_json`
   - Parse correto de `settings_json` no login

3. **Sincronização Frontend-Backend**
   - Todos os modais usando POST para salvar
   - AdvancedSettingsModal fazendo chamadas diretas ao backend
   - Cache local atualizado após salvamento

4. **Estrutura de Dados**
   ```sql
   -- user_preferences table
   notifications: boolean (simples)
   settings_json: jsonb (dados complexos incluindo notifications objeto)
   ```

### Arquivos Principais Modificados

- `/src/backend/postgresql-only-server.js` - Correções no login e settings endpoints
- `/src/components/menu-modals.js` - Padronização de props e métodos
- `/src/components/advanced-settings-modal.js` - Chamadas diretas ao backend
- `/src/utils/settings-integration.js` - Suporte para ambos formats de resposta
- `/index.html` - Correção de props passadas aos modais

### Testes Realizados

1. Login/logout com verificação de persistência
2. Salvamento de todas as categorias de settings
3. Verificação de dados complexos (notifications objeto)
4. Teste de configurações avançadas (API keys, etc.)

### Melhores Práticas Identificadas

1. **Sempre usar IDs únicos** - Evitar fallbacks para valores hardcoded
2. **Padronizar interfaces** - Componentes devem aceitar múltiplos formatos de props
3. **Validação adequada** - Verificar tipo de dados esperado (UUID vs numeric)
4. **Estrutura flexível** - Usar campos JSON para dados complexos que podem evoluir
5. **Logs úteis** - Adicionar logs durante desenvolvimento para debug

### Problemas Pendentes

- Configurações avançadas precisam de melhor estruturação no frontend
- Considerar migração completa para TypeScript para evitar erros de tipo
- Adicionar testes automatizados para persistência de dados

### Comandos Úteis para Debug

```bash
# Verificar dados no PostgreSQL
psql -h localhost -U postgres -d mainframe_ai -c "SELECT * FROM user_preferences;"

# Testar endpoints
curl -X POST http://localhost:3001/api/settings/[userId] -H "Content-Type: application/json" -d '{...}'

# Verificar logs do servidor
npm run start:postgres
```

### Conclusão

A persistência de configurações agora está funcionando corretamente para todos os tipos de dados. A solução envolveu correções tanto no frontend quanto no backend, com foco em padronização e tratamento adequado de dados complexos.