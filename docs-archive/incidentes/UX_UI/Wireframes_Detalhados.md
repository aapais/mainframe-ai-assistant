# Wireframes Detalhados - Sistema de Gestão de Incidentes
**Design System**: Accenture (#A100FF)
**Versão**: 1.0 | **Data**: 18/09/2025

## 1. Wireframe - Página Principal (Dashboard)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ HEADER: Gradiente #A100FF → #6B00FF                                    │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ [Accenture Logo] Mainframe AI Assistant    [Dashboard][Incidents]  │ │
│ │                                            [Settings] [Help] [User] │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────┤
│ BREADCRUMB: Home > Incidents                                            │
├─────────────────────────────────────────────────────────────────────────┤
│ MAIN CONTENT AREA                                                       │
│ ┌─ KPI Cards Row ──────────────────────────────────────────────────────┐│
│ │ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐        ││
│ │ │[📊] Total  │ │[⏱️] Avg Time│ │[✅] Resolved│ │[🚨] Critical│        ││
│ │ │    23      │ │   2.3h     │ │    8 Today │ │    3 Open  │        ││
│ │ └────────────┘ └────────────┘ └────────────┘ └────────────┘        ││
│ └─────────────────────────────────────────────────────────────────────────┘│
│ ┌─ Search & Filters Bar ──────────────────────────────────────────────┐│
│ │ [🔍] Buscar incidentes...              [Filtros] [+ Novo Incidente]││
│ │ [Local Search] [AI-Enhanced]                            [Export]     ││
│ └─────────────────────────────────────────────────────────────────────────┘│
│ ┌─ Quick Filters ──────────────────────────────────────────────────────┐│
│ │ [Todos] [Em Revisão] [Aberto] [Em Tratamento] [Resolvido] [Fechado]  ││
│ │ [Crítica] [Alta] [Média] [Baixa] [Hoje] [Esta Semana] [Este Mês]    ││
│ └─────────────────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────────────┤
│ INCIDENT LIST - Grid/List Toggle: [⊞] [☰]                              │
│ ┌─ Incident Card 1 ────────────────────────────────────────────────────┐│
│ │ [!] INC-2025-001                    [Em Tratamento] 🔴 Crítica      ││
│ │ Falha no Sistema Principal do Mainframe                             ││
│ │ 📅 18/09/2025 14:30  👤 João Silva  💬 3 comentários               ││
│ │ 📊 SLA: 2h restantes  🔗 2 relacionados                             ││
│ │ [Ver Detalhes] [Editar] [Comentários] [Relacionados]               ││
│ └─────────────────────────────────────────────────────────────────────────┘│
│ ┌─ Incident Card 2 ────────────────────────────────────────────────────┐│
│ │ [!] INC-2025-002                    [Resolvido] 🟡 Alta             ││
│ │ Interface Web apresentando lentidão                                 ││
│ │ 📅 17/09/2025 16:20  👤 Maria Santos  💬 5 comentários              ││
│ │ 📊 Resolvido em: 4.2h  ✅ SLA atendido                              ││
│ │ [Ver Detalhes] [Reabrir] [Documentação] [Lições Aprendidas]        ││
│ └─────────────────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────────────┤
│ PAGINATION: [◀] Página 1 de 3 [▶]     [10] [25] [50] por página       │
│                                                                         │
│ [🔄] Atualizar    [📥] Exportar    [⚙️] Configurações da Visualização  │
└─────────────────────────────────────────────────────────────────────────┘
│ FLOATING ACTION BUTTON: [+] Fixed position: bottom-right              │
└─────────────────────────────────────────────────────────────────────────┘
```

### Responsividade - Mobile (< 768px)
```
┌─────────────────────────────┐
│ HEADER (Collapsed)          │
│ [☰] Accenture AI   [🔔][👤]│
├─────────────────────────────┤
│ SEARCH BAR                  │
│ [🔍] Buscar...   [Filtros]  │
├─────────────────────────────┤
│ KPI CARDS (2x2 Grid)        │
│ ┌──────────┐ ┌──────────┐   │
│ │Total: 23 │ │Avg: 2.3h │   │
│ └──────────┘ └──────────┘   │
│ ┌──────────┐ ┌──────────┐   │
│ │Today: 8  │ │Crit: 3   │   │
│ └──────────┘ └──────────┘   │
├─────────────────────────────┤
│ FILTERS (Horizontal Scroll) │
│ [Todos][Aberto][Crítica]... │
├─────────────────────────────┤
│ INCIDENT CARDS (Stacked)    │
│ ┌─────────────────────────┐ │
│ │ INC-001  [Crítica] 🔴  │ │
│ │ Falha Mainframe        │ │
│ │ João S. | 14:30 | 💬3  │ │
│ │ [Detalhes] [Editar]    │ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ INC-002  [Alta] 🟡     │ │
│ │ Lentidão Web          │ │
│ │ Maria S. | 16:20 | 💬5 │ │
│ │ [Detalhes] [Ver]      │ │
│ └─────────────────────────┘ │
├─────────────────────────────┤
│ [+] FAB - New Incident      │
└─────────────────────────────┘
```

## 2. Wireframe - Modal de Criação de Incidente

```
OVERLAY: rgba(0, 0, 0, 0.6) - Full Screen
┌─────────────────────────────────────────────────────────────┐
│ MODAL: Criar Novo Incidente                          [✖]   │
├─────────────────────────────────────────────────────────────┤
│ STEP INDICATOR: ●──○──○──○ [1/4]                           │
├─────────────────────────────────────────────────────────────┤
│ FORM CONTENT                                                │
│ ┌─ Informações Básicas ────────────────────────────────────┐│
│ │ Título do Incidente: *                                   ││
│ │ [________________________________]                      ││
│ │                                                          ││
│ │ Descrição: *                                             ││
│ │ ┌──────────────────────────────────────────────────────┐ ││
│ │ │ [Rich Text Editor com toolbar]                      │ ││
│ │ │ - Bold, Italic, Lists                               │ ││
│ │ │ - Links, Images                                      │ ││
│ │ │ - Code blocks                                        │ ││
│ │ └──────────────────────────────────────────────────────┘ ││
│ │                                                          ││
│ │ Sistema Afetado: *                                       ││
│ │ [Dropdown: Mainframe/Web/Database/Network]               ││
│ │                                                          ││
│ │ Severidade: *                                            ││
│ │ ○ Crítica ○ Alta ● Média ○ Baixa                        ││
│ │                                                          ││
│ │ Impacto nos Usuários:                                    ││
│ │ ☐ Sistemas indisponíveis                                 ││
│ │ ☐ Performance degradada                                  ││
│ │ ☐ Funcionalidade limitada                                ││
│ │ ☐ Outros: [_________________]                            ││
│ └──────────────────────────────────────────────────────────┘│
│                                                             │
│ ┌─ Anexos ─────────────────────────────────────────────────┐│
│ │ Anexar evidências (screenshots, logs, documentos)       ││
│ │ ┌─────────────────────────────────────────────────────┐  ││
│ │ │        [📎] Arrastar arquivos aqui                 │  ││
│ │ │              ou clique para selecionar             │  ││
│ │ │     Formatos: PNG, JPG, PDF, TXT, DOC, XLS        │  ││
│ │ │        Tamanho máximo: 10MB por arquivo            │  ││
│ │ └─────────────────────────────────────────────────────┘  ││
│ │                                                          ││
│ │ Arquivos selecionados:                                   ││
│ │ 📄 screenshot_erro.png (2.3MB) [❌]                     ││
│ │ 📝 log_sistema.txt (0.8MB) [❌]                         ││
│ └──────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│ ACTIONS BAR                                                 │
│ [Salvar como Rascunho]    [Cancelar] [Próximo: Atribuição]│
└─────────────────────────────────────────────────────────────┘
```

### Step 2: Atribuição e Priorização
```
┌─────────────────────────────────────────────────────────────┐
│ MODAL: Criar Novo Incidente                          [✖]   │
├─────────────────────────────────────────────────────────────┤
│ STEP INDICATOR: ○──●──○──○ [2/4]                           │
├─────────────────────────────────────────────────────────────┤
│ ┌─ Atribuição ─────────────────────────────────────────────┐│
│ │ Responsável: *                                           ││
│ │ [Dropdown com search: Pessoas/Equipes]                  ││
│ │ 👤 João Silva - Especialista Mainframe                  ││
│ │                                                          ││
│ │ Equipe de Suporte:                                       ││
│ │ [Multi-select]                                           ││
│ │ ☑ Mainframe Team  ☐ Network Team  ☐ Security Team       ││
│ │                                                          ││
│ │ Observadores (será notificado):                          ││
│ │ [Campo com tags]                                         ││
│ │ [maria.santos] [pedro.costa] [+]                         ││
│ └──────────────────────────────────────────────────────────┘│
│                                                             │
│ ┌─ Priorização ────────────────────────────────────────────┐│
│ │ Urgência:                                                ││
│ │ ● Urgente (< 2h)  ○ Normal (< 8h)  ○ Baixa (< 24h)     ││
│ │                                                          ││
│ │ SLA Esperado:                                            ││
│ │ [Auto-calculado] 4 horas (baseado na severidade/urgência) ││
│ │                                                          ││
│ │ Data/Hora Limite:                                        ││
│ │ 📅 18/09/2025  🕐 18:30                                  ││
│ │                                                          ││
│ │ Escalamento Automático:                                  ││
│ │ ☑ Notificar gerente se não resolvido em 2h              ││
│ │ ☑ Escalar para nível 2 se não resolvido em 4h          ││
│ └──────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│ [◀ Voltar: Básicas]      [Cancelar] [Próximo: Aprovação] │
└─────────────────────────────────────────────────────────────┘
```

## 3. Wireframe - Interface de Upload em Massa

```
┌─────────────────────────────────────────────────────────────────────────┐
│ HEADER: Accenture Branding                                             │
├─────────────────────────────────────────────────────────────────────────┤
│ BREADCRUMB: Home > Incidents > Upload em Massa                         │
├─────────────────────────────────────────────────────────────────────────┤
│ PAGE TITLE: Upload em Massa de Documentos                              │
│ Importe múltiplos arquivos para criar incidentes automaticamente       │
├─────────────────────────────────────────────────────────────────────────┤
│ MAIN CONTENT                                                            │
│ ┌─ Upload Zone ───────────────────────────────────────────────────────┐│
│ │                            DRAG & DROP AREA                        ││
│ │                                                                     ││
│ │                               📁                                    ││
│ │                    Arraste arquivos aqui                           ││
│ │                              ou                                     ││
│ │                   [Selecionar Arquivos]                             ││
│ │                                                                     ││
│ │               Formatos aceitos: PDF, DOC, DOCX,                    ││
│ │                    XLS, XLSX, TXT, CSV                              ││
│ │                  Tamanho máximo: 50MB por arquivo                   ││
│ │                      Máximo: 20 arquivos                            ││
│ │                                                                     ││
│ │   Estados visuais:                                                  ││
│ │   - Default: Border dashed #A100FF                                  ││
│ │   - Hover: Background #F3E8FF                                       ││
│ │   - Drag Over: Border solid #A100FF, Background #E1CCFF            ││
│ │   - Error: Border #DC2626, Background #FEE2E2                      ││
│ └─────────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│ ┌─ File List ─────────────────────────────────────────────────────────┐│
│ │ ARQUIVOS SELECIONADOS (3 de 20)                           [Limpar] ││
│ │                                                                     ││
│ │ ┌─ File Item 1 ─────────────────────────────────────────────────┐   ││
│ │ │ 📄 manual_mainfr │ 2.5MB │ ✅ Pronto │ [Preview] [❌ Remover] │   ││
│ │ │    ame_v1.pdf   │       │          │                       │   ││
│ │ └─────────────────────────────────────────────────────────────────────┘   ││
│ │                                                                     ││
│ │ ┌─ File Item 2 ─────────────────────────────────────────────────┐   ││
│ │ │ 📊 planilha_erros │ 1.2MB │ ⏳ Processando... │ [❌ Cancelar] │   ││
│ │ │    _sistema.xlsx │       │ ████████░░ 80%    │               │   ││
│ │ └─────────────────────────────────────────────────────────────────────┘   ││
│ │                                                                     ││
│ │ ┌─ File Item 3 ─────────────────────────────────────────────────┐   ││
│ │ │ 📝 log_incidente │ 0.8MB │ ❌ Erro          │ [↻ Tentar     │   ││
│ │ │    _crítico.txt │       │ Formato inválido │  Novamente]   │   ││
│ │ │                │       │ [ℹ️ Detalhes]     │ [❌ Remover]   │   ││
│ │ └─────────────────────────────────────────────────────────────────────┘   ││
│ └─────────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│ ┌─ Processing Options ────────────────────────────────────────────────┐│
│ │ CONFIGURAÇÕES DE PROCESSAMENTO                                      ││
│ │                                                                     ││
│ │ Método de Extração:                                                 ││
│ │ ● Automático (AI)  ○ Template Estruturado  ○ Manual                ││
│ │                                                                     ││
│ │ Severidade Padrão:                                                  ││
│ │ [Dropdown: Média ▼]                                                 ││
│ │                                                                     ││
│ │ Sistema Afetado Padrão:                                             ││
│ │ [Dropdown: A ser determinado ▼]                                     ││
│ │                                                                     ││
│ │ Responsável Padrão:                                                 ││
│ │ [Dropdown: Auto-atribuir ▼]                                         ││
│ │                                                                     ││
│ │ ☑ Criar rascunhos (requer aprovação manual)                        ││
│ │ ☐ Criar incidentes ativos (processamento automático)               ││
│ │ ☑ Notificar responsáveis após criação                              ││
│ └─────────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│ ┌─ Progress Summary ──────────────────────────────────────────────────┐│
│ │ RESUMO DO LOTE                                                      ││
│ │ 📊 Total: 3 arquivos | ✅ 1 pronto | ⏳ 1 processando | ❌ 1 erro  ││
│ │ 💾 Tamanho total: 4.5MB                                             ││
│ │ ⏱️ Tempo estimado: 2-3 minutos                                       ││
│ └─────────────────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────────────┤
│ ACTION BUTTONS                                                          │
│ [📥 Adicionar Mais]  [🔄 Processar Lote]  [💾 Salvar Configuração]    │
│                                                                         │
│ [◀ Voltar]         [Cancelar Todos]           [📋 Ver Histórico]       │
└─────────────────────────────────────────────────────────────────────────┘
```

### Estados Visuais do Upload
```
// Estado Default
┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
│           📁                  │
│    Arraste arquivos aqui      │
│           ou                  │
│   [Selecionar Arquivos]       │
└─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘

// Estado Hover
┌───────────────────────────────┐
│           📁                  │
│    Arraste arquivos aqui      │
│           ou                  │
│   [Selecionar Arquivos]       │
└───────────────────────────────┘

// Estado Drag Over (Active)
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃           📁                  ┃
┃      Solte aqui para          ┃
┃         adicionar             ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

// Estado Error
┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
│           ❌                  │
│     Arquivo não suportado     │
│      Tente novamente          │
│   [Selecionar Arquivos]       │
└─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
```

## 4. Wireframe - Fluxo de Tratamento (Wizard)

### Step 1: Classificação
```
┌─────────────────────────────────────────────────────────────┐
│ WIZARD: Fluxo de Tratamento - INC-2025-001           [✖]  │
├─────────────────────────────────────────────────────────────┤
│ PROGRESS: ●────○────○────○────○  Etapa 1 de 5              │
│           Classificação                                     │
├─────────────────────────────────────────────────────────────┤
│ INCIDENT SUMMARY (Collapsible)                             │
│ ┌─ Resumo do Incidente ────────────────────────────────────┐│
│ │ 📋 INC-2025-001 | Falha no Sistema Principal           ││
│ │ 🕐 Criado: 18/09/2025 14:30 | 👤 Criado por: Ana Silva ││
│ │ [▼ Ver mais detalhes]                                  ││
│ └─────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│ CLASSIFICATION FORM                                         │
│ ┌─ Categoria Principal ────────────────────────────────────┐│
│ │ [Dropdown] Sistema/Hardware/Software/Rede/Segurança    ││
│ │ Selecionado: Sistema                                    ││
│ │                                                         ││
│ │ Subcategoria:                                           ││
│ │ [Dropdown] Mainframe/Database/Application/Interface    ││
│ │ Selecionado: Mainframe                                  ││
│ │                                                         ││
│ │ Componente Específico:                                  ││
│ │ [Dropdown] Core System/Backup/Network/Storage          ││
│ │ Selecionado: Core System                                ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                             │
│ ┌─ Matriz de Priorização ──────────────────────────────────┐│
│ │ SEVERIDADE (Impacto no negócio)                        ││
│ │ ● Crítica   ○ Alta   ○ Média   ○ Baixa                 ││
│ │                                                         ││
│ │ URGÊNCIA (Necessidade de resolução)                    ││
│ │ ● Urgente   ○ Normal   ○ Pode aguardar                 ││
│ │                                                         ││
│ │ IMPACTO (Número de usuários afetados)                  ││
│ │ ● Alto (>100) ○ Médio (50-100) ○ Baixo (<50)          ││
│ │                                                         ││
│ │ ┌─ Prioridade Calculada ──────────────────────────────┐ ││
│ │ │  🔴 PRIORIDADE: P1 - CRÍTICA                       │ ││
│ │ │  ⏰ SLA: 2 horas                                    │ ││
│ │ │  🎯 Meta de resolução: 18/09/2025 16:30            │ ││
│ │ └─────────────────────────────────────────────────────────┘ ││
│ └─────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│ ACTIONS                                                     │
│ [💾 Salvar Rascunho]   [❌ Cancelar]   [▶ Próximo: Análise]│
└─────────────────────────────────────────────────────────────┘
```

### Step 3: Investigação (Exemplo intermediário)
```
┌─────────────────────────────────────────────────────────────┐
│ WIZARD: Fluxo de Tratamento - INC-2025-001           [✖]  │
├─────────────────────────────────────────────────────────────┤
│ PROGRESS: ○────○────●────○────○  Etapa 3 de 5              │
│                     Investigação                           │
├─────────────────────────────────────────────────────────────┤
│ INVESTIGATION FORM                                          │
│ ┌─ Causa Raiz ─────────────────────────────────────────────┐│
│ │ Após investigação, identificamos que:                   ││
│ │ ┌─────────────────────────────────────────────────────┐ ││
│ │ │ [Rich Text Editor]                                  │ ││
│ │ │ • Falha na comunicação entre módulos               │ ││
│ │ │ • Timeout excessivo nas consultas                  │ ││
│ │ │ • Memória insuficiente no servidor principal       │ ││
│ │ │                                                     │ ││
│ │ │ Ferramentas: Bold, Italic, List, Link, Code        │ ││
│ │ └─────────────────────────────────────────────────────┘ ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                             │
│ ┌─ Sistemas e Componentes Afetados ───────────────────────┐│
│ │ [Checklist com hierarquia]                             ││
│ │                                                         ││
│ │ ☑ 🖥️  Sistema Principal                                ││
│ │    ☑ Core Module                                       ││
│ │    ☑ Database Connection                               ││
│ │    ☐ Backup Module                                     ││
│ │                                                         ││
│ │ ☑ 🌐 Interface Web                                     ││
│ │    ☑ Frontend Application                              ││
│ │    ☐ API Gateway                                       ││
│ │                                                         ││
│ │ ☐ 🔒 Sistema de Segurança                             ││
│ │    ☐ Authentication                                    ││
│ │    ☐ Authorization                                     ││
│ │                                                         ││
│ │ [+ Adicionar Sistema Custom]                           ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                             │
│ ┌─ Evidências e Logs ──────────────────────────────────────┐│
│ │ Arquivos de Evidência:                                  ││
│ │ 📄 system_log_error.txt (1.2MB) [👁️ Preview] [⬇️ Download] ││
│ │ 📊 performance_metrics.xlsx (2.5MB) [👁️] [⬇️]           ││
│ │ 🖼️  screenshot_error.png (0.8MB) [👁️] [⬇️]             ││
│ │                                                         ││
│ │ [📎 Adicionar Evidências] [🔗 Link para Recursos]      ││
│ │                                                         ││
│ │ Correlação com Outros Incidentes:                       ││
│ │ 🔗 INC-2025-003 (Similaridade: 78%)                    ││
│ │ 🔗 INC-2024-455 (Mesmo componente)                     ││
│ │ [🔍 Buscar Relacionados]                               ││
│ └─────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│ [◀ Voltar: Análise]   [❌ Cancelar]   [▶ Próximo: Solução] │
└─────────────────────────────────────────────────────────────┘
```

## 5. Wireframe - Sistema de Comentários

```
┌─────────────────────────────────────────────────────────────────────────┐
│ COMMENTS SECTION - INC-2025-001                                        │
├─────────────────────────────────────────────────────────────────────────┤
│ ┌─ New Comment Composer ──────────────────────────────────────────────┐ │
│ │ Para: [Dropdown] 🌐 Toda a equipe ▼                                ││
│ │ Tipo: ●Atualização ○Pergunta ○Urgente ○Nota interna               ││
│ │                                                                     ││
│ │ ┌─ Rich Text Editor ─────────────────────────────────────────────┐  ││
│ │ │ [B][I][U] [🔗] [📊] [📝] [💻]                                    │  ││
│ │ │ ┌─────────────────────────────────────────────────────────────┐ │  ││
│ │ │ │ Sistema foi reiniciado com sucesso.                        │ │  ││
│ │ │ │ Monitorando performance por mais 1 hora.                   │ │  ││
│ │ │ │                                                             │ │  ││
│ │ │ │ @maria.santos favor confirmar se interface                 │ │  ││
│ │ │ │ está funcionando normalmente.                               │ │  ││
│ │ │ └─────────────────────────────────────────────────────────────┘ │  ││
│ │ └───────────────────────────────────────────────────────────────────┘  ││
│ │                                                                     ││
│ │ [📎 Anexar] [😀 Emoji] [🏷️ Tags] [👥 Mencionar]                      ││
│ │ [💾 Rascunho] [📧 Notificar] [📮 Postar Comentário]                ││
│ └─────────────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────┤
│ ┌─ Filter & Sort ─────────────────────────────────────────────────────┐ │
│ │ Mostrar: [Todos ▼] [Ativos] [Arquivados] [Meus] [Menções]          ││
│ │ Ordenar: [Mais recente ▼] | 📊 Total: 8 comentários                ││
│ └─────────────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────┤
│ COMMENT THREAD                                                          │
│                                                                         │
│ ┌─ Active Comment 1 ──────────────────────────────────────────────────┐ │
│ │ 👤 João Silva [🟢 Ativo] 🏷️ Atualização                           ││
│ │ 🕐 Hoje, 16:45 · Editado há 5 min                                   ││
│ │                                                                     ││
│ │ Patch aplicado com sucesso no sistema principal.                   ││
│ │ Performance voltou ao normal. Continuarei monitorando              ││
│ │ por mais 2 horas para garantir estabilidade.                       ││
│ │                                                                     ││
│ │ 📊 Métricas atuais:                                                 ││
│ │ • CPU: 45% (normal)                                                 ││
│ │ • Memória: 68% (aceitável)                                          ││
│ │ • Response time: 1.2s (dentro do SLA)                              ││
│ │                                                                     ││
│ │ [👍 3] [👎 0] [💬 Responder] [🔗 Link] [⋯ Menu]                     ││
│ │                                                                     ││
│ │ ┌─ Reply Thread ──────────────────────────────────────────────────┐ ││
│ │ │ 👤 Maria Santos | Hoje, 16:50                                  │ ││
│ │ │ Confirmado! Interface web funcionando perfeitamente.           │ ││
│ │ │ Usuários conseguem acessar normalmente. ✅                     │ ││
│ │ │ [👍 2] [💬 Responder]                                           │ ││
│ │ └─────────────────────────────────────────────────────────────────────┘ ││
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│ ┌─ Active Comment 2 ──────────────────────────────────────────────────┐ │
│ │ 👤 Pedro Costa [🟢 Ativo] 🏷️ Pergunta                             ││
│ │ 🕐 Hoje, 15:30                                                      ││
│ │                                                                     ││
│ │ @joao.silva Preciso do relatório de impacto para documentar        ││
│ │ o incidente. Você pode gerar até amanhã?                           ││
│ │                                                                     ││
│ │ [👍 0] [👎 0] [💬 Responder] [✅ Marcar como Resolvido]             ││
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│ ┌─ Inactive Comment ──────────────────────────────────────────────────┐ │
│ │ 👤 Ana Silva [⚪ Inativo] 🏷️ Nota [Arquivado]                      ││
│ │ 🕐 Ontem, 14:20                                                     ││
│ │                                                                     ││
│ │ Backup realizado antes da manutenção. Tudo pronto                  ││
│ │ para o procedimento de correção.                                    ││
│ │                                                                     ││
│ │ [📁 Arquivado] [↻ Reativar] [🗑️ Remover]                           ││
│ └─────────────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────┤
│ [📄 Carregar mais comentários (3 restantes)]                           │
│ [⚙️ Configurações] [📧 Configurar Notificações] [📋 Exportar Thread]   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Estados dos Comentários - Detalhes Visuais

```css
/* Comment Status Visual Indicators */
.comment-active {
  border-left: 4px solid #10B981;
  background: #F0FDF4;
}

.comment-inactive {
  border-left: 4px solid #9CA3AF;
  background: #F9FAFB;
  opacity: 0.7;
}

.comment-urgent {
  border-left: 4px solid #DC2626;
  background: #FEF2F2;
  animation: urgentPulse 2s infinite;
}

.comment-resolved {
  border-left: 4px solid #059669;
  background: #ECFDF5;
}

/* Comment Types */
.comment-type-question::before {
  content: "❓";
  margin-right: 8px;
}

.comment-type-update::before {
  content: "📝";
  margin-right: 8px;
}

.comment-type-urgent::before {
  content: "🚨";
  margin-right: 8px;
}
```

## 6. Wireframe - Log de Auditoria

```
┌─────────────────────────────────────────────────────────────────────────┐
│ AUDIT LOG - INC-2025-001                                      [⚙️][📥] │
├─────────────────────────────────────────────────────────────────────────┤
│ ┌─ Filters Panel (Collapsible) ──────────────────────────────────────┐  │
│ │ [▼] FILTROS E PESQUISA                                             ││
│ │                                                                    ││
│ │ Data/Período:                                                      ││
│ │ [📅] De: 17/09/2025  [📅] Até: 18/09/2025  [Últimas 24h] [Hoje]  ││
│ │                                                                    ││
│ │ Nível de Log:                                                      ││
│ │ [☑All] [☑Info] [☑Warning] [☑Error] [☐Critical] [☐Debug]           ││
│ │                                                                    ││
│ │ Usuário/Sistema:                                                   ││
│ │ [Dropdown] Todos ▼ | [🔍] Buscar por usuário...                   ││
│ │                                                                    ││
│ │ Tipo de Ação:                                                      ││
│ │ [Multi-select] STATUS_CHANGE, DATA_MODIFY, ACCESS, APPROVE...      ││
│ │                                                                    ││
│ │ Busca por Conteúdo:                                                ││
│ │ [🔍] Pesquisar nos logs...                        [Pesquisar]     ││
│ │                                                                    ││
│ │ [🔄 Atualizar] [🗑️ Limpar Filtros] [💾 Salvar Filtro]            ││
│ └────────────────────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────────┤
│ ┌─ Summary Stats ─────────────────────────────────────────────────────┐ │
│ │ 📊 Período: 18/09/2025 | Total: 47 eventos | ⚠️ 3 warnings       ││
│ │ 👥 5 usuários únicos | 🔄 Última atualização: há 2 minutos        ││
│ └─────────────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────┤
│ LOG ENTRIES (Real-time updates via WebSocket)                          │
│                                                                         │
│ ┌─ Log Entry 1 [INFO] ────────────────────────────────────────────────┐ │
│ │ 🟢 INFO | 18/09/2025 16:45:23.456 UTC                             ││
│ │                                                                     ││
│ │ 👤 Usuário: João Silva (joao.silva@accenture.com)                  ││
│ │ 🎯 Ação: STATUS_CHANGED                                             ││
│ │ 📝 Detalhes: Status alterado de "Em Tratamento" para "Resolvido"   ││
│ │                                                                     ││
│ │ 🔍 Metadados Técnicos:                                              ││
│ │ • IP Address: 192.168.1.100                                        ││
│ │ • User Agent: Chrome/118.0.0.0                                     ││
│ │ • Session ID: sess_abc123def456                                     ││
│ │ • Request ID: req_xyz789uvw012                                      ││
│ │ • Previous Value: "Em Tratamento"                                   ││
│ │ • New Value: "Resolvido"                                            ││
│ │ • Approval Required: No                                             ││
│ │ • Automated: No                                                     ││
│ │                                                                     ││
│ │ [📋 Copiar] [🔗 Link Permanente] [📧 Reportar] [👁️ Ver Contexto]   ││
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│ ┌─ Log Entry 2 [WARNING] ─────────────────────────────────────────────┐ │
│ │ 🟡 WARNING | 18/09/2025 16:30:15.123 UTC                          ││
│ │                                                                     ││
│ │ 🤖 Sistema: Automated Validation System                            ││
│ │ 🎯 Ação: VALIDATION_FAILED                                          ││
│ │ 📝 Detalhes: Tentativa de alteração sem permissões adequadas       ││
│ │                                                                     ││
│ │ 🔍 Detalhes Técnicos:                                               ││
│ │ • User: pedro.costa@accenture.com                                   ││
│ │ • Required Permission: INCIDENT_MODIFY                              ││
│ │ • User Permission Level: READ_ONLY                                  ││
│ │ • Attempted Action: Modify Priority                                 ││
│ │ • Blocked By: Role-Based Access Control                             ││
│ │ • Rule Applied: RBAC_RULE_004                                       ││
│ │                                                                     ││
│ │ [📋 Copiar] [🔗 Link] [⚠️ Escalar] [📊 Ver Permissões]             ││
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│ ┌─ Log Entry 3 [ERROR] ───────────────────────────────────────────────┐ │
│ │ 🔴 ERROR | 18/09/2025 14:20:45.789 UTC                            ││
│ │                                                                     ││
│ │ 🤖 Sistema: Backup Service                                         ││
│ │ 🎯 Ação: BACKUP_FAILED                                              ││
│ │ 📝 Detalhes: Falha na criação do backup automático                 ││
│ │                                                                     ││
│ │ 🔍 Error Details:                                                   ││
│ │ • Error Code: BKP_001                                               ││
│ │ • Message: "Insufficient storage space"                             ││
│ │ • Available Space: 1.2GB                                            ││
│ │ • Required Space: 3.8GB                                             ││
│ │ • Retry Count: 3                                                    ││
│ │ • Next Retry: 18/09/2025 15:20:45                                   ││
│ │                                                                     ││
│ │ 📄 Log References:                                                   ││
│ │ • System Log: /var/log/backup/backup.log:234                       ││
│ │ • Error Log: /var/log/errors/2025-09-18.log:567                    ││
│ │                                                                     ││
│ │ [📋 Copiar] [🔗 Link] [🚨 Criar Incidente] [📄 Ver Log Completo]   ││
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│ ┌─ Log Entry 4 [INFO] ────────────────────────────────────────────────┐ │
│ │ 🟢 INFO | 18/09/2025 14:15:30.001 UTC                             ││
│ │                                                                     ││
│ │ 👤 Usuário: Ana Silva (ana.silva@accenture.com)                    ││
│ │ 🎯 Ação: COMMENT_ADDED                                              ││
│ │ 📝 Detalhes: Comentário adicionado ao incidente                    ││
│ │                                                                     ││
│ │ 💬 Conteúdo do Comentário:                                          ││
│ │ "Iniciando investigação da causa raiz. Backup realizado."          ││
│ │                                                                     ││
│ │ [📋 Copiar] [🔗 Link] [💬 Ver Comentário]                          ││
│ └─────────────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────┤
│ ┌─ Pagination & Export ───────────────────────────────────────────────┐ │
│ │ [◀◀ Primeiro] [◀ Anterior] Página 1 de 5 [Próximo ▶] [Último ▶▶]  ││
│ │                                                                     ││
│ │ Mostrar: [25 ▼] itens por página                                    ││
│ │                                                                     ││
│ │ [📥 Exportar CSV] [📊 Relatório] [🔧 Configurações] [🔄 Auto-refresh] │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

### Cores por Nível de Log
```css
/* Log Level Color Coding */
.log-debug    { border-left: 4px solid #6B7280; } /* Gray */
.log-info     { border-left: 4px solid #3B82F6; } /* Blue */
.log-warning  { border-left: 4px solid #F59E0B; } /* Yellow */
.log-error    { border-left: 4px solid #EF4444; } /* Red */
.log-critical {
  border-left: 4px solid #DC2626;
  background: #FEE2E2;
  animation: criticalPulse 1.5s infinite;
}

/* Auto-refresh indicator */
.auto-refresh-active::after {
  content: "🔄";
  animation: spin 2s linear infinite;
}
```

## 7. Padrões de Responsividade

### Breakpoints Definidos
```scss
// Breakpoints do Sistema
$breakpoints: (
  'mobile': 320px,   // Smartphones
  'tablet': 768px,   // Tablets
  'desktop': 1024px, // Desktop pequeno
  'large': 1440px,   // Desktop grande
  'xlarge': 1920px   // Monitores grandes
);
```

### Adaptações por Dispositivo

#### Mobile (320px - 767px)
- Navegação: Hamburger menu
- Cards: Stack vertical, full-width
- Tabelas: Transformadas em cards ou scroll horizontal
- Formulários: Campos em stack vertical
- Botões: Full-width ou adaptados para thumb zone
- Modais: Full-screen overlay

#### Tablet (768px - 1023px)
- Navegação: Tabs horizontais ou sidebar colapsível
- Grid: 2 colunas adaptativo
- Formulários: Mix de horizontal e vertical layout
- Sidebar: Colapsível ou overlay

#### Desktop (1024px+)
- Layout completo: Sidebar + conteúdo principal
- Grid: Até 4 colunas
- Hover states: Totalmente habilitados
- Tooltips e popovers: Ativados

## Conclusão dos Wireframes

Esta documentação de wireframes fornece uma base sólida para implementação da interface de gestão de incidentes, considerando:

1. **Experiência do Usuário**: Fluxos intuitivos e eficientes
2. **Acessibilidade**: Conformidade WCAG 2.1 AA
3. **Responsividade**: Adaptação para todos os dispositivos
4. **Design System**: Consistência com marca Accenture
5. **Performance**: Otimização para carregamento rápido
6. **Escalabilidade**: Estrutura preparada para crescimento

Os wireframes servem como referência para desenvolvimento, testes de usabilidade e validação com stakeholders antes da implementação final.