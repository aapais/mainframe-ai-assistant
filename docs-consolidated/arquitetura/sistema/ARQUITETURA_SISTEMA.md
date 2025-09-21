# Arquitetura do Sistema - v2.0
## Sistema de Gestão de Incidentes com Conhecimento Integrado

### 1. Visão Arquitetural Geral

#### 1.1 Arquitetura de Alto Nível
```
┌─────────────────────────────────────────────────────────────┐
│                    Apresentação (UI)                        │
├─────────────────────────────────────────────────────────────┤
│  React Components │ TypeScript │ Electron Renderer Process  │
├─────────────────────────────────────────────────────────────┤
│                   Camada de Negócio                         │
├─────────────────────────────────────────────────────────────┤
│     Services    │    Hooks     │    Context Providers      │
├─────────────────────────────────────────────────────────────┤
│                 Camada de Comunicação                       │
├─────────────────────────────────────────────────────────────┤
│         IPC (Inter-Process Communication)                   │
├─────────────────────────────────────────────────────────────┤
│                   Processo Principal                        │
├─────────────────────────────────────────────────────────────┤
│  IPC Handlers  │  Database    │  File System │  Security   │
├─────────────────────────────────────────────────────────────┤
│                   Camada de Dados                          │
├─────────────────────────────────────────────────────────────┤
│    SQLite Database    │    File Storage    │    Cache      │
└─────────────────────────────────────────────────────────────┘
```

#### 1.2 Padrões Arquiteturais Aplicados
- **Clean Architecture**: Separação clara de responsabilidades
- **Component-Based**: Reutilização e manutenibilidade
- **Event-Driven**: Comunicação assíncrona via IPC
- **Repository Pattern**: Abstração da camada de dados
- **Dependency Injection**: Inversão de controle

### 2. Estrutura de Diretórios

```
src/
├── main/                          # Processo Principal Electron
│   ├── ipc/
│   │   └── handlers/              # Handlers IPC por domínio
│   │       ├── IncidentHandler.ts
│   │       └── UnifiedHandler.ts  # Handler unificado para busca
│   └── database/                  # Configuração e migrations
├── renderer/                      # Processo de Renderização
│   ├── components/                # Componentes React
│   │   ├── ui/                   # Componentes base/primitivos
│   │   ├── forms/                # Componentes de formulário
│   │   ├── incident/             # Gestão completa de incidentes
│   │   ├── knowledge/            # Visualização de conhecimento (incidentes resolvidos)
│   │   ├── search/               # Sistema de busca unificada
│   │   ├── modals/               # Modais e overlays
│   │   └── accessibility/        # Componentes de acessibilidade
│   ├── hooks/                    # Custom React Hooks
│   ├── contexts/                 # Context Providers
│   ├── services/                 # Serviços de negócio
│   ├── utils/                    # Utilitários e helpers
│   └── styles/                   # Estilos globais e themes
├── services/                     # Serviços compartilhados
├── types/                        # Definições TypeScript
├── database/                     # Schema e migrations
└── tests/                        # Testes automatizados
```

### 3. Camadas da Arquitetura

#### 3.1 Camada de Apresentação

**Tecnologias:**
- React 18 com TypeScript
- CSS Modules + CSS Variables
- Componentes acessíveis (WCAG 2.1 AA)

**Estrutura de Componentes:**
```
Components/
├── ui/                    # Componentes primitivos
│   ├── Button.tsx         # Botões padronizados
│   ├── Input.tsx          # Inputs com validação
│   ├── Modal.tsx          # Sistema de modais
│   └── Typography.tsx     # Componentes de texto
├── forms/                 # Formulários complexos
│   ├── IncidentForm.tsx   # Formulário unificado de incidentes
│   └── ResolutionForm.tsx # Formulário de resolução (gera conhecimento)
├── search/                # Sistema de busca
│   ├── UnifiedSearch.tsx  # Busca em todos os incidentes
│   └── FiltersDropdown.tsx # Filtros incluindo status
└── layout/                # Componentes de layout
    └── AppLayout.tsx      # Layout principal
```

**Padrões de Componentes:**
- **Controlled Components**: Estado gerenciado pelo React
- **Compound Components**: Composição flexível
- **Render Props**: Reutilização de lógica
- **Higher-Order Components**: Cross-cutting concerns

#### 3.2 Camada de Negócio

**Services:**
```typescript
// Exemplo: IncidentService.ts
export class IncidentService {
  async createIncident(data: CreateIncidentRequest): Promise<Incident> {
    // Validação de regras de negócio
    // Busca automática por soluções similares
    // Comunicação com IPC
    // Tratamento de erros
  }

  async resolveIncident(
    id: string,
    solution: string
  ): Promise<void> {
    // Validação da solução
    // Marcação como resolvido
    // Torna-se conhecimento disponível
    // Notificações automáticas
    // Auditoria
  }

  async searchKnowledge(query: string): Promise<Incident[]> {
    // Busca específica em incidentes resolvidos
    // Ordenação por relevância e reutilização
  }
}
```

**Custom Hooks:**
```typescript
// Exemplo: useIncidentWorkflow.ts
export function useIncidentWorkflow(incidentId: string) {
  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(false);

  const updateStatus = useCallback(async (newStatus: IncidentStatus) => {
    // Lógica de atualização com otimistic updates
  }, [incidentId]);

  return { incident, loading, updateStatus };
}
```

#### 3.3 Camada de Comunicação (IPC)

**IPC Handlers:**
```typescript
// Exemplo: IncidentHandler.ts
export class IncidentHandler {
  async handleCreateIncident(
    event: IpcMainInvokeEvent,
    data: CreateIncidentRequest
  ): Promise<APIResponse<Incident>> {
    try {
      // Validação
      const validatedData = await this.validateIncidentData(data);

      // Criação no banco
      const incident = await this.incidentRepository.create(validatedData);

      // Notificações
      await this.notificationService.notifyIncidentCreated(incident);

      return { success: true, data: incident };
    } catch (error) {
      return {
        success: false,
        error: { code: 'CREATION_FAILED', message: error.message }
      };
    }
  }
}
```

**Channels IPC:**
```typescript
// Canais organizados por domínio
const IPC_CHANNELS = {
  KNOWLEDGE: {
    SEARCH: 'knowledge:search', // busca em incidentes resolvidos
    REUSE: 'knowledge:reuse'    // reutilizar solução
  },
  INCIDENT: {
    CREATE: 'incident:create',
    UPDATE: 'incident:update',
    RESOLVE: 'incident:resolve', // marcar como resolvido
    REOPEN: 'incident:reopen',   // reabrir incidente
    LIST: 'incident:list',
    GET: 'incident:get',
    SEARCH: 'incident:search'    // busca unificada
  },
  SETTINGS: {
    GET: 'settings:get',
    UPDATE: 'settings:update'
  }
} as const;
```

#### 3.4 Camada de Dados

**Database Schema:**
```sql
-- Schema unificado com FTS5 para busca
CREATE TABLE incidents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,  -- problema reportado
  solution TEXT,              -- solução (obrigatória para status 'Resolvido')
  category_id INTEGER,
  tags TEXT,                  -- JSON array
  severity TEXT,
  status TEXT DEFAULT 'Novo' CHECK(status IN ('Novo', 'Em Andamento', 'Aguardando', 'Resolvido')),
  assigned_to TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME,       -- quando torna-se conhecimento
  reuse_count INTEGER DEFAULT 0, -- quantas vezes foi reutilizado como conhecimento
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- Índice FTS5 para busca unificada
CREATE VIRTUAL TABLE incidents_fts USING fts5(
  title, description, solution,
  content=incidents,
  content_rowid=id
);
```

**Repository Pattern:**
```typescript
export interface IIncidentRepository {
  create(data: CreateIncidentRequest): Promise<Incident>;
  findById(id: string): Promise<Incident | null>;
  findByFilters(filters: IncidentFilters): Promise<PaginatedResult<Incident>>;
  findResolved(filters?: KnowledgeFilters): Promise<PaginatedResult<Incident>>; // busca conhecimento
  update(id: string, data: UpdateIncidentRequest): Promise<Incident>;
  resolve(id: string, solution: string): Promise<Incident>; // marcar como resolvido
  reopen(id: string): Promise<Incident>; // reabrir incidente
  incrementReuseCount(id: string): Promise<void>; // rastrear reutilização
}

export class SQLiteIncidentRepository implements IIncidentRepository {
  constructor(private db: Database) {}

  async create(data: CreateIncidentRequest): Promise<Incident> {
    // Buscar incidentes resolvidos similares para sugestão
    const similarResolved = await this.findSimilarResolved(data.description);

    const stmt = this.db.prepare(`
      INSERT INTO incidents (title, description, category_id, severity, status)
      VALUES (?, ?, ?, ?, 'Novo')
    `);

    const result = stmt.run(data.title, data.description, data.categoryId, data.severity);
    const incident = await this.findById(result.lastInsertRowid.toString());

    // Retornar com sugestões de conhecimento
    incident.suggestedSolutions = similarResolved;
    return incident;
  }

  async resolve(id: string, solution: string): Promise<Incident> {
    const stmt = this.db.prepare(`
      UPDATE incidents
      SET solution = ?, status = 'Resolvido', resolved_at = CURRENT_TIMESTAMP,
          resolution_time = (julianday('now') - julianday(created_at)) * 24 * 60
      WHERE id = ?
    `);

    stmt.run(solution, id);
    return this.findById(id);
  }
}
```

### 4. Segurança e Performance

#### 4.1 Segurança
- **Context Isolation**: Separação entre main e renderer
- **Preload Scripts**: API controlada entre processos
- **CSP (Content Security Policy)**: Prevenção de XSS
- **Input Validation**: Sanitização em todas as camadas
- **SQL Injection Prevention**: Prepared statements

#### 4.2 Performance
- **Virtual Scrolling**: Listas grandes otimizadas
- **Code Splitting**: Carregamento sob demanda
- **Memoization**: React.memo e useMemo
- **Database Indexing**: Otimização de queries
- **Caching**: Cache em memória e localStorage

### 5. Padrões de Design

#### 5.1 Component Patterns
```typescript
// Compound Component Pattern
export function SearchInterface({ children }: { children: React.ReactNode }) {
  return <div className="search-interface">{children}</div>;
}

SearchInterface.Input = SearchInput;
SearchInterface.Filters = SearchFilters;
SearchInterface.Results = SearchResults;

// Usage
<SearchInterface>
  <SearchInterface.Input />
  <SearchInterface.Filters />
  <SearchInterface.Results />
</SearchInterface>
```

#### 5.2 State Management
```typescript
// Context + Reducer Pattern
interface AppState {
  incidents: Incident[];          // todos os incidentes
  knowledge: Incident[];          // cache de incidentes resolvidos
  activeFilters: FilterState;
  ui: UIState;
}

type AppAction =
  | { type: 'INCIDENTS_LOADED'; payload: Incident[] }
  | { type: 'INCIDENT_CREATED'; payload: Incident }
  | { type: 'INCIDENT_RESOLVED'; payload: Incident }  // novo conhecimento
  | { type: 'KNOWLEDGE_LOADED'; payload: Incident[] }  // cache de conhecimento
  | { type: 'FILTERS_UPDATED'; payload: Partial<FilterState> };

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'INCIDENTS_LOADED':
      return { ...state, incidents: action.payload };
    // ... outros cases
  }
}
```

### 6. Integração e Extensibilidade

#### 6.1 Plugin Architecture
```typescript
interface Plugin {
  name: string;
  version: string;
  activate(): Promise<void>;
  deactivate(): Promise<void>;
  contribute?: {
    commands?: Command[];
    views?: View[];
    settings?: Setting[];
  };
}

class PluginManager {
  private plugins = new Map<string, Plugin>();

  async loadPlugin(plugin: Plugin): Promise<void> {
    await plugin.activate();
    this.plugins.set(plugin.name, plugin);
  }
}
```

#### 6.2 API Externa
```typescript
// REST API para integrações externas
app.get('/api/incidents', authenticateToken, async (req, res) => {
  const filters = parseFilters(req.query);
  const incidents = await incidentService.findByFilters(filters);
  res.json({ success: true, data: incidents });
});

// Endpoint específico para conhecimento (incidentes resolvidos)
app.get('/api/knowledge', authenticateToken, async (req, res) => {
  const filters = parseFilters(req.query);
  const knowledge = await incidentService.findResolved(filters);
  res.json({ success: true, data: knowledge });
});

app.post('/api/incidents', authenticateToken, async (req, res) => {
  const incident = await incidentService.create(req.body);
  res.json({ success: true, data: incident });
});

// Endpoint para marcar como resolvido (gerar conhecimento)
app.put('/api/incidents/:id/resolve', authenticateToken, async (req, res) => {
  const incident = await incidentService.resolve(req.params.id, req.body.solution);
  res.json({ success: true, data: incident });
});
```

### 7. Monitoramento e Observabilidade

#### 7.1 Logging
```typescript
interface Logger {
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, error?: Error, meta?: any): void;
}

class FileLogger implements Logger {
  info(message: string, meta?: any): void {
    this.writeLog('INFO', message, meta);
  }

  private writeLog(level: string, message: string, meta?: any): void {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, level, message, meta };
    // Escrever em arquivo ou enviar para serviço
  }
}
```

#### 7.2 Métricas
```typescript
class MetricsCollector {
  private metrics = new Map<string, number>();

  increment(name: string, value = 1): void {
    const current = this.metrics.get(name) || 0;
    this.metrics.set(name, current + value);
  }

  gauge(name: string, value: number): void {
    this.metrics.set(name, value);
  }

  getMetrics(): Record<string, number> {
    return Object.fromEntries(this.metrics);
  }
}
```

### 8. Deployment e Distribuição

#### 8.1 Build Pipeline
```yaml
# Build para produção
build:
  - npm run typecheck     # Verificação TypeScript
  - npm run lint         # Linting
  - npm run test         # Testes
  - npm run build        # Build otimizado
  - npm run package      # Packaging Electron
```

#### 8.2 Configuração de Ambiente
```typescript
interface Config {
  database: {
    path: string;
    backupPath: string;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    file: string;
  };
  performance: {
    enableVirtualScrolling: boolean;
    cacheSize: number;
  };
}

const config: Config = {
  database: {
    path: process.env.DB_PATH || './data/app.db',
    backupPath: process.env.BACKUP_PATH || './backups/'
  },
  // ... outras configurações
};
```

---

**Documento Arquitetural Aprovado:** Arquiteto de Software
**Última Atualização:** 21/09/2024
**Versão da Arquitetura:** v2.0 - Arquitetura Unificada
**Próxima Revisão:** Trimestral