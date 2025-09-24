# Findings da Sessão - Mainframe AI Assistant

## 📅 Data: 2025-09-24

## 🔧 Problemas Resolvidos

### 1. Document Processor - Upload de Ficheiros
**Problema**: Erro "uploadDocument is not defined" ao clicar no botão "Processar"
**Solução**: Mudança de `const uploadDocument` para `window.uploadDocument` para tornar a função globalmente acessível
**Arquivo**: `Accenture-Mainframe-AI-Assistant-Integrated.html:2342`

### 2. Validação de Arquivos Markdown
**Problema**: Ficheiros `.md` eram rejeitados com erro "tipo de arquivo não suportado"
**Causa**: Browsers reportam MIME type vazio ou `application/octet-stream` para ficheiros Markdown
**Solução**: Modificada lógica de validação para aceitar ficheiros com extensões conhecidas mesmo quando o MIME type é vazio/genérico
**Arquivo**: `Accenture-Mainframe-AI-Assistant-Integrated.html:2290-2308`

### 3. Migração SQLite → PostgreSQL
**Status**: Migração completa
**Ação**: Ficheiros SQLite movidos para `/old/sqlite-databases/`
**Base de Dados Ativa**: PostgreSQL

## 📊 Estado da Base de Dados PostgreSQL

### Configuração Correta
```
Database: mainframe_ai (NÃO mainframe_assistant!)
Host: localhost
Port: 5432
User: mainframe_user
Password: your_secure_password_123
```

### Dados
- **Tabela knowledge_base**: 232 entradas carregadas
- **Funcionalidade**: Document processor integrado e funcional
- **Upload via Frontend**: Funcionando para todos os tipos de ficheiro suportados

## 🛠️ Ferramentas de Acesso à BD
- **DBeaver**: Recomendado para Windows/WSL
- **pgAdmin 4**: Alternativa gratuita
- **Acesso**: WSL PostgreSQL acessível via localhost do Windows

## 📝 Arquivos Importantes Modificados
1. `/mnt/c/mainframe-ai-assistant/Accenture-Mainframe-AI-Assistant-Integrated.html`
   - Correção da função uploadDocument
   - Correção da validação de ficheiros

2. `/mnt/c/mainframe-ai-assistant/DATABASE_CONNECTION.md`
   - Credenciais corretas da BD documentadas

3. `/mnt/c/mainframe-ai-assistant/old/sqlite-databases/`
   - Ficheiros SQLite antigos arquivados

## ⚠️ Notas Importantes
- A aplicação usa `mainframe_ai` como nome da BD, NÃO `mainframe_assistant`
- PostgreSQL está rodando nativamente no WSL, não no Docker
- O document processor aceita agora todos os formatos incluindo Markdown (.md)

## 🎯 Próximos Passos Sugeridos
1. Backup regular da base de dados PostgreSQL
2. Monitoramento do crescimento da tabela knowledge_base
3. Considerar índices adicionais se performance degradar com mais dados