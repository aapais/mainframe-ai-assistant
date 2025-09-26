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

---

## Data: 2025-09-26

### Sistema de Chunking de Documentos

**Problema**: Documentos grandes (>35KB) excediam o limite de 36KB da API Gemini, impedindo a geração de embeddings.

**Solução**:
- Sistema inteligente de chunking com chunks de 30KB + 500 caracteres de sobreposição
- Documentos >35KB armazenados sem embeddings na tabela `knowledge_base`
- Chunks armazenados com embeddings individuais na tabela `document_chunks`
- Cada chunk mantém referência ao documento pai via foreign key `document_id`

**Correção Crítica**:
- Arquivo: `src/backend/document-processor-api.js:278`
- Deve usar `RETURNING id` (não `RETURNING uuid`) para referência correta do document_id

### Autenticação SSO de Usuários

**Problema**: SSO criando usuários duplicados devido ao hostname dinâmico nos endereços de email.

**Solução**:
- Formato de email fixado para sempre usar `@local.local` em vez do hostname dinâmico
- Usuários identificados APENAS pelo campo email
- Campo email tornado read-only nas configurações
- Arquivos: `WindowsAuthService.js:48`, tratamento SSO no `postgresql-only-server.js`

### Gestão de API Keys

**Problema**: API keys não estavam sendo criptografadas corretamente, incompatibilidade entre métodos de armazenamento e recuperação.

**Solução**:
- Uso consistente de `crypto-service.js` para criptografia AES-256-GCM
- API keys armazenadas criptografadas por usuário na tabela `user_api_keys`
- Sempre verificar que criptografia/descriptografia usa o mesmo método

### Autenticação em Formulários Multipart

**Problema**: Header Authorization não enviado com uploads de arquivos devido a limitações do multipart/form-data.

**Solução**:
- Enviar token JWT via FormData como campo `authToken`
- Middleware customizado após o multer processar o upload
- Arquivo: `document-processor-api.js` - middleware `authenticateUpload`

### Pesquisa Vetorial com pgvector

**Problema**: Pesquisa vetorial aparecendo como desabilitada apesar do pgvector 0.8.1 instalado.

**Solução**:
- Consultar tabela `pg_extension` em vez de `pg_available_extensions`
- Suporte para embeddings multi-provider:
  - OpenAI (1536D)
  - Gemini (768D)
  - Anthropic (1024D)
- Pesquisa combina resultados das tabelas `knowledge_base` e `document_chunks`

### Arquitetura e Performance

**Decisões de Arquitetura**:
1. **Armazenamento Híbrido**: Documentos pequenos com embeddings inline, documentos grandes usam chunking
2. **Suporte Multi-Provider**: Sistema suporta múltiplos providers de embedding simultaneamente
3. **Consistência SSO**: Email como fonte única de verdade para identificação do usuário
4. **Segurança Primeiro**: Todas as API keys criptografadas em repouso com AES-256-GCM

**Melhorias de Performance**:
- Chunking permite processamento de documentos arbitrariamente grandes
- Índices HNSW nas colunas de vetores para busca rápida por similaridade
- Geração paralela de embeddings para múltiplos providers
- Chunking inteligente preserva contexto com sobreposição de 500 caracteres