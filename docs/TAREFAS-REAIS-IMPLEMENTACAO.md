# 📋 LISTA ATUALIZADA DE TAREFAS REAIS A IMPLEMENTAR

**Data:** 23/09/2025
**Status:** Análise Completa
**Versão:** 2.0 - Corrigida

---

## ✅ JÁ IMPLEMENTADO (Não fazer)

1. **API Settings no Menu Configurações** ✅
   - SettingsModal existe (linha 507-673)
   - API Key e Provider LLM já configuráveis
   - Armazenamento em localStorage funcional

2. **Toggle "Usar IA"** ✅
   - Campo `useAI` já existe no SettingsModal (linha 538)
   - Checkbox "Habilitar análise automática com IA"

3. **Botão "Analisar com IA"** ✅
   - Renomeado de "Mostrar Tratamento" (linha 316)
   - Texto: "🤖 Analisar com IA"

4. **Backend Básico** ✅
   - simple-backend.js funcionando
   - Integração com SQLite via Python

5. **Dashboard com Métricas** ✅
   - Cards de estatísticas
   - Normalização de status implementada

---

## ❌ FALTA IMPLEMENTAR (Tarefas Reais)

### **FASE 1: Campos de Contexto (2-3 horas)**

#### 1.1 Adicionar Campos no CreateIncidentModal
**Arquivo:** `Accenture-Mainframe-AI-Assistant-Integrated.html`
**Linha:** ~680-690 (após description)

```javascript
// Adicionar no estado inicial (linha ~681)
technical_area: '',      // OBRIGATÓRIO
business_area: '',       // OPCIONAL - inferido pelo sistema
mainframe_job: '',       // Campo específico quando technical_area = 'Mainframe'
mainframe_program: '',
mainframe_abend: '',
java_class: '',          // Campo específico quando technical_area = 'Java'
java_exception: '',
```

**UI a adicionar após campo description:**
- Dropdown `technical_area` com opções: Mainframe, Java, C#, Database, Network
- Dropdown `business_area` com opções: Pagamentos, Cobrança, Cadastro, Compliance
- Campos dinâmicos baseados em `technical_area`

---

### **FASE 2: Lógica de Inferência (1-2 horas)**

#### 2.1 Criar Serviço de Inferência
**Novo arquivo:** `/mnt/c/mainframe-ai-assistant/scripts/inference-service.js`

```javascript
// Inferir área de negócio baseado em keywords
function inferBusinessArea(incident) {
  const text = `${incident.title} ${incident.description}`.toLowerCase();

  if (text.includes('pagamento') || text.includes('pix') || text.includes('ted'))
    return 'Pagamentos';
  if (text.includes('cobrança') || text.includes('boleto') || text.includes('débito'))
    return 'Cobrança';
  // etc...

  return '';
}
```

---

### **FASE 3: Serviços de IA (2-3 dias)**

#### 3.1 Serviço de Sanitização
**Novo arquivo:** `/mnt/c/mainframe-ai-assistant/scripts/data-sanitizer.js`

- Patterns para CPF, conta bancária, cartão
- Método `sanitize(data)` - substitui dados sensíveis
- Método `restore(data, mapping)` - restaura após IA
- Auditoria de dados sanitizados

#### 3.2 Integração LLM
**Novo arquivo:** `/mnt/c/mainframe-ai-assistant/scripts/llm-service.js`

```javascript
class LLMService {
  async analyzeIncident(incident, provider, apiKey) {
    // Sanitizar dados
    const sanitized = await dataSanitizer.sanitize(incident);

    // Chamar LLM apropriado
    let result;
    switch(provider) {
      case 'gemini':
        result = await this.callGemini(sanitized, apiKey);
        break;
      case 'openai':
        result = await this.callOpenAI(sanitized, apiKey);
        break;
      // etc...
    }

    // Restaurar dados
    return dataSanitizer.restore(result, sanitized.mapping);
  }
}
```

#### 3.3 Serviço de Enriquecimento
**Novo arquivo:** `/mnt/c/mainframe-ai-assistant/scripts/enrichment-service.js`

- Integrar sanitização + LLM + restauração
- Adicionar campos: root_cause, solution, similar_incidents
- Gerenciar cache de resultados

---

### **FASE 4: Tela de Validação (1-2 dias)**

#### 4.1 Criar ValidationModal
**Adicionar em:** `Accenture-Mainframe-AI-Assistant-Integrated.html`
**Após CreateIncidentModal**

```javascript
const ValidationModal = ({ originalData, enrichedData, onConfirm, onEdit }) => {
  return (
    <div className="modal">
      <h2>Confirmar Dados do Incidente</h2>

      <div className="comparison-grid">
        <div className="original">
          <h3>Dados Originais</h3>
          {/* Mostrar campos originais */}
        </div>

        <div className="enriched">
          <h3>Dados Enriquecidos com IA</h3>
          {/* Mostrar campos enriquecidos, editáveis */}
        </div>
      </div>

      <button onClick={onConfirm}>Confirmar e Salvar</button>
      <button onClick={onEdit}>Editar</button>
    </div>
  );
};
```

#### 4.2 Integrar Fluxo
- Se `useAI === true` e dados enriquecidos → mostrar ValidationModal
- Se `useAI === false` → salvar direto

---

### **FASE 5: Backend Avançado (3-5 dias)**

#### 5.1 PostgreSQL + pgvector
**Novo arquivo:** `/mnt/c/mainframe-ai-assistant/scripts/database/schema.sql`

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE incidents_enhanced (
  id SERIAL PRIMARY KEY,
  title TEXT,
  description TEXT,
  technical_area VARCHAR(50) NOT NULL,
  business_area VARCHAR(50),
  embedding vector(1536),
  metadata JSONB
);

CREATE INDEX ON incidents_enhanced USING ivfflat (embedding vector_cosine_ops);
```

#### 5.2 Migração SQLite → PostgreSQL
**Novo arquivo:** `/mnt/c/mainframe-ai-assistant/scripts/migrate-db.js`

- Exportar dados do SQLite
- Gerar embeddings para busca vetorial
- Importar no PostgreSQL

#### 5.3 Busca Vetorial
**Novo arquivo:** `/mnt/c/mainframe-ai-assistant/scripts/vector-search.js`

```javascript
async function findSimilarIncidents(incident) {
  // Gerar embedding do incidente atual
  const embedding = await generateEmbedding(incident);

  // Busca vetorial com pesos
  const query = `
    SELECT *,
      (0.45 * business_area_match +
       0.25 * embedding_similarity +
       0.20 * error_code_match +
       0.10 * recency_score) as relevance
    FROM incidents_enhanced
    WHERE technical_area = $1
    ORDER BY relevance DESC
    LIMIT 10
  `;

  return await db.query(query, [incident.technical_area]);
}
```

---

## 📊 RESUMO DE ESFORÇO

| Fase | Tarefas | Esforço Real | Prioridade |
|------|---------|--------------|------------|
| **Fase 1** | Campos de contexto | 2-3 horas | ALTA |
| **Fase 2** | Inferência de área | 1-2 horas | ALTA |
| **Fase 3** | Serviços IA | 2-3 dias | ALTA |
| **Fase 4** | Tela validação | 1-2 dias | MÉDIA |
| **Fase 5** | PostgreSQL | 3-5 dias | BAIXA |

**Total Estimado:** 7-11 dias de desenvolvimento

---

## 🚀 QUICK WINS (Fazer Primeiro)

1. **Adicionar campos technical_area e business_area** (2h)
2. **Implementar inferência básica** (1h)
3. **Criar serviço de sanitização simples** (2h)
4. **Integrar com Gemini API** (3h)

Total Quick Wins: ~8 horas (1 dia)

---

## ⚠️ AVISOS IMPORTANTES

1. **NÃO reimplementar** o que já existe (API Settings, toggle IA, etc.)
2. **Começar pelos Quick Wins** para mostrar progresso rápido
3. **PostgreSQL pode ser adiado** - sistema funciona com SQLite
4. **Testar com dados reais** do banco para validar inferência

---

**Status:** Pronto para Implementação
**Próximo Passo:** Começar pela Fase 1 - Adicionar campos de contexto