# Plano de Implementação - Sistema de Incidentes

## 📋 RESUMO EXECUTIVO

**Duração Total:** 12 semanas (3 meses)
**Equipe:** 2 Devs + 1 UX + 1 QA = 4 pessoas
**Esforço Total:** ~1.920 horas
**Status Atual:** 30% implementado (6/20 requisitos)

---

## 🎯 FASES DE IMPLEMENTAÇÃO

### FASE 1 (Semanas 1-3): FUNDAÇÃO
**Foco:** Estados em português + Schema BD + UI base
**Horas:** 480h (120h/pessoa)

#### 🔧 ENTREGAS CRÍTICAS:
1. **Estados em Português** (40h)
   - Alterar schema: `'aberto', 'em_revisao', 'em_progresso', 'resolvido', 'fechado'`
   - Adaptar StatusWorkflow.tsx
   - Traduzir interface completa

2. **Upload em Massa** (120h)
   - Parser PDF/Word/Excel/TXT
   - Interface drag-and-drop
   - Validação e preview
   - Estado automático 'em_revisao'

3. **Sistema de Logs Categorizado** (80h)
   - Schema: `action_type: 'USER_ACTION' | 'SYSTEM_ACTION' | 'LLM_ACTION'`
   - Interface auditoria
   - Logs automáticos

4. **API REST Externa** (80h)
   - Endpoints para ferramentas ticketing
   - Autenticação/autorização
   - Documentação OpenAPI

5. **Estados Automáticos** (60h)
   - Lógica: bulk = 'em_revisao', manual = 'aberto'
   - Triggers automáticos
   - Validação fluxo

6. **Interface Tratamento** (100h)
   - Botão "Tratar" para incidentes 'aberto'
   - Modal/tela tratamento
   - Navegação fluida

**CAMINHO CRÍTICO:**
Estados → Upload → API → Interface

---

### FASE 2 (Semanas 4-6): CORE FUNCIONAL
**Foco:** Fila incidentes + Upload massa + Fluxo tratamento
**Horas:** 480h (120h/pessoa)

#### 🔧 ENTREGAS CRÍTICAS:
1. **Busca Automática Relacionados** (140h)
   - Algoritmo similaridade (sem IA)
   - Busca por palavras-chave, categoria, tags
   - Trigger automático estado 'aberto'
   - Limitação 5 resultados por semelhança

2. **Interface Relacionados** (80h)
   - Lista incidentes relacionados
   - Detalhes expandíveis
   - Logs visualização
   - Score semelhança

3. **Comentários Ativos/Inativos** (100h)
   - Schema: campo `is_active`
   - Interface gestão comentários
   - Soft delete com logs
   - Contexto para IA

4. **Melhorias Performance** (60h)
   - Índices BD optimizados
   - Cache relacionados
   - Paginação avançada

5. **Filtros Avançados** (60h)
   - Multi-select categorias
   - Range datas
   - Busca textual
   - Preset filters

6. **Testes Unitários Base** (40h)
   - Core functions
   - API endpoints
   - Upload parser

**CAMINHO CRÍTICO:**
Busca Relacionados → Interface → Comentários

---

### FASE 3 (Semanas 7-9): INTEGRAÇÃO IA
**Foco:** Integração LLM + Busca semântica + Propostas
**Horas:** 480h (120h/pessoa)

#### 🔧 ENTREGAS CRÍTICAS:
1. **Integração Gemini/LLM** (140h)
   - SDK Gemini
   - Configuração API keys
   - Rate limiting
   - Error handling

2. **Alargamento Semântico** (100h)
   - Prompt engineering
   - Expansão contexto técnico/funcional
   - Cache resultados
   - Logs LLM_ACTION

3. **Busca Semântica Avançada** (80h)
   - Integração com contexto expandido
   - Algoritmo híbrido (tradicional + semântica)
   - Ranking relevância
   - Logs SYSTEM_ACTION

4. **Proposta Soluções LLM** (100h)
   - Template prompts
   - Contexto incidentes relacionados
   - Referências automáticas
   - Interface soluções

5. **Sistema Feedback** (40h)
   - Aceitar/rejeitar soluções
   - Classificação 1-5 estrelas
   - Loop re-análise
   - Logs feedback

6. **Botão Análise Inteligente** (20h)
   - Interface trigger IA
   - Estados fluxo
   - Progress indicators

**CAMINHO CRÍTICO:**
Integração LLM → Semântica → Propostas → Feedback

---

### FASE 4 (Semanas 10-12): POLISH & PRODUÇÃO
**Foco:** Logs + Comentários + Auditoria
**Horas:** 480h (120h/pessoa)

#### 🔧 ENTREGAS CRÍTICAS:
1. **Auditoria Completa** (80h)
   - Dashboard logs
   - Filtros timeline
   - Export relatórios
   - Compliance GDPR

2. **Interface Comentários Final** (60h)
   - Editor rich text
   - Anexos files
   - Menções @user
   - Histórico versões

3. **Fluxo Re-análise** (100h)
   - Modal confirmação rejeição
   - Inclusão comentários ativos no contexto
   - Loop inteligente
   - Prevenção loops infinitos

4. **Performance & Scale** (80h)
   - Optimizações BD
   - Cache Redis
   - CDN para files
   - Monitoring

5. **Testes E2E** (100h)
   - Scenarios completos
   - Upload + IA + Feedback
   - Performance tests
   - Load testing

6. **Deploy & Documentação** (60h)
   - Guia instalação
   - Manual utilizador
   - API docs
   - Troubleshooting

**CAMINHO CRÍTICO:**
Auditoria → Re-análise → Testes → Deploy

---

## ⚡ RECURSOS E TIMELINE

### 👥 ALOCAÇÃO EQUIPE:

**Desenvolvedor Senior (480h/fase)**
- Arquitetura, IA, integrações complexas

**Desenvolvedor Junior (480h/fase)**
- UI, APIs REST, testes, documentação

**UX Designer (120h/fase)**
- Interfaces, fluxos, usabilidade

**QA Tester (120h/fase)**
- Testes, validação, scenarios

### 📊 DISTRIBUIÇÃO ESFORÇO:

| Fase | Backend | Frontend | IA/LLM | Testes | UX/UI |
|------|---------|----------|--------|--------|-------|
| 1    | 40%     | 30%      | 0%     | 10%    | 20%   |
| 2    | 35%     | 35%      | 5%     | 15%    | 10%   |
| 3    | 25%     | 25%      | 35%    | 10%    | 5%    |
| 4    | 20%     | 20%      | 10%    | 30%    | 20%   |

---

## 🚨 RISCOS E MITIGAÇÕES

### RISCOS ALTOS:
1. **API Gemini Instável**
   - Mitigação: Fallback para outros LLMs (OpenAI, Claude)
   - Backup: Sistema manual de análise

2. **Performance Upload Massa**
   - Mitigação: Processing assíncrono + queues
   - Backup: Limitação simultânea uploads

3. **Qualidade Parsing Documentos**
   - Mitigação: Multiple parsers por tipo
   - Backup: Validação manual obrigatória

### DEPENDÊNCIAS CRÍTICAS:
- API Keys Gemini (Semana 7)
- Servidor produção (Semana 11)
- Dados migração KB (Semana 2)

---

## 📈 CRITÉRIOS SUCESSO

### FASE 1 (30% → 50%):
- Upload massa 500+ documentos
- Estados funcionais português
- API externa operacional

### FASE 2 (50% → 70%):
- Busca relacionados <2s
- Interface tratamento completa
- Comentários ativos funcionais

### FASE 3 (70% → 90%):
- LLM propostas 80% relevância
- Busca semântica operacional
- Feedback loop completo

### FASE 4 (90% → 100%):
- Sistema produção estável
- Auditoria compliance
- Performance <3s response

---

## 💰 INVESTIMENTO RESUMO

**Total Horas:** 1.920h
**Custo Estimado:** €150-200k
**ROI Expected:** 60% redução tempo resolução
**Payback:** 8-12 meses

**APROVAÇÃO NECESSÁRIA:** Semana 0
**INÍCIO DESENVOLVIMENTO:** Semana 1
**ENTREGA PRODUÇÃO:** Semana 12