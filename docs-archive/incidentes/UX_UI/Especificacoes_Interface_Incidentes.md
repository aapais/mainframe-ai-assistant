# Especificações de Interface UX/UI - Sistema de Gestão de Incidentes
**Versão**: 1.0
**Data**: 18/09/2025
**Design System**: Accenture (#A100FF)

## Análise da Interface Atual

### Estado Atual Identificado
- Interface básica de listagem de incidentes
- Formulário modal simples para criação
- Sistema de busca com alternância local/AI
- Botão flutuante para novo incidente
- Design system Accenture aplicado (gradiente roxo #A100FF para #6B00FF)

### Componentes Atuais Analisados
1. **Header Navigation**: Navegação principal com branding Accenture
2. **Search Interface**: Busca unificada com opções local/AI
3. **Incident Form**: Modal básico para criação de incidentes
4. **Floating Action Button**: Botão de ação rápida para novo incidente

## 1. Fila de Incidentes (Incident Queue)

### Estados dos Incidentes
```
- em revisão (Under Review): #FEF3C7 (amarelo claro)
- aberto (Open): #FEE2E2 (vermelho claro)
- em tratamento (In Progress): #DBEAFE (azul claro)
- resolvido (Resolved): #D1FAE5 (verde claro)
- fechado (Closed): #F3F4F6 (cinza claro)
```

### Layout da Fila
```
┌─────────────────────────────────────────────────────┐
│ FILA DE INCIDENTES                    [Filtros] [⚙] │
├─────────────────────────────────────────────────────┤
│ [🔍] Buscar incidentes...              [+ Incidente]│
├─────────────────────────────────────────────────────┤
│ ┌─ Filtros Rápidos ─────────────────────────────────┐│
│ │ [Todos] [Em Revisão] [Aberto] [Em Tratamento]    ││
│ │ [Resolvido] [Fechado] [Alta Prioridade]          ││
│ └─────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────┤
│ ┌─ Item de Incidente ──────────────────────────────┐ │
│ │ [!] INC-2025-001    [Em Tratamento] 🟡 Alta     │ │
│ │ Falha no Sistema de Mainframe                    │ │
│ │ Atribuído: João Silva | Criado: 18/09 14:30     │ │
│ │ [Ver Detalhes] [Editar] [Comentários: 3]        │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### Interações da Fila
- **Drag & Drop**: Alterar prioridade arrastando itens
- **Seleção Múltipla**: Checkbox para ações em lote
- **Atualização em Tempo Real**: WebSocket para status automático
- **Paginação Infinita**: Scroll infinito com lazy loading

## 2. Interface de Upload em Massa

### Componentes do Upload
```
┌─────────────────────────────────────────────────────┐
│ UPLOAD EM MASSA DE DOCUMENTOS                       │
├─────────────────────────────────────────────────────┤
│ ┌─ Zona de Arrastar e Soltar ──────────────────────┐ │
│ │                     📁                           │ │
│ │         Arraste arquivos aqui                    │ │
│ │              ou                                  │ │
│ │         [Selecionar Arquivos]                    │ │
│ │                                                  │ │
│ │   Suporte: PDF, DOC, DOCX, XLS, XLSX, TXT       │ │
│ │   Tamanho máximo: 50MB por arquivo               │ │
│ └─────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────┤
│ ┌─ Lista de Arquivos ──────────────────────────────┐ │
│ │ 📄 manual_sistema.pdf (2.5MB) ✅ [❌]           │ │
│ │ 📊 dados_erro.xlsx (1.2MB) ⏳ [❌]             │ │
│ │ 📝 log_incidente.txt (0.8MB) ❌ [❌]           │ │
│ └─────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────┤
│ [Processar Lote] [Cancelar] [Limpar Lista]          │
└─────────────────────────────────────────────────────┘
```

### Estados do Upload
- **Aguardando**: Arquivo adicionado, não processado
- **Processando**: Barra de progresso animada
- **Sucesso**: Ícone verde, link para incidente criado
- **Erro**: Ícone vermelho, tooltip com detalhes do erro

## 3. Fluxo de Tratamento (5 Etapas)

### Wizard de Tratamento
```
Step 1: Classificação
┌─────────────────────────────────────────┐
│ ● ○ ○ ○ ○  [1/5] CLASSIFICAÇÃO         │
├─────────────────────────────────────────┤
│ Categoria: [Dropdown Sistema]          │
│ Severidade: [●Crítica ○Alta ○Média]    │
│ Impacto: [●Alto ○Médio ○Baixo]         │
│ Urgência: [●Urgente ○Normal ○Baixa]    │
│                    [Próximo →]         │
└─────────────────────────────────────────┘

Step 2: Análise Inicial
┌─────────────────────────────────────────┐
│ ○ ● ○ ○ ○  [2/5] ANÁLISE INICIAL       │
├─────────────────────────────────────────┤
│ Sintomas Observados:                    │
│ [Textarea com rich text]               │
│                                         │
│ Evidências Coletadas:                   │
│ [Upload de arquivos/screenshots]        │
│                                         │
│ [← Voltar]            [Próximo →]      │
└─────────────────────────────────────────┘

Step 3: Investigação
┌─────────────────────────────────────────┐
│ ○ ○ ● ○ ○  [3/5] INVESTIGAÇÃO          │
├─────────────────────────────────────────┤
│ Causa Raiz Identificada:                │
│ [Textarea]                              │
│                                         │
│ Sistemas Afetados:                      │
│ [☑] Mainframe Principal                 │
│ [☐] Sistema de Backup                   │
│ [☐] Interface Web                       │
│                                         │
│ [← Voltar]            [Próximo →]      │
└─────────────────────────────────────────┘

Step 4: Implementação da Solução
┌─────────────────────────────────────────┐
│ ○ ○ ○ ● ○  [4/5] IMPLEMENTAÇÃO         │
├─────────────────────────────────────────┤
│ Solução Proposta:                       │
│ [Rich text editor]                      │
│                                         │
│ Recursos Necessários:                   │
│ [Multi-select: Pessoas/Sistemas/Tempo] │
│                                         │
│ Tempo Estimado: [___] horas             │
│                                         │
│ [← Voltar]            [Próximo →]      │
└─────────────────────────────────────────┘

Step 5: Validação e Encerramento
┌─────────────────────────────────────────┐
│ ○ ○ ○ ○ ●  [5/5] VALIDAÇÃO             │
├─────────────────────────────────────────┤
│ Testes Realizados:                      │
│ [☑] Funcionalidade restaurada          │
│ [☑] Performance normal                  │
│ [☐] Sem efeitos colaterais             │
│                                         │
│ Documentação:                           │
│ [☑] Manual atualizado                   │
│ [☐] Base de conhecimento               │
│                                         │
│ [← Voltar]         [Finalizar]         │
└─────────────────────────────────────────┘
```

## 4. Visualização de Incidentes Relacionados

### Layout de Incidentes Relacionados (máximo 5)
```
┌─────────────────────────────────────────────────────┐
│ INCIDENTES RELACIONADOS                      [🔄]  │
├─────────────────────────────────────────────────────┤
│ ┌─ Relacionamento por Similaridade ──────────────┐  │
│ │ 🔗 INC-2025-002 | Falha similar em produção   │  │
│ │    Similaridade: 85% | Status: Resolvido      │  │
│ │    [Ver Solução]                               │  │
│ └─────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────┤
│ ┌─ Relacionamento por Sistema ───────────────────┐  │
│ │ 🔗 INC-2025-003 | Mesmo módulo afetado        │  │
│ │    Sistema: Mainframe-Core | Status: Aberto   │  │
│ │    [Vincular]                                  │  │
│ └─────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────┤
│ ┌─ Relacionamento Temporal ──────────────────────┐  │
│ │ 🔗 INC-2025-004 | Ocorreu no mesmo período    │  │
│ │    Intervalo: ±2h | Status: Em Tratamento     │  │
│ │    [Analisar Correlação]                       │  │
│ └─────────────────────────────────────────────────────┘  │
│                                                     │
│ [+ Adicionar Relacionamento Manual]                │
└─────────────────────────────────────────────────────┘
```

### Tipos de Relacionamento
1. **Similaridade** (IA-based): Análise de conteúdo e padrões
2. **Sistema**: Mesmo componente/módulo afetado
3. **Temporal**: Ocorrência em janela de tempo similar
4. **Dependência**: Relação de causa-efeito entre sistemas
5. **Manual**: Relacionamento definido pelo usuário

## 5. Interface de Proposta de Solução

### Layout da Proposta
```
┌─────────────────────────────────────────────────────┐
│ PROPOSTA DE SOLUÇÃO - INC-2025-001                  │
├─────────────────────────────────────────────────────┤
│ Proposto por: Maria Santos | 18/09/2025 15:45      │
│ Status: ⏳ Aguardando Aprovação                     │
├─────────────────────────────────────────────────────┤
│ DESCRIÇÃO DA SOLUÇÃO:                               │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Reinicialização do serviço principal do        │ │
│ │ mainframe com aplicação de patch de segurança  │ │
│ │                                                 │ │
│ │ Passos:                                         │ │
│ │ 1. Backup completo do sistema                   │ │
│ │ 2. Aplicação do patch durante janela de        │ │
│ │    manutenção                                   │ │
│ │ 3. Testes de funcionalidade                     │ │
│ │ 4. Rollback plan disponível                     │ │
│ └─────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────┤
│ IMPACTO ESTIMADO:                                   │
│ • Tempo de implementação: 4 horas                   │
│ • Downtime necessário: 30 minutos                  │
│ • Sistemas afetados: Mainframe Principal           │
│ • Risco: 🟡 Médio                                   │
├─────────────────────────────────────────────────────┤
│ APROVAÇÕES NECESSÁRIAS:                             │
│ ☐ Gerente de TI (João Silva)                       │
│ ☐ Especialista Mainframe (Pedro Santos)            │
│ ☐ Gerente de Operações (Ana Costa)                 │
├─────────────────────────────────────────────────────┤
│ ┌─ Ações de Aprovação ─────────────────────────────┐ │
│ │ [✅ Aprovar]  [❌ Rejeitar]  [📝 Solicitar     │ │
│ │                                   Alterações]   │ │
│ │                                                 │ │
│ │ Comentários adicionais:                         │ │
│ │ [Textarea para feedback]                        │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ [Salvar] [Cancelar] [Histórico de Alterações]      │
└─────────────────────────────────────────────────────┘
```

### Estados da Proposta
- **Rascunho**: Proposta em elaboração
- **Aguardando Aprovação**: Enviado para revisão
- **Em Análise**: Sendo avaliado pelos aprovadores
- **Aprovado**: Pode prosseguir para implementação
- **Rejeitado**: Necessita revisão ou nova abordagem
- **Alterações Solicitadas**: Feedback recebido, aguardando ajustes

## 6. Sistema de Comentários

### Interface de Comentários
```
┌─────────────────────────────────────────────────────┐
│ COMENTÁRIOS E COMUNICAÇÃO                    [⚙️]   │
├─────────────────────────────────────────────────────┤
│ ┌─ Novo Comentário ─────────────────────────────────┐│
│ │ Para: [Dropdown: Equipe/Pessoa específica]       ││
│ │ Tipo: [●Geral ○Pergunta ○Atualização ○Urgente]  ││
│ │ ┌─────────────────────────────────────────────────┐││
│ │ │ Digite seu comentário...                      │││
│ │ │ [Rich text editor com formatting]            │││
│ │ │                                               │││
│ │ └─────────────────────────────────────────────────┘││
│ │ [📎 Anexar] [🏷️ Tags] [📧 Notificar] [Postar]     ││
│ └─────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────┤
│ ┌─ Comentário Ativo ─────────────────────────────────┐│
│ │ 👤 João Silva [Ativo] | 18/09 16:30             ││
│ │ 🏷️ Atualização                                    ││
│ │                                                   ││
│ │ Patch aplicado com sucesso. Sistema funcionando  ││
│ │ normalmente. Monitorando por mais 2 horas.       ││
│ │                                                   ││
│ │ [👍 2] [👎 0] [💬 Responder] [⋯ Mais]            ││
│ └─────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────┤
│ ┌─ Comentário Inativo ───────────────────────────────┐│
│ │ 👤 Maria Santos [Inativo] | 18/09 14:15         ││
│ │ 🏷️ Pergunta [Resolvida]                          ││
│ │                                                   ││
│ │ Qual o impacto se não aplicarmos o patch hoje?   ││
│ │                                                   ││
│ │ ↳ João Silva: Risco de vulnerabilidade...        ││
│ │                                                   ││
│ │ [✅ Resolvido] [📝 Editar] [🗑️ Arquivar]          ││
│ └─────────────────────────────────────────────────────┘│
│                                                     │
│ [Mostrar Arquivados] [Filtrar por Tipo]            │
└─────────────────────────────────────────────────────┘
```

### Estados dos Comentários
- **Ativo**: Comentário atual, relevante para o status do incidente
- **Inativo**: Comentário arquivado, não relevante para o status atual
- **Resolvido**: Pergunta ou questão que foi respondida/resolvida
- **Urgente**: Comentário que requer atenção imediata
- **Rascunho**: Comentário sendo elaborado, não publicado

### Funcionalidades do Sistema
- **Notificações em Tempo Real**: WebSocket para updates instantâneos
- **Menções**: @usuario para notificação direta
- **Threading**: Respostas aninhadas para organização
- **Rich Text**: Formatting, links, anexos
- **Filtros**: Por tipo, autor, data, status

## 7. Visualizador de Log de Auditoria

### Interface do Log de Auditoria
```
┌─────────────────────────────────────────────────────┐
│ LOG DE AUDITORIA - INC-2025-001              [📥]  │
├─────────────────────────────────────────────────────┤
│ ┌─ Filtros ─────────────────────────────────────────┐│
│ │ Data: [📅 18/09/2025] até [📅 18/09/2025]        ││
│ │ Ação: [Todas ▼] Usuário: [Todos ▼]               ││
│ │ Nível: [Info] [Warning] [Error] [Critical]       ││
│ └─────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────┤
│ ┌─ Entrada de Log ──────────────────────────────────┐│
│ │ 🟢 INFO | 18/09/2025 16:45:23                    ││
│ │ Usuário: João Silva (joao.silva@accenture.com)   ││
│ │ Ação: STATUS_CHANGED                              ││
│ │ De: "Em Tratamento" → Para: "Resolvido"          ││
│ │ IP: 192.168.1.100 | Sessão: sess_abc123         ││
│ │ [📋 Copiar] [🔗 Link] [⚠️ Reportar]              ││
│ └─────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────┤
│ ┌─ Entrada de Log ──────────────────────────────────┐│
│ │ 🟡 WARNING | 18/09/2025 16:30:15                 ││
│ │ Sistema: Automated System                         ││
│ │ Ação: VALIDATION_FAILED                           ││
│ │ Detalhe: Tentativa de alteração sem permissão    ││
│ │ Request ID: req_xyz789                            ││
│ │ [📋 Copiar] [🔗 Link] [⚠️ Reportar]              ││
│ └─────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────┤
│ ┌─ Entrada de Log ──────────────────────────────────┐│
│ │ 🔴 ERROR | 18/09/2025 14:20:45                   ││
│ │ Usuário: Sistema Automático                       ││
│ │ Ação: BACKUP_FAILED                               ││
│ │ Erro: Espaço insuficiente no storage             ││
│ │ Stack: /var/log/mainframe/backup.log:234         ││
│ │ [📋 Copiar] [🔗 Link] [⚠️ Reportar] [📄 Log]     ││
│ └─────────────────────────────────────────────────────┘│
│                                                     │
│ [Exportar CSV] [Imprimir] [Configurar Alertas]     │
└─────────────────────────────────────────────────────┘
```

### Tipos de Eventos Auditados
1. **Alterações de Status**: Mudanças no ciclo de vida do incidente
2. **Modificações de Dados**: Edições nos campos do incidente
3. **Aprovações**: Ações de aprovação/rejeição de propostas
4. **Comentários**: Adição/edição/remoção de comentários
5. **Anexos**: Upload/download/remoção de arquivos
6. **Acesso**: Login/logout, visualizações
7. **Integrações**: Chamadas de APIs, webhooks
8. **Erros do Sistema**: Falhas técnicas, timeouts

### Níveis de Log
- **DEBUG**: Informações técnicas detalhadas
- **INFO**: Operações normais do sistema
- **WARNING**: Situações que merecem atenção
- **ERROR**: Erros que afetam funcionalidade
- **CRITICAL**: Falhas críticas do sistema

## Design System - Cores e Componentes

### Paleta de Cores Accenture
```scss
// Cores Principais
$primary-purple: #A100FF;
$primary-dark: #6B00FF;
$primary-light: #E1CCFF;

// Estados dos Incidentes
$status-review: #FEF3C7;     // Em Revisão
$status-open: #FEE2E2;       // Aberto
$status-progress: #DBEAFE;   // Em Tratamento
$status-resolved: #D1FAE5;   // Resolvido
$status-closed: #F3F4F6;     // Fechado

// Severidade
$severity-critical: #DC2626; // Crítica
$severity-high: #EA580C;     // Alta
$severity-medium: #D97706;   // Média
$severity-low: #65A30D;      // Baixa

// Sistema
$success: #10B981;
$warning: #F59E0B;
$error: #EF4444;
$info: #3B82F6;
```

### Componentes de Design

#### Botões
```scss
// Botão Primário
.btn-primary {
  background: linear-gradient(135deg, #A100FF 0%, #6B00FF 100%);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 12px 24px;
  font-weight: 600;
  transition: all 0.2s;
}

// Botão Secundário
.btn-secondary {
  background: transparent;
  color: #A100FF;
  border: 2px solid #A100FF;
  border-radius: 8px;
  padding: 10px 22px;
}

// Botão de Ação (FAB)
.btn-floating {
  background: #DC2626;
  color: white;
  border-radius: 50%;
  width: 56px;
  height: 56px;
  box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
}
```

#### Cards
```scss
.card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 1px solid #E5E7EB;
  padding: 24px;
  transition: all 0.2s;
}

.card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  transform: translateY(-2px);
}
```

#### Badges de Status
```scss
.badge {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}

.badge-review { background: #FEF3C7; color: #92400E; }
.badge-open { background: #FEE2E2; color: #991B1B; }
.badge-progress { background: #DBEAFE; color: #1E40AF; }
.badge-resolved { background: #D1FAE5; color: #065F46; }
.badge-closed { background: #F3F4F6; color: #374151; }
```

## Responsividade e Breakpoints

### Breakpoints
```scss
// Mobile First Approach
$mobile: 320px;
$tablet: 768px;
$desktop: 1024px;
$large: 1440px;

// Media Queries
@media (max-width: 767px) {
  // Layout mobile: stack vertical, botões full-width
  .incident-card { margin-bottom: 16px; }
  .filters { flex-direction: column; }
}

@media (min-width: 768px) and (max-width: 1023px) {
  // Layout tablet: grid 2 colunas
  .incident-grid { grid-template-columns: 1fr 1fr; }
}

@media (min-width: 1024px) {
  // Layout desktop: grid completo
  .incident-grid { grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); }
}
```

### Adaptações Mobile
1. **Navegação**: Hamburger menu com drawer lateral
2. **Formulários**: Campos stack vertical, labels floating
3. **Tabelas**: Scroll horizontal ou cards empilhados
4. **FAB**: Posição fixa bottom-right, adequado para thumb zone
5. **Modais**: Full-screen em mobile, overlay em desktop

## Acessibilidade (WCAG 2.1 AA)

### Diretrizes Implementadas

#### Contraste de Cores
- Textos normais: 4.5:1 mínimo
- Textos grandes (18px+): 3:1 mínimo
- Elementos interativos: 3:1 mínimo

#### Navegação por Teclado
```html
<!-- Skip Links -->
<nav class="skip-links" aria-label="Skip links">
  <a href="#main-content" class="skip-link">Pular para conteúdo principal</a>
  <a href="#navigation" class="skip-link">Pular para navegação</a>
</nav>

<!-- Focus Indicators -->
.focus-visible {
  outline: 2px solid #A100FF;
  outline-offset: 2px;
}
```

#### ARIA Labels e Roles
```html
<!-- Incident List -->
<main role="main" aria-label="Lista de incidentes">
  <section aria-labelledby="incident-title">
    <h2 id="incident-title">Incidentes Ativos</h2>
    <ul role="list" aria-live="polite" aria-atomic="false">
      <li role="listitem" aria-describedby="inc-001-desc">
        <article aria-labelledby="inc-001-title">
          <h3 id="inc-001-title">INC-2025-001</h3>
          <p id="inc-001-desc">Falha no Sistema Mainframe</p>
        </article>
      </li>
    </ul>
  </section>
</main>
```

#### Screen Reader Support
- Textos alternativos descritivos para ícones
- Estados dinâmicos anunciados via `aria-live`
- Formulários com labels associados corretamente
- Botões com textos descritivos ou `aria-label`

#### Funcionalidades de Acessibilidade
1. **Alto Contraste**: Modo alternativo para visibilidade
2. **Redução de Movimento**: Respeitar `prefers-reduced-motion`
3. **Tamanhos de Fonte**: Suporte a zoom até 200%
4. **Focus Management**: Gerenciamento adequado em modais
5. **Error Handling**: Mensagens de erro claras e associadas

## Métricas de Usabilidade

### KPIs de Interface
1. **Tempo para Criar Incidente**: < 2 minutos
2. **Taxa de Abandono de Formulário**: < 10%
3. **Tempo de Localização de Incidente**: < 30 segundos
4. **Taxa de Erro de Preenchimento**: < 5%
5. **Satisfação do Usuário (SUS)**: > 80 pontos

### Testes de Usabilidade Recomendados
1. **Teste de 5 Segundos**: Primeira impressão da interface
2. **Teste de Tarefa**: Completar fluxo de criação de incidente
3. **Teste A/B**: Variações de layout para otimização
4. **Teste de Acessibilidade**: Navegação com screen reader
5. **Teste de Performance**: Tempo de carregamento < 3s

---

Esta especificação serve como base para implementação da interface de gestão de incidentes, seguindo as diretrizes de design da Accenture e melhores práticas de UX/UI e acessibilidade.