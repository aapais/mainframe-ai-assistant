# Developer Migration Guide V2.0
## Transitioning to the New Unified Architecture

**Version**: 2.0.0
**Date**: September 21, 2024
**Target Audience**: Development Team

---

## 🎯 Migration Overview

This guide helps developers transition from the legacy multi-schema system to the new unified architecture. The migration represents a significant architectural shift from separate incident and knowledge base systems to an integrated approach.

## 📋 Pre-Migration Checklist

### Development Environment
- [ ] **Node.js**: Upgrade to >= 18.0.0
- [ ] **npm**: Upgrade to >= 9.0.0
- [ ] **VS Code**: Install recommended extensions (see `.vscode/extensions.json`)
- [ ] **Git**: Ensure you have latest changes from master branch

### Database Backup
```bash
# Create backup before migration
cp src/database/app.db src/database/app.db.backup-$(date +%Y%m%d)

# Verify backup
sqlite3 src/database/app.db.backup-$(date +%Y%m%d) ".tables"
```

### Code Changes Preparation
- [ ] **Stash Changes**: `git stash push -m "pre-migration-backup"`
- [ ] **Clean Install**: `rm -rf node_modules package-lock.json && npm install`
- [ ] **Verify Build**: `npm run build`

---

## 🗃️ Database Migration Changes

### Schema Changes
The most significant change is the consolidation from multiple schemas to a single unified schema:

#### Before (Legacy)
```sql
-- Separate tables
CREATE TABLE incidents (
    id TEXT PRIMARY KEY,
    title TEXT,
    description TEXT,
    status TEXT,
    -- incident-specific fields
);

CREATE TABLE kb_entries (
    id TEXT PRIMARY KEY,
    title TEXT,
    problem TEXT,
    solution TEXT,
    -- knowledge-specific fields
);
```

#### After (Unified)
```sql
-- Single table with type discrimination
CREATE TABLE entries (
    id TEXT PRIMARY KEY,
    entry_type TEXT CHECK(entry_type IN ('incident', 'knowledge')),
    title TEXT,
    description TEXT,
    solution TEXT,

    -- Incident fields
    incident_status TEXT,
    priority INTEGER,
    assigned_to TEXT,

    -- Knowledge fields
    usage_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,

    -- Common fields
    category TEXT,
    severity TEXT,
    created_at DATETIME,
    resolved_at DATETIME
);
```

### Migration Script
```bash
# Run the unified migration
npm run migrate

# Verify migration success
npm run migrate:status

# Check data integrity
sqlite3 src/database/app.db "SELECT COUNT(*) FROM entries WHERE entry_type = 'incident';"
sqlite3 src/database/app.db "SELECT COUNT(*) FROM entries WHERE entry_type = 'knowledge';"
```

---

## 🔧 Service Layer Changes

### Before: Separate Services
```typescript
// Legacy approach - separate services
import { IncidentService } from './IncidentService';
import { KnowledgeBaseService } from './KnowledgeBaseService';

// Creating an incident
const incident = await IncidentService.create(incidentData);

// Creating knowledge
const knowledge = await KnowledgeBaseService.create(knowledgeData);

// Separate search calls
const incidents = await IncidentService.search(query);
const knowledge = await KnowledgeBaseService.search(query);
```

### After: Unified Service
```typescript
// New approach - unified service
import { UnifiedEntryService } from './UnifiedEntryService';

// Creating an incident (auto-sets entry_type = 'incident')
const incident = await UnifiedEntryService.createIncident(incidentData);

// Resolving incident (auto-converts to knowledge)
const resolved = await UnifiedEntryService.resolveIncident(
  incidentId,
  { solution: "Fixed by restarting service", tags: ["restart", "service"] }
);

// Unified search across both types
const results = await UnifiedEntryService.searchEntries(query, {
  type: 'all', // or 'incidents' or 'knowledge'
  filters: { category: 'network', severity: 'high' }
});

// Type-specific operations still available
const activeIncidents = await UnifiedEntryService.getActiveIncidents();
const popularKnowledge = await UnifiedEntryService.getPopularKnowledge();
```

### API Method Mapping
| Legacy Method | New Method | Notes |
|--------------|------------|-------|
| `IncidentService.create()` | `UnifiedEntryService.createIncident()` | Auto-sets entry_type |
| `IncidentService.update()` | `UnifiedEntryService.updateEntry()` | Works for both types |
| `IncidentService.resolve()` | `UnifiedEntryService.resolveIncident()` | Creates knowledge automatically |
| `KnowledgeBaseService.create()` | `UnifiedEntryService.createKnowledge()` | Direct knowledge creation |
| `KnowledgeBaseService.search()` | `UnifiedEntryService.searchEntries()` | Unified search with filters |

---

## 🎨 Component Migration

### Component Consolidation
Many components have been consolidated or updated:

#### Removed Components (No longer needed)
```typescript
// These components were removed in the cleanup
import { AdvancedKBEntryList } from './components/KB/AdvancedKBEntryList'; // ❌ Removed
import { ComprehensiveKBManager } from './components/KB/ComprehensiveKBManager'; // ❌ Removed
import { CategoryTreeNavigation } from './components/KB/CategoryTreeNavigation'; // ❌ Removed

// Use these instead
import { UnifiedSearch } from './components/search/UnifiedSearch'; // ✅ New
import { UnifiedEntryCard } from './components/unified/UnifiedEntryCard'; // ✅ New
```

#### Updated Component Usage
```typescript
// Before: Separate incident and KB components
<IncidentCard incident={incident} />
<KBEntryCard entry={kbEntry} />

// After: Unified component that auto-detects type
<UnifiedEntryCard
  entry={entry}
  variant="auto" // Automatically detects incident vs knowledge
  showWorkflowActions={entry.entry_type === 'incident'}
  showKnowledgeActions={entry.entry_type === 'knowledge'}
/>

// Or explicitly specify type
<UnifiedEntryCard
  entry={entry}
  variant="incident"
  onStatusChange={handleStatusChange}
  onResolve={handleResolve}
/>
```

### Search Component Migration
```typescript
// Before: Separate search components
import { IncidentSearch } from './IncidentSearch';
import { KBSearch } from './KBSearch';

function OldSearchInterface() {
  return (
    <Tabs>
      <TabPanel value="incidents">
        <IncidentSearch onSelect={handleIncidentSelect} />
      </TabPanel>
      <TabPanel value="knowledge">
        <KBSearch onSelect={handleKnowledgeSelect} />
      </TabPanel>
    </Tabs>
  );
}

// After: Unified search component
import { UnifiedSearch } from './UnifiedSearch';

function NewSearchInterface() {
  return (
    <UnifiedSearch
      searchType="all" // 'all', 'incidents', 'knowledge'
      showActiveIncidentsOnly={false}
      onResultSelect={handleResultSelect}
      onSearchTypeChange={setSearchType}
      filters={{
        category: selectedCategory,
        severity: selectedSeverity,
        dateRange: dateRange
      }}
    />
  );
}
```

---

## 🔄 IPC Handler Updates

### Handler Consolidation
IPC handlers have been consolidated for better maintainability:

#### Before: Separate Handlers
```typescript
// Legacy: main/ipc/handlers/IncidentHandler.ts
export class IncidentHandler {
  async handleCreateIncident(event, data) { /* ... */ }
  async handleUpdateIncident(event, { id, updates }) { /* ... */ }
  async handleSearchIncidents(event, { query }) { /* ... */ }
}

// Legacy: main/ipc/handlers/KBHandler.ts
export class KBHandler {
  async handleCreateKBEntry(event, data) { /* ... */ }
  async handleUpdateKBEntry(event, { id, updates }) { /* ... */ }
  async handleSearchKB(event, { query }) { /* ... */ }
}
```

#### After: Unified Handler
```typescript
// New: main/ipc/handlers/UnifiedHandler.ts
export class UnifiedHandler {
  // Entry operations (works for both types)
  async handleCreateEntry(event, data) {
    const entryType = data.entry_type || 'incident';
    return await this.unifiedService.createEntry({ ...data, entry_type: entryType });
  }

  async handleUpdateEntry(event, { id, updates }) {
    return await this.unifiedService.updateEntry(id, updates);
  }

  // Unified search
  async handleSearchEntries(event, { query, filters }) {
    return await this.unifiedService.searchEntries(query, filters);
  }

  // Incident-specific operations
  async handleResolveIncident(event, { id, resolution }) {
    return await this.unifiedService.resolveIncident(id, resolution);
  }

  // Knowledge-specific operations
  async handleRecordUsage(event, { id, success }) {
    return await this.unifiedService.recordUsage(id, success);
  }
}
```

### Handler Registration
```typescript
// main/main.ts - Updated handler registration
import { UnifiedHandler } from './ipc/handlers/UnifiedHandler';

const unifiedHandler = new UnifiedHandler();

// Unified endpoints
ipcMain.handle('entry:create', unifiedHandler.handleCreateEntry);
ipcMain.handle('entry:update', unifiedHandler.handleUpdateEntry);
ipcMain.handle('entry:search', unifiedHandler.handleSearchEntries);

// Type-specific endpoints
ipcMain.handle('incident:resolve', unifiedHandler.handleResolveIncident);
ipcMain.handle('knowledge:record-usage', unifiedHandler.handleRecordUsage);

// Backward compatibility (optional)
ipcMain.handle('incident:create', (event, data) =>
  unifiedHandler.handleCreateEntry(event, { ...data, entry_type: 'incident' })
);
```

---

## 🎯 Frontend API Changes

### ElectronAPI Updates
```typescript
// types/electronAPI.d.ts - Updated interface
interface ElectronAPI {
  // Unified operations
  entry: {
    create: (data: CreateEntryData) => Promise<UnifiedEntry>;
    update: (id: string, updates: UpdateEntryData) => Promise<UnifiedEntry>;
    get: (id: string) => Promise<UnifiedEntry>;
    delete: (id: string) => Promise<void>;
    search: (query: string, filters?: SearchFilters) => Promise<SearchResults>;
  };

  // Incident-specific operations
  incident: {
    resolve: (id: string, resolution: ResolutionData) => Promise<UnifiedEntry>;
    updateStatus: (id: string, status: IncidentStatus) => Promise<void>;
    assign: (id: string, assignee: string) => Promise<void>;
    getQueue: (filters?: IncidentFilters) => Promise<UnifiedEntry[]>;
  };

  // Knowledge-specific operations
  knowledge: {
    recordUsage: (id: string, success: boolean) => Promise<void>;
    rate: (id: string, rating: number) => Promise<void>;
    getPopular: (limit?: number) => Promise<UnifiedEntry[]>;
  };

  // Legacy compatibility (deprecated)
  /** @deprecated Use entry.create with entry_type: 'incident' */
  createIncident: (data: IncidentData) => Promise<UnifiedEntry>;
  /** @deprecated Use entry.create with entry_type: 'knowledge' */
  createKBEntry: (data: KBData) => Promise<UnifiedEntry>;
}
```

### React Hook Updates
```typescript
// hooks/useIncidents.ts - Updated to use unified service
export function useIncidents() {
  const [incidents, setIncidents] = useState<UnifiedEntry[]>([]);

  const createIncident = useCallback(async (data: CreateIncidentData) => {
    // Uses unified API with automatic type setting
    const incident = await window.electronAPI.incident.create(data);
    setIncidents(prev => [incident, ...prev]);
    return incident;
  }, []);

  const resolveIncident = useCallback(async (id: string, resolution: ResolutionData) => {
    // Resolution automatically creates knowledge entry
    const resolved = await window.electronAPI.incident.resolve(id, resolution);
    setIncidents(prev => prev.map(inc => inc.id === id ? resolved : inc));
    return resolved;
  }, []);

  const searchIncidents = useCallback(async (query: string) => {
    // Uses unified search with incident filter
    const results = await window.electronAPI.entry.search(query, {
      type: 'incidents',
      activeOnly: true
    });
    return results.entries;
  }, []);

  return {
    incidents,
    createIncident,
    resolveIncident,
    searchIncidents,
    // ... other methods
  };
}
```

---

## ✅ Testing Migration

### Test File Updates
Many test files need updates to work with the new unified architecture:

#### Before: Separate Test Files
```typescript
// tests/services/IncidentService.test.ts
describe('IncidentService', () => {
  test('creates incident successfully', async () => {
    const incident = await IncidentService.create(mockIncidentData);
    expect(incident.id).toBeDefined();
  });
});

// tests/services/KBService.test.ts
describe('KBService', () => {
  test('creates KB entry successfully', async () => {
    const entry = await KBService.create(mockKBData);
    expect(entry.id).toBeDefined();
  });
});
```

#### After: Unified Test Files
```typescript
// tests/services/UnifiedEntryService.test.ts
describe('UnifiedEntryService', () => {
  test('creates incident successfully', async () => {
    const incident = await UnifiedEntryService.createIncident(mockIncidentData);
    expect(incident.entry_type).toBe('incident');
    expect(incident.id).toBeDefined();
  });

  test('creates knowledge entry successfully', async () => {
    const knowledge = await UnifiedEntryService.createKnowledge(mockKnowledgeData);
    expect(knowledge.entry_type).toBe('knowledge');
    expect(knowledge.id).toBeDefined();
  });

  test('resolves incident and creates knowledge', async () => {
    // Create incident
    const incident = await UnifiedEntryService.createIncident(mockIncidentData);

    // Resolve it
    const resolved = await UnifiedEntryService.resolveIncident(incident.id, {
      solution: 'Test solution',
      tags: ['test']
    });

    expect(resolved.incident_status).toBe('resolvido');
    expect(resolved.solution).toBe('Test solution');

    // Verify it's searchable as knowledge
    const searchResults = await UnifiedEntryService.searchEntries('test solution', {
      type: 'knowledge'
    });
    expect(searchResults.entries).toContain(
      expect.objectContaining({ id: resolved.id })
    );
  });

  test('unified search works across types', async () => {
    const results = await UnifiedEntryService.searchEntries('test query', {
      type: 'all'
    });

    const incidentResults = results.entries.filter(e => e.entry_type === 'incident');
    const knowledgeResults = results.entries.filter(e => e.entry_type === 'knowledge');

    expect(incidentResults.length).toBeGreaterThanOrEqual(0);
    expect(knowledgeResults.length).toBeGreaterThanOrEqual(0);
  });
});
```

### Component Test Updates
```typescript
// tests/components/UnifiedEntryCard.test.tsx
describe('UnifiedEntryCard', () => {
  test('renders incident variant correctly', () => {
    const mockIncident = createMockEntry('incident');

    render(
      <UnifiedEntryCard
        entry={mockIncident}
        variant="incident"
        showWorkflowActions={true}
      />
    );

    expect(screen.getByText(mockIncident.title)).toBeInTheDocument();
    expect(screen.getByText('Incident Status')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /resolve/i })).toBeInTheDocument();
  });

  test('renders knowledge variant correctly', () => {
    const mockKnowledge = createMockEntry('knowledge');

    render(
      <UnifiedEntryCard
        entry={mockKnowledge}
        variant="knowledge"
        showKnowledgeActions={true}
      />
    );

    expect(screen.getByText(mockKnowledge.title)).toBeInTheDocument();
    expect(screen.getByText('Solution')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rate/i })).toBeInTheDocument();
  });

  test('auto-detects entry type', () => {
    const mockIncident = createMockEntry('incident');

    render(<UnifiedEntryCard entry={mockIncident} variant="auto" />);

    // Should automatically show incident-specific UI
    expect(screen.getByText('Incident Status')).toBeInTheDocument();
  });
});
```

---

## 🚀 Deployment Migration

### Environment Updates
```bash
# .env.development - No changes needed
NODE_ENV=development
VITE_API_BASE_URL=http://localhost:3000

# .env.production - No changes needed
NODE_ENV=production
VITE_API_BASE_URL=/api
```

### Build Process Updates
```json
// package.json - Updated scripts (already in place)
{
  "scripts": {
    "dev": "npx vite --port 3000 --host",
    "build": "node simple-build.js",
    "migrate": "node scripts/migrate-to-unified.js",
    "typecheck": "npx tsc --noEmit --skipLibCheck"
  }
}
```

### Database Migration in Production
```bash
# Production migration checklist
1. Stop application
2. Backup database: cp app.db app.db.backup-$(date +%Y%m%d)
3. Run migration: npm run migrate
4. Verify data: node scripts/verify-migration.js
5. Start application
6. Monitor for errors
7. Keep backup until verified stable
```

---

## 🐛 Common Migration Issues & Solutions

### Issue 1: Import Errors
**Problem**: Imports of removed components fail
```typescript
// ❌ This will fail
import { AdvancedKBEntryList } from '../components/KB/AdvancedKBEntryList';
```
**Solution**: Update to use unified components
```typescript
// ✅ Use this instead
import { UnifiedSearch } from '../components/search/UnifiedSearch';
import { UnifiedEntryCard } from '../components/unified/UnifiedEntryCard';
```

### Issue 2: Type Errors
**Problem**: TypeScript errors due to changed interfaces
```typescript
// ❌ Old interface
interface IncidentData {
  title: string;
  description: string;
  status: string;
}
```
**Solution**: Update to unified interface
```typescript
// ✅ New interface
interface CreateIncidentData {
  title: string;
  description: string;
  category: string;
  severity: string;
  priority: number;
  reporter: string;
  // entry_type automatically set to 'incident'
}
```

### Issue 3: Search Results Handling
**Problem**: Search results structure changed
```typescript
// ❌ Old search handling
const incidents = await IncidentService.search(query);
const knowledge = await KBService.search(query);
```
**Solution**: Use unified search with filtering
```typescript
// ✅ New search handling
const allResults = await UnifiedEntryService.searchEntries(query, { type: 'all' });
const incidents = allResults.entries.filter(e => e.entry_type === 'incident');
const knowledge = allResults.entries.filter(e => e.entry_type === 'knowledge');

// Or use type-specific search
const incidentResults = await UnifiedEntryService.searchEntries(query, { type: 'incidents' });
```

### Issue 4: Database Query Errors
**Problem**: Direct SQL queries fail due to schema changes
```sql
-- ❌ Old queries will fail
SELECT * FROM incidents WHERE status = 'open';
SELECT * FROM kb_entries WHERE category = 'network';
```
**Solution**: Update queries for unified schema
```sql
-- ✅ New unified queries
SELECT * FROM entries WHERE entry_type = 'incident' AND incident_status = 'aberto';
SELECT * FROM entries WHERE entry_type = 'knowledge' AND category = 'network';
```

---

## 📝 Migration Checklist

### Pre-Migration
- [ ] Backup current database
- [ ] Update development environment (Node.js, npm)
- [ ] Install recommended VS Code extensions
- [ ] Review and stash uncommitted changes

### Code Migration
- [ ] Update import statements (remove legacy components)
- [ ] Replace separate service calls with unified service
- [ ] Update component props and interfaces
- [ ] Update IPC handler calls
- [ ] Fix TypeScript errors

### Database Migration
- [ ] Run database migration script
- [ ] Verify data integrity
- [ ] Test search functionality
- [ ] Validate incident/knowledge conversion

### Testing
- [ ] Update test files for new architecture
- [ ] Run full test suite
- [ ] Test critical user workflows
- [ ] Verify accessibility compliance

### Deployment
- [ ] Test build process
- [ ] Verify environment configuration
- [ ] Plan production migration
- [ ] Document rollback procedure

### Post-Migration
- [ ] Monitor application performance
- [ ] Check for console errors
- [ ] Verify all features working
- [ ] Update team documentation

---

## 🎓 Training & Support

### Learning Resources
- **Architecture Overview**: `docs/MIGRATION_MASTER_DOCUMENTATION_V2.md`
- **API Reference**: See master documentation
- **Component Examples**: `src/renderer/components/unified/`
- **Migration Examples**: This document

### Getting Help
1. **Documentation**: Check this guide and master documentation first
2. **Code Examples**: Look at existing unified components
3. **Team Support**: Ask team members who have completed migration
4. **Testing**: Use test files as examples of proper usage

### Best Practices
- **Gradual Migration**: Migrate one feature at a time
- **Test Everything**: Run tests after each change
- **Keep Backups**: Maintain backups until migration is proven stable
- **Document Changes**: Update any team-specific documentation

---

## 🏁 Conclusion

The migration to the unified architecture represents a significant improvement in code maintainability, user experience, and system performance. While the initial migration requires careful attention to detail, the resulting architecture is much simpler and more powerful.

Key benefits after migration:
- ✅ **Simplified Codebase**: Single service instead of multiple services
- ✅ **Better UX**: Unified search and automatic knowledge creation
- ✅ **Improved Performance**: Optimized database queries and search
- ✅ **Easier Maintenance**: Fewer components and cleaner architecture

Take your time with the migration, test thoroughly, and don't hesitate to ask for help when needed. The end result will be a much more maintainable and user-friendly application.