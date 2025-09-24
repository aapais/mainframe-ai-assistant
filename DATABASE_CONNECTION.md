# Informações de Conexão PostgreSQL

## ⚠️ CREDENCIAIS CORRETAS ATUALIZADAS

## Dados de Conexão
- **Host:** localhost
- **Porta:** 5432
- **Database:** mainframe_ai  ← NOME CORRETO DA BASE DE DADOS
- **Usuário:** mainframe_user
- **Senha:** your_secure_password_123

## String de Conexão
```
postgresql://mainframe_user:your_secure_password_123@localhost:5432/mainframe_ai
```

## Tabelas Principais
- `knowledge_base` - Base de conhecimento (232 entradas)
- `chat_history` - Histórico de conversas
- `user_preferences` - Preferências dos usuários
- `audit_logs` - Logs de auditoria
- `incident_tickets` - Tickets de incidentes

## Comandos PostgreSQL úteis

### Conectar via terminal
```bash
psql -U admin -d mainframe_assistant -h localhost
```

### Ver todas as tabelas
```sql
\dt
```

### Ver estrutura da tabela knowledge_base
```sql
\d knowledge_base
```

### Contar entradas
```sql
SELECT COUNT(*) FROM knowledge_base;
```

### Ver primeiras 10 entradas
```sql
SELECT uuid, title, category FROM knowledge_base LIMIT 10;
```

## Ferramentas Recomendadas

### pgAdmin 4 (Gratuito)
1. Instalar: `sudo apt install pgadmin4`
2. Ou baixar de: https://www.pgadmin.org/
3. Adicionar servidor com os dados acima

### DBeaver (Gratuito)
1. Download: https://dbeaver.io/
2. Nova conexão PostgreSQL
3. Inserir dados de conexão acima

### TablePlus
1. Download: https://tableplus.com/
2. Create new connection > PostgreSQL
3. Usar dados acima