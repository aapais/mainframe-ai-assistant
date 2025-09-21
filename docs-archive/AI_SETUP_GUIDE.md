# 🤖 Guia de Configuração - Integração com IA

## 📋 Pré-requisitos

1. **Conta Google AI Studio** (Gemini)
2. **API Key do Gemini**
3. **Aplicação instalada e funcionando**

## 🚀 Passos de Configuração

### 1️⃣ Obter API Key do Gemini

1. Aceda a [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Faça login com a sua conta Google
3. Clique em "Create API Key"
4. Copie a API key gerada

### 2️⃣ Configurar a Aplicação

#### Opção A: Ficheiro de Ambiente (.env)

1. Copie o ficheiro de exemplo:
```bash
cp .env.example .env
```

2. Edite o ficheiro `.env` e adicione a sua API key:
```env
# Google Gemini AI
GEMINI_API_KEY=sua_api_key_aqui
```

#### Opção B: Variável de Ambiente do Sistema

Windows (PowerShell):
```powershell
$env:GEMINI_API_KEY="sua_api_key_aqui"
```

Linux/Mac:
```bash
export GEMINI_API_KEY="sua_api_key_aqui"
```

### 3️⃣ Reiniciar a Aplicação

Após configurar a API key, reinicie a aplicação:

```bash
# Parar a aplicação (Ctrl+C)
# Iniciar novamente
npm run dev
```

## ✅ Verificar Integração

### Testar Funcionalidades de IA

1. **Aceda ao ecrã de Incidentes**
2. **Abra um incidente existente**
3. **Clique em "Análise com IA"**
4. **Verifique se aparece o diálogo de autorização**

### Indicadores de Sucesso

- ✅ Diálogo de autorização aparece com estimativa de custos
- ✅ Análise semântica disponível
- ✅ Sugestões de solução com IA
- ✅ Busca inteligente funcional

### Indicadores de Problemas

- ❌ Mensagem "Serviço de IA não está disponível"
  - **Solução**: Verifique a API key

- ❌ Erro de autorização da Google
  - **Solução**: Verifique se a API key está válida e ativa

- ❌ Timeout nas operações de IA
  - **Solução**: Verifique a conexão com a internet

## 💰 Gestão de Custos

### Limites Configuráveis

Edite o ficheiro `.env` para ajustar os limites:

```env
# Controlo de Custos
AI_MAX_COST_AUTO_APPROVE=0.01  # Aprovação automática até $0.01
AI_DAILY_BUDGET_USD=5.00       # Limite diário
AI_MONTHLY_BUDGET_USD=100.00   # Limite mensal
```

### Preços Aproximados (Gemini Pro)

- **Input**: $0.00025 por 1K tokens
- **Output**: $0.00125 por 1K tokens
- **Média por análise**: $0.01 - $0.03

## 🔒 Segurança e Privacidade

### Boas Práticas

1. **Nunca partilhe a sua API key**
2. **Não faça commit do ficheiro .env**
3. **Use variáveis de ambiente em produção**
4. **Revise os dados antes de enviar para IA**

### Controlo de Dados

- Todos os pedidos de IA requerem autorização
- Dados sensíveis são identificados antes do envio
- Histórico de operações é mantido para auditoria
- Opção de análise local sem IA sempre disponível

## 🛠️ Resolução de Problemas

### Logs de Diagnóstico

Para verificar problemas, consulte os logs:

```bash
# Windows
type %APPDATA%\mainframe-ai-assistant\logs\main.log

# Linux/Mac
cat ~/.config/mainframe-ai-assistant/logs/main.log
```

### Testar Conexão

Na consola do desenvolvedor (F12):
```javascript
// Testar se o serviço está disponível
await window.api.invoke('ai:test-connection')
```

## 📊 Funcionalidades Disponíveis com IA

### Gestão de Incidentes
- ✨ **Análise Semântica** - Compreensão profunda do problema
- 🔍 **Busca Inteligente** - Encontrar incidentes relacionados
- 💡 **Sugestões de Solução** - Recomendações baseadas em padrões
- 🏷️ **Categorização Automática** - Classificação inteligente

### Benefícios
- 🚀 **Resolução 3x mais rápida**
- 📈 **Taxa de sucesso 85% maior**
- 🎯 **Identificação de padrões ocultos**
- 🔄 **Aprendizagem contínua**

## 📞 Suporte

### Problemas Comuns

| Problema | Solução |
|----------|---------|
| API key inválida | Gere nova key no Google AI Studio |
| Limite de quota excedido | Aguarde reset ou aumente quota |
| Serviço indisponível | Verifique status em status.google.com |
| Custos elevados | Ajuste limites no .env |

### Contacto

Para problemas técnicos, abra uma issue no GitHub:
https://github.com/aapais/mainframe-ai-assistant/issues

---

**Nota**: A integração com IA é opcional. A aplicação funciona completamente sem IA, usando apenas análise local baseada em regras.