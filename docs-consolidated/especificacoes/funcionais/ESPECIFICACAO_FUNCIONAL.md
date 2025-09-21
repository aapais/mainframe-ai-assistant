# Especificação Funcional Detalhada - v2.0
## Sistema de Gestão de Incidentes com Conhecimento Integrado

### 1. Arquitetura Funcional

#### 1.1 Módulos Principais
```
Sistema Principal
├── Módulo Gestão de Incidentes (Ciclo Completo)
│   ├── Criação e Edição
│   ├── Workflow e Estados
│   ├── Resolução (geração de conhecimento)
│   ├── Dashboard e Métricas
│   └── Relatórios
├── Módulo Busca Unificada
│   ├── Busca em todos os incidentes
│   ├── Filtros por status (incluindo Resolvido)
│   ├── Categorização e Tags
│   └── Histórico e Auditoria
├── Módulo Interface
│   ├── Componentes UI
│   ├── Navegação
│   ├── Acessibilidade
│   └── Responsividade
└── Módulo Infraestrutura
    ├── Banco de Dados Unificado
    ├── Cache
    ├── Segurança
    └── APIs
```

### 2. Especificações Detalhadas por Módulo

#### 2.1 Gestão de Incidentes (Ciclo Completo)

##### 2.1.1 Criação e Resolução de Incidentes
**Componente:** `IncidentForm.tsx`
**Localização:** `/src/renderer/components/forms/IncidentForm.tsx`

**Funcionalidades:**
- Formulário responsivo com validação em tempo real
- Editor rich text para formatação de conteúdo
- Upload de imagens e anexos
- Preview em tempo real
- Salvamento automático (drafts)
- Sugestão automática de incidentes resolvidos similares

**Campos Obrigatórios:**
- Título (string, 10-200 caracteres)
- Descrição do Problema (markdown, 50-5000 caracteres)
- Categoria (select, obrigatório)
- Severidade (select: Baixa, Média, Alta, Crítica)
- Status (Novo, Em Andamento, Aguardando, Resolvido)

**Campos para Resolução:**
- Solução Aplicada (markdown, 50-10000 caracteres) - obrigatório para status "Resolvido"
- Tags de resolução (array de strings)
- Attachments (files)
- Tempo de Resolução (calculado automaticamente)

**Validações:**
- Título único por categoria
- Markdown válido
- Solução obrigatória para mudança para status "Resolvido"
- Tamanho de arquivos < 10MB
- Tipos de arquivo permitidos: .pdf, .doc, .txt, .png, .jpg

##### 2.1.2 Sistema de Busca Unificada
**Componente:** `UnifiedSearch.tsx`
**Localização:** `/src/renderer/components/search/UnifiedSearch.tsx`

**Funcionalidades:**
- Busca full-text em TODOS os incidentes (independente do status)
- Busca por campos específicos (problema, solução, descrição)
- Filtros avançados combinados
- Ordenação por relevância/data/status
- Destacamento de termos (highlighting)
- Sugestões de busca (autocomplete)
- Priorização de incidentes resolvidos como conhecimento

**Filtros Disponíveis:**
- Status (Novo, Em Andamento, Aguardando, Resolvido)
- Categoria (hierarchical select)
- Tags (multiselect com autocomplete)
- Data de criação (date range)
- Data de resolução (date range)
- Autor/Responsável (select)
- Severidade (checkbox group)
- Tempo de Resolução (slider range)

**Algoritmo de Busca:**
1. Preprocessamento da query (normalização, stemming)
2. Busca FTS5 com scoring
3. Aplicação de filtros
4. Ordenação por relevância
5. Paginação de resultados

##### 2.1.3 Visualização de Resultados Unificados
**Componente:** `OptimizedSearchResults.tsx`
**Localização:** `/src/renderer/components/search/OptimizedSearchResults.tsx`

**Funcionalidades:**
- Lista virtualizada para performance
- Cards responsivos com preview
- Diferenciação visual por status do incidente
- Destaque especial para incidentes resolvidos (conhecimento)
- Lazy loading de imagens
- Ações rápidas (visualizar, editar, reutilizar solução)
- Skeleton loading states
- Infinite scroll

**Layout de Card:**
- Título + status badge + categoria badge
- Snippet do problema/solução (se resolvido)
- Metadados (responsável, data criação/resolução)
- Ações contextuais por status (visualizar, editar, aplicar solução)

#### 2.2 Workflow e Estados de Incidentes

##### 2.2.1 Criação de Incidentes
**Componente:** `CreateIncidentModal.tsx`
**Localização:** `/src/renderer/components/incident/CreateIncidentModal.tsx`

**Funcionalidades:**
- Modal responsivo com steps
- Validação em tempo real
- Upload de evidências
- Auto-assignment baseado em regras
- Sugestão automática de incidentes resolvidos similares
- Busca automática em conhecimento existente

**Campos do Formulário:**
- Título (string, obrigatório)
- Descrição (markdown, obrigatória)
- Categoria (select, obrigatório)
- Severidade (select, obrigatório)
- Prioridade (calculada automaticamente)
- Responsável (select, opcional - auto-assign)
- Anexos (files, opcional)
- Tags relacionadas (multiselect)

**Workflow de Criação:**
1. Validação inicial de campos
2. Busca automática por incidentes resolvidos similares
3. Apresentação de sugestões de soluções conhecidas
4. Confirmação de criação ou aplicação de solução existente
5. Atribuição automática se configurado
6. Notificação ao responsável

##### 2.2.2 Dashboard de Incidentes
**Componente:** `IncidentManagementDashboard.tsx`
**Localização:** `/src/renderer/components/incident/IncidentManagementDashboard.tsx`

**Funcionalidades:**
- Overview de incidentes ativos
- Métricas em tempo real
- Filtros avançados
- Gráficos e visualizações
- Exportação de dados
- Alertas de SLA

**Widgets do Dashboard:**
- Contadores por status
- Gráfico de tendências
- Top categorias
- SLA compliance
- Performance da equipe
- Incidentes críticos

**Filtros do Dashboard:**
- Status (multiselect)
- Severidade (checkbox)
- Responsável (select)
- Categoria (hierarchical)
- Data range (date picker)
- SLA status (select)

##### 2.2.3 Workflow de Estados
**Estados Disponíveis:**
- **Novo**: Incidente criado, aguardando triagem
- **Em Andamento**: Sendo investigado/resolvido
- **Aguardando**: Pendente de informações/aprovação
- **Resolvido**: Solução aplicada, torna-se conhecimento disponível

**Transições Permitidas:**
```
Novo → [Em Andamento]
Em Andamento → [Aguardando, Resolvido]
Aguardando → [Em Andamento]
Resolvido → [Em Andamento] (reabertura apenas)
```

**Nota:** Incidentes resolvidos permanecem no sistema como conhecimento e podem ser reabertos se necessário.

**Regras de Negócio:**
- Apenas responsável pode alterar status
- Comentário obrigatório em mudanças de status
- Notificação automática para stakeholders
- Tracking de tempo em cada estado
- Validação de SLA em cada transição

#### 2.3 Interface e Navegação

##### 2.3.1 Layout Principal
**Componente:** `AppWithRouter.tsx`
**Localização:** `/src/renderer/AppWithRouter.tsx`

**Estrutura:**
- Header com navegação principal
- Sidebar com filtros/navegação contextual
- Main content area
- Footer com informações/ações
- Modals overlay system

**Navegação Principal:**
- Dashboard (home)
- Incidentes (todos os status)
- Conhecimento (filtro para incidentes resolvidos)
- Relatórios
- Configurações

##### 2.3.2 Sistema de Modais
**Componente:** `Modal.tsx`
**Localização:** `/src/renderer/components/ui/Modal.tsx`

**Funcionalidades:**
- Z-index management
- Focus trap
- Keyboard navigation (ESC to close)
- Backdrop click to close
- Accessibility compliance
- Responsive design

**Tipos de Modal:**
- Criação/Edição de entradas
- Visualização de detalhes
- Confirmação de ações
- Configurações
- Help/Tutorial

### 3. Especificações de Performance

#### 3.1 Métricas Alvo
- **Tempo de busca**: < 500ms para 10k registros
- **Renderização inicial**: < 2s
- **Navegação**: < 300ms entre páginas
- **Upload de arquivos**: Progress feedback
- **Infinite scroll**: 50 items por batch

#### 3.2 Otimizações Implementadas
- Virtual scrolling para listas grandes
- Lazy loading de componentes
- Image optimization
- Bundle splitting
- Service worker para cache
- Debounced search
- Memoização de componentes

### 4. Especificações de Acessibilidade

#### 4.1 Conformidade WCAG 2.1 AA
- **Perceptível**: Alto contraste, texto alternativo
- **Operável**: Navegação por teclado, sem seizures
- **Compreensível**: Linguagem clara, comportamento previsível
- **Robusto**: Compatibilidade com tecnologias assistivas

#### 4.2 Implementações Específicas
- Skip navigation links
- ARIA labels e descriptions
- Focus management
- Screen reader optimization
- Keyboard shortcuts
- High contrast mode

### 5. Especificações de Dados

#### 5.1 Schema do Banco
**Tabela Unificada: incidents (inclui conhecimento)**
```sql
CREATE TABLE incidents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL, -- problema reportado
  solution TEXT, -- solução aplicada (obrigatória para status 'Resolvido')
  category_id INTEGER,
  tags TEXT, -- JSON array
  severity TEXT CHECK(severity IN ('Baixa', 'Média', 'Alta', 'Crítica')),
  status TEXT DEFAULT 'Novo' CHECK(status IN ('Novo', 'Em Andamento', 'Aguardando', 'Resolvido')),
  assigned_to TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME, -- quando foi resolvido (torna-se conhecimento)
  resolution_time INTEGER, -- tempo para resolução em minutos
  reuse_count INTEGER DEFAULT 0, -- quantas vezes a solução foi reutilizada
  FOREIGN KEY (category_id) REFERENCES categories(id)
);
```

#### 5.2 Índices para Performance
```sql
-- Busca full-text unificada
CREATE VIRTUAL TABLE incidents_fts USING fts5(
  title, description, solution, content=incidents, content_rowid=id
);

-- Índices para filtros
CREATE INDEX idx_incidents_category ON incidents(category_id);
CREATE INDEX idx_incidents_status ON incidents(status);
CREATE INDEX idx_incidents_severity ON incidents(severity);
CREATE INDEX idx_incidents_created_at ON incidents(created_at);
CREATE INDEX idx_incidents_resolved_at ON incidents(resolved_at);
CREATE INDEX idx_incidents_status_resolved ON incidents(status) WHERE status = 'Resolvido';
```

### 6. APIs e Integrações

#### 6.1 IPC Handlers (Electron)
**Localização:** `/src/main/ipc-handlers.ts`

**Operações Disponíveis:**
- `incident:search` - Busca unificada em todos os incidentes
- `incident:create` - Criar novo incidente
- `incident:update` - Atualizar incidente (incluindo resolução)
- `incident:list` - Listar incidentes com filtros
- `incident:resolve` - Marcar como resolvido (torna-se conhecimento)
- `incident:reopen` - Reabrir incidente resolvido
- `knowledge:search` - Busca específica em incidentes resolvidos
- `settings:get` - Obter configurações
- `settings:update` - Atualizar configurações

#### 6.2 Estrutura de Response
```typescript
interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    total: number;
    page: number;
    limit: number;
  };
}
```

### 7. Testes e Validação

#### 7.1 Cobertura de Testes
- Unit tests: > 80% coverage
- Integration tests: Principais workflows
- E2E tests: User journeys críticos
- Accessibility tests: WCAG compliance
- Performance tests: Load/stress testing

#### 7.2 Ferramentas de Teste
- Jest para unit/integration tests
- Playwright para E2E tests
- axe-core para accessibility
- Lighthouse para performance
- MSW para mocking de APIs

---

**Documento Técnico Aprovado:** Equipe de Desenvolvimento
**Última Atualização:** 21/09/2024
**Status:** Em Implementação - Fase 2 - Arquitetura Unificada