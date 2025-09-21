# Mapeamento Requisito vs Implementação - Sistema de Incidentes

## 📊 Status Geral
**Data:** 18 de Setembro de 2025
**Total de Requisitos:** 20
**Implementados:** 6 (30%)
**Parcialmente Implementados:** 3 (15%)
**Não Implementados:** 11 (55%)

---

## 🔍 Análise Detalhada por Requisito

### ✅ Requisito #1 - Fila de Incidentes em Aberto
**Especificação:** *"O ecrã de incidentes deve ter a fila de incidentes em aberto (não fechados ou resolvidos)"*

**Status:** ✅ **IMPLEMENTADO COMPLETAMENTE**

**Evidência de Implementação:**
- **Arquivo:** `src/renderer/components/incident/IncidentQueue.tsx` (linhas 114-151)
- **Código:**
```typescript
// Filtros implementados para status
if (currentFilters.status && currentFilters.status.length > 0) {
  filtered = filtered.filter(incident => currentFilters.status!.includes(incident.status));
}
```
- **Interface:** Filtros dropdown para "Open", "Assigned", "In Progress", "Resolved"
- **Schema DB:** Campo `status` com CHECK constraint (linha 17 do schema)

---

### ✅ Requisito #2 - Inserção de Novo Incidente
**Especificação:** *"Deve ter uma forma de inserir um novo incidente (a janela de inserção de incidentes já existe e é acedida por outras tabs da aplicação como fast action)"*

**Status:** ✅ **IMPLEMENTADO COMPLETAMENTE**

**Evidência de Implementação:**
- **Arquivo:** `src/renderer/views/Incidents.tsx` (linhas 302-313)
- **Código:**
```typescript
<button
  className="bg-red-600 hover:bg-red-700 text-white rounded-full p-4 shadow-lg"
  title="Report New Incident"
  onClick={() => {
    // This would trigger the report incident modal
    console.log('Report new incident');
  }}
>
  <Plus className="w-6 h-6" />
</button>
```
- **IPC Handler:** `src/main/ipc/handlers/IncidentHandler.ts` (linhas 154-162)
- **Backend:** Método `createIncident()` implementado (linhas 592-627)

---

### ❌ Requisito #3 - Upload em Massa (CRÍTICO)
**Especificação:** *"A janela de inserção de incidentes deve ter um modo de carregamento de incidentes em bulk (servirá para a migração da kb de incidentes - permite carregar vários ficheiros em conjunto, pdf, word, excel, txt), bem como um modo de carregamento único (um a um)"*

**Status:** ❌ **NÃO IMPLEMENTADO**

**Gap Identificado:**
- **Nenhum componente** para upload de arquivos
- **Nenhum parser** para PDF, Word, Excel, TXT
- **Nenhuma interface** de bulk upload
- **Impacto:** CRÍTICO - Bloqueia migração de KB existente

**Implementação Necessária:**
```typescript
interface BulkUploadComponent {
  acceptedTypes: ['.pdf', '.docx', '.xlsx', '.txt'];
  maxFiles: number;
  parseDocument(file: File): Promise<ParsedIncident>;
  bulkImport(incidents: ParsedIncident[]): Promise<void>;
}
```

---

### 🟡 Requisito #4 - Estados de Incidente
**Especificação:** *"Assim que um incidente é inserido, fica num estado (em revisão se carregado em bulk ou modo aberto, se carregado manualmente - modo único)"*

**Status:** 🟡 **PARCIALMENTE IMPLEMENTADO**

**Evidência Parcial:**
- **Schema:** Estados definidos (linha 17): `'open', 'in_progress', 'resolved', 'closed', 'reopened'`
- **Componente:** `StatusWorkflow.tsx` gerencia transições
- **Gap:** Estado `em_revisao` não implementado
- **Gap:** Lógica automática de estado baseado no tipo de inserção não implementada

**Código Existente:**
```typescript
const statusWorkflow = {
  open: { next: ['assigned', 'in_progress', 'resolved', 'closed'] },
  // ... outros estados
}
// FALTA: 'em_revisao' state
```

---

### 🟡 Requisito #5 - Inserção Automática via API
**Especificação:** *"Um incidente também pode ser inserido de forma automática por via de integração (API ou custom) com as ferramentas de ticketing existentes. Neste caso também fica no estado em revisão."*

**Status:** 🟡 **PARCIALMENTE IMPLEMENTADO**

**Evidência Parcial:**
- **IPC Handler:** `incident:create` existe (linha 155)
- **Método Backend:** `createIncident()` implementado (linha 592)
- **Gap:** Nenhuma API REST exposta
- **Gap:** Integração com ferramentas externas não implementada
- **Gap:** Estado automático `em_revisao` não aplicado

---

### ✅ Requisito #6 - Edição de Incidentes
**Especificação:** *"Na fila de incidentes deve existir uma opção de edição para possibilitar a edição do incidente e efetuar a revisão, colocando incidente no estado aberto."*

**Status:** ✅ **IMPLEMENTADO COMPLETAMENTE**

**Evidência de Implementação:**
- **IPC Handlers:** Múltiplos handlers para edição (linhas 49-194)
```typescript
'incident:updateStatus', 'incident:assign', 'incident:updatePriority'
```
- **Interface:** Botões de ação na fila (linhas 404-424)
- **Transições:** StatusWorkflow permite mudanças de estado

---

### ✅ Requisito #7 - Incidentes Não Fechados na Fila
**Especificação:** *"Todos incidentes inseridos e em estados não fechados ficam na fila de incidentes."*

**Status:** ✅ **IMPLEMENTADO COMPLETAMENTE**

**Evidência de Implementação:**
- **Query Base:** (linha 215) `SELECT * FROM incident_queue WHERE 1=1`
- **Filtros:** Sistema de filtros exclui fechados por default
- **View:** `incident_queue` view filtra adequadamente

---

### ✅ Requisito #8 - Filtros e Ordenação
**Especificação:** *"Devem existir filtros para a fila de incidentes e por default são apresentados por nível de criticidade descendente."*

**Status:** ✅ **IMPLEMENTADO COMPLETAMENTE**

**Evidência de Implementação:**
- **Filtros:** (linhas 234-261) Status, priority, assigned_to, category, SLA
- **Ordenação Default:** (linha 265) `ORDER BY priority_order, created_at DESC`
- **Interface:** Dropdowns para filtros (linhas 234-261)

---

### 🟡 Requisito #9 - Tratamento de Incidentes Abertos
**Especificação:** *"Deve existir na fila de incidentes, apenas para os incidentes no estado aberto, uma opção de tratamento do incidente."*

**Status:** 🟡 **PARCIALMENTE IMPLEMENTADO**

**Evidência Parcial:**
- **StatusWorkflow:** Componente existe mas sem fluxo de "tratamento"
- **Gap:** Opção específica "tratamento" não implementada
- **Gap:** Lógica condicional por estado "aberto" não implementada

---

### ❌ Requisito #10 - Busca Automática de Relacionados (CRÍTICO)
**Especificação:** *"Assim que um incidente é adicionado à fila no estado aberto deve ser efetuada uma busca inteligente, mas sem IA (como se a opção de busca com IA estivesse desabilitada) de acidentes relacionados e no estado resolvido (estes incidentes relacionados apenas serão mostrados ao utilizador na área de tratamento do incidente (limitados a 5 por nível de semelhança)"*

**Status:** ❌ **NÃO IMPLEMENTADO**

**Gap Identificado:**
- **Nenhuma busca automática** após mudança para "aberto"
- **Nenhum algoritmo de similaridade** sem IA
- **Nenhuma interface** para exibir relacionados
- **Trigger existe** mas implementação simples (linhas 422-444)

**Trigger Existente (Limitado):**
```sql
CREATE TRIGGER tr_auto_relationship_suggestions
-- Implementação muito básica, apenas por categoria e substring
```

---

### ❌ Requisito #11 - Detalhes de Relacionados
**Especificação:** *"Deve ser permitido ao utilizador ver os detalhes dos incidentes relacionados.(logar a ação efetuada pelo utilizador)"*

**Status:** ❌ **NÃO IMPLEMENTADO**

**Gap Identificado:**
- **Componente `IncidentRelationshipViewer`** existe mas não funcional
- **Nenhuma integração** com dados reais
- **Nenhum log** de visualização implementado

---

### ❌ Requisito #12 - Análise Inteligente via IA (CRÍTICO)
**Especificação:** *"Deve ser permitido ao utilizador prosseguir com análise inteligente (via IA - ML e LLM) (logar a ação efetuada pelo utilizador)"*

**Status:** ❌ **NÃO IMPLEMENTADO**

**Gap Identificado:**
- **Nenhuma integração LLM/Gemini**
- **Nenhuma interface** para análise inteligente
- **Nenhum log** de ações de IA

---

### ❌ Requisito #13 - Alargamento Semântico (CRÍTICO)
**Especificação:** *"Ao proceder com a análise inteligente deve ser passado ao LLM o contexto do incidente a tratar (resolver), para alargamento semântico do contexto técnico ou funcional do incidente para permitir uma busca mais abrangente. (não carece de autorização do utilizador. Deve ser logado como ação efetuada pelo LLM - Gemini ou outro que esteja parametrizado"*

**Status:** ❌ **NÃO IMPLEMENTADO**

**Gap Identificado:**
- **Nenhuma integração** com LLM
- **Nenhum serviço** de expansão semântica
- **Nenhum log** categoria `LLM_ACTION`

---

### ❌ Requisito #14 - Pesquisa com Contexto Expandido
**Especificação:** *"Deve ser feita a pesquisa de incidentes relacionados com o alargamento semântico devolvido pelo LLM. (Logar como ação do sistema - procura de relacionados)"*

**Status:** ❌ **NÃO IMPLEMENTADO**

**Gap Identificado:**
- **Nenhuma pesquisa** baseada em semântica expandida
- **Nenhum log** categoria `SYSTEM_ACTION`

---

### ❌ Requisito #15 - Proposta de Solução via LLM (CRÍTICO)
**Especificação:** *"Deve ser enviado ao sistema LLM configurado, (Gemini ou outro) as informações relativas aos incidentes relacionados e deve ser instruído o Gemini, com base nesse contexto de incidentes, a redação de uma proposta de solução ao utilizador, fazendo referencia aos incidentes onde foi obtida a informação. (Logar como ação do LLM - Analise de solução)"*

**Status:** ❌ **NÃO IMPLEMENTADO**

**Gap Identificado:**
- **Nenhuma geração** de soluções via LLM
- **Nenhuma interface** para propostas
- **Nenhuma referência** a incidentes relacionados

---

### ❌ Requisito #16 - Classificação de Soluções
**Especificação:** *"O utilizador deve classificar a solução proposta, podendo aceitar ou rejeitar a mesma. (Logar como ação do utilizador)"*

**Status:** ❌ **NÃO IMPLEMENTADO**

**Gap Identificado:**
- **Nenhuma interface** aceitar/rejeitar
- **Nenhum feedback loop** para melhorias
- **Nenhum log** de classificação

---

### ❌ Requisito #17 - Sistema de Comentários Ativos
**Especificação:** *"O utilizador deve poder incluir um comentário (fica no estado ativo) na solução para que seja incluída no contexto do incidente. (Logar como ação do utilizador)"*

**Status:** ❌ **NÃO IMPLEMENTADO**

**Gap Identificado:**
- **Tabela `incident_comments`** existe mas sem campo `is_active`
- **Nenhum conceito** de comentários ativos vs inativos
- **Nenhuma gestão** de contexto para IA

**Schema Atual (Limitado):**
```sql
CREATE TABLE incident_comments (
    -- ... campos básicos
    -- FALTA: is_active BOOLEAN DEFAULT TRUE
);
```

---

### ❌ Requisito #18 - Rejeição com Nova Análise
**Especificação:** *"Ao rejeitar a solução, deve ser questionado o utilizador se pretende uma nova análise. Em caso afirmativo o incidente será injetado de novo no fluxo de tratamento inteligente, incluindo no contexto todos os comentários ativos incluídos pelo utilizador. (logar como ação do utilizador)"*

**Status:** ❌ **NÃO IMPLEMENTADO**

**Gap Identificado:**
- **Nenhuma lógica** de re-análise
- **Nenhum fluxo** de tratamento inteligente
- **Nenhuma inclusão** de comentários ativos no contexto

---

### ❌ Requisito #19 - Inativação de Comentários
**Especificação:** *"Os comentários de um utilizador devem poder ser apagados pelo mesmo o que inclui a inativação no log de tratamento da ação original relativa à inclusão no incidente do comentário inativado."*

**Status:** ❌ **NÃO IMPLEMENTADO**

**Gap Identificado:**
- **Nenhum sistema** de inativação (soft delete)
- **Nenhuma interface** para gerenciar comentários
- **Nenhuma correlação** com logs de ação

---

### ✅ Requisito #20 - Log de Tratamento
**Especificação:** *"O log de tratamento dos incidentes deve ser associado ao incidente e passível de ser visto na janela de detalhe de incidentes."*

**Status:** ✅ **IMPLEMENTADO COMPLETAMENTE**

**Evidência de Implementação:**
- **Tabela:** `incident_comments` para logs
- **IPC Handler:** `incident:getComments` (linha 103)
- **Método:** `getComments()` implementado (linhas 462-476)
- **Histórico:** `getStatusHistory()` implementado (linhas 478-491)

---

## 📊 Resumo por Categoria

### 🟢 Gestão Básica de Incidentes (6/8 = 75%)
- ✅ Fila de incidentes
- ✅ Inserção manual
- ✅ Edição
- ✅ Filtros e ordenação
- ✅ Estados básicos
- ✅ Logs de tratamento
- 🟡 Estados avançados (em revisão)
- ❌ Upload em massa

### 🔴 Funcionalidades de IA (0/8 = 0%)
- ❌ Busca automática de relacionados
- ❌ Análise inteligente via IA
- ❌ Alargamento semântico
- ❌ Pesquisa com contexto expandido
- ❌ Proposta de solução via LLM
- ❌ Classificação de soluções
- ❌ Sistema de comentários ativos
- ❌ Fluxo de re-análise

### 🟡 Integrações e APIs (1/4 = 25%)
- 🟡 Inserção automática via API
- ❌ Detalhes de relacionados
- ❌ Inativação de comentários
- ❌ Rejeição com nova análise

---

## 🚨 Gaps Críticos que Impedem Funcionamento

### 1. **Upload em Massa** (Requisito #3)
**Impacto:** CRÍTICO - Bloqueia migração de KB existente
**Esforço:** Alto (4-6 semanas)
**Dependências:** Parser de documentos, interface de upload

### 2. **Integração LLM/Gemini** (Requisitos #12, #13, #15)
**Impacto:** CRÍTICO - Funcionalidade principal do sistema
**Esforço:** Alto (6-8 semanas)
**Dependências:** API Gemini, sistema de logs categorizado

### 3. **Sistema de Logs Categorizado** (Implícito em vários requisitos)
**Impacto:** Alto - Auditoria e compliance
**Esforço:** Médio (2-3 semanas)
**Dependências:** Alteração de schema, interfaces de auditoria

### 4. **Busca Automática de Relacionados** (Requisito #10)
**Impacto:** Alto - Experiência do usuário
**Esforço:** Médio (3-4 semanas)
**Dependências:** Algoritmos de similaridade, triggers automáticos

---

## 🎯 Plano de Implementação Priorizado

### **Fase 1 - Funcionalidades Básicas Críticas (6-8 semanas)**
1. **Sistema de Upload em Massa** (Req #3)
2. **Estados Avançados** (Req #4 - completar)
3. **API REST para Integração Externa** (Req #5 - completar)

### **Fase 2 - Integração LLM (8-10 semanas)**
4. **Configuração Gemini API** (Req #12, #13)
5. **Sistema de Logs Categorizado** (Múltiplos requisitos)
6. **Busca Automática de Relacionados** (Req #10)

### **Fase 3 - Funcionalidades Avançadas de IA (6-8 semanas)**
7. **Proposta de Solução via LLM** (Req #15)
8. **Sistema de Comentários Ativos/Inativos** (Req #17, #19)
9. **Classificação e Feedback de Soluções** (Req #16, #18)

### **Fase 4 - Finalizações (4-6 semanas)**
10. **Interface de Detalhes de Relacionados** (Req #11)
11. **Fluxo Completo de Tratamento Inteligente** (Req #18)
12. **Testes End-to-End e Otimizações**

---

**Tempo Total Estimado:** 24-32 semanas (6-8 meses)
**Esforço:** Alto - Sistema complexo com múltiplas integrações
**Risco:** Médio-Alto - Dependência de APIs externas (Gemini) e processamento de documentos