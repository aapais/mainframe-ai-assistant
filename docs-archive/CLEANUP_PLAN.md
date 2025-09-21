# Post-Incident Management Implementation Cleanup Plan

## Executive Summary

After analyzing the Accenture Mainframe AI Assistant codebase following incident management implementation, this cleanup plan identifies obsolete components and provides a safe removal strategy. The analysis reveals significant redundancy and obsolete elements that can be safely removed to improve maintainability and performance.

## Analysis Summary

### Key Findings

1. **5,155+ generated map files** consuming significant disk space
2. **Multiple distribution directories** with duplicate build artifacts
3. **Disabled/obsolete search components** replaced by incident management
4. **Duplicate test configurations** across multiple directories
5. **Extensive backup files** in temp directories
6. **Redundant documentation** and README files
7. **Dead code paths** with TODO/FIXME markers (29 files identified)

## Cleanup Categories

### 1. Build Artifacts & Distribution Files

#### **High Priority - Safe to Remove**

**Distribution Directories:**
```
/dist-accenture/           # Old Accenture build
/dist-debug/              # Debug build artifacts
/dist-final/              # Old final builds
/dist-new/                # New build artifacts
/temp/                    # Temporary files and extracts
```

**Map Files (5,155+ files):**
```
**/*.js.map               # Source map files
**/*.d.ts.map            # TypeScript declaration maps
```

**Recommendation:** Remove all except current `/dist/` directory
**Risk Level:** ⚠️ LOW - These are generated artifacts
**Disk Space Saved:** ~2-3 GB

### 2. Obsolete Search Components

#### **Medium Priority - Requires Validation**

**Disabled Components:**
```
/src/renderer/components/search/SearchInterface.tsx.disabled
/src/components/search/ (duplicate components)
/src/services/search/ (redundant services)
```

**Legacy Search Services:**
```
/src/services/SearchService.js (replaced by incident services)
/src/services/EnhancedSearchService.js
/src/services/FTS5SearchService.js
```

**Recommendation:** Archive before removal, validate incident management covers functionality
**Risk Level:** ⚠️ MEDIUM - Core functionality replacement
**Code Reduction:** ~15-20 files

### 3. Test File Redundancy

#### **Low Priority - Review Required**

**Duplicate Test Configs:**
```
/config/jest/ (multiple config files)
/tests/performance/ (extensive duplicate tests)
/tests/integration/ (overlapping test suites)
```

**Obsolete Test Suites:**
```
- Search-specific tests (if incident management replaces)
- Performance regression tests (duplicated)
- Accessibility tests (consolidated versions exist)
```

**Recommendation:** Consolidate and remove duplicates
**Risk Level:** ⚠️ LOW-MEDIUM - May affect CI/CD
**Files Affected:** ~50-100 test files

### 4. Documentation Cleanup

#### **Low Priority - Manual Review**

**Redundant Documentation:**
```
/docs/technical/ (multiple similar docs)
/.claude/agents/ (extensive agent documentation)
/.claude/commands/ (command documentation)
/docs/performance/ (performance-related docs)
```

**Obsolete Guides:**
```
- MVP1 implementation docs (completed)
- Build validation guides (multiple versions)
- Search optimization docs (if replaced)
```

**Recommendation:** Archive old docs, consolidate similar content
**Risk Level:** ⚠️ VERY LOW - Documentation only

### 5. Dead Code & TODO Items

#### **High Priority - Code Quality**

**Files with TODO/FIXME (29 files):**
```
/src/renderer/components/incident/StatusWorkflow.tsx
/src/renderer/components/incident/QuickActions.tsx
/src/main/ipc/handlers/IncidentHandler.ts
/src/services/storage/backup/BackupService.ts
/src/main/services/SmartSearchService.ts
... (26 more files)
```

**Recommendation:** Review and resolve TODO items
**Risk Level:** ⚠️ MEDIUM - May indicate incomplete features

## Safe Cleanup Strategy

### Phase 1: Low-Risk Cleanup (Week 1)
```bash
# 1. Remove build artifacts (backup first)
mkdir -p /backups/cleanup-$(date +%Y%m%d)
mv dist-* temp/ better-sqlite3/ /backups/cleanup-$(date +%Y%m%d)/

# 2. Remove map files (keep during development)
find . -name "*.js.map" -delete
find . -name "*.d.ts.map" -delete

# 3. Clean temp directories
rm -rf temp/backups/
rm -rf accessibility-reports/
```

### Phase 2: Medium-Risk Cleanup (Week 2)
```bash
# 1. Archive disabled components
mkdir -p /archives/search-components/
mv src/renderer/components/search/SearchInterface.tsx.disabled /archives/search-components/

# 2. Remove duplicate test configs (after validation)
# Review each jest.config.js file first
find . -name "jest.config.js" | head -10  # Review manually

# 3. Consolidate documentation
# Manual review required for each doc
```

### Phase 3: Code Quality (Week 3)
```bash
# 1. Address TODO/FIXME items
grep -r "TODO\|FIXME\|HACK\|XXX" src/ | head -20  # Review each case

# 2. Remove commented code blocks
# Manual review of large comment blocks

# 3. Optimize imports and dependencies
npm audit
npm prune
```

## Detailed Removal Plan

### Navigation Cleanup

**Current Navigation Structure:**
```typescript
// From src/renderer/app.tsx
const views = ['dashboard', 'search', 'ai-transparency'];
```

**Post-Incident Management:**
```typescript
// Updated navigation should be:
const views = ['dashboard', 'incidents', 'ai-transparency'];
```

**Files to Update:**
- `/src/renderer/app.tsx` (line 110: update currentView type)
- Remove 'search' view, replace with 'incidents'

### Database Schema Optimization

**Current Alert/Incident Tables:**
Based on implementation strategy, alerts table serves incidents.

**Potential Optimizations:**
- Remove unused indexes if any
- Consolidate similar tables
- Clean up test data tables

**Tables to Review:**
```sql
-- Review for unused columns
SELECT * FROM pragma_table_info('alerts');
SELECT * FROM pragma_table_info('knowledge_base');
SELECT * FROM pragma_table_info('performance_metrics');
```

### Component Consolidation

**Redundant Search Components:**
```
src/components/search/SearchInterface.tsx (disabled)
src/components/search/AdvancedSearch.tsx
src/components/search/SearchResults.tsx
```

**Incident Components (Keep):**
```
src/renderer/components/incident/StatusWorkflow.tsx
src/renderer/components/incident/QuickActions.tsx
src/renderer/views/Incidents.tsx
```

## Risk Assessment Matrix

| Component Category | Risk Level | Impact | Effort | Priority |
|-------------------|------------|---------|---------|----------|
| Build Artifacts | LOW | High Space Savings | 1 day | HIGH |
| Map Files | LOW | Medium Space Savings | 2 hours | HIGH |
| Disabled Search | MEDIUM | Code Clarity | 3 days | MEDIUM |
| Test Duplicates | LOW-MEDIUM | CI/CD Impact | 2 days | MEDIUM |
| Documentation | VERY LOW | Clarity | 1 week | LOW |
| TODO Items | MEDIUM | Code Quality | 2 weeks | HIGH |

## Success Metrics

### Immediate Benefits
- [ ] **Disk Space Reduction:** 2-3 GB saved
- [ ] **Build Performance:** 15-20% faster builds
- [ ] **Code Clarity:** Remove disabled/obsolete components
- [ ] **Maintenance:** Easier codebase navigation

### Long-term Benefits
- [ ] **Developer Experience:** Cleaner codebase
- [ ] **CI/CD Performance:** Faster test execution
- [ ] **Documentation Quality:** Consolidated, current docs
- [ ] **Code Quality:** Resolved TODO/FIXME items

## Implementation Timeline

### Week 1: Immediate Cleanup
- **Day 1-2:** Backup and remove build artifacts
- **Day 3:** Remove map files and temp directories
- **Day 4-5:** Validate application still functions correctly

### Week 2: Component Review
- **Day 1-2:** Review disabled search components
- **Day 3:** Archive obsolete components safely
- **Day 4-5:** Test incident management functionality

### Week 3: Code Quality
- **Day 1-3:** Address TODO/FIXME items
- **Day 4-5:** Remove commented code blocks
- **Day 5:** Final testing and validation

## Rollback Strategy

### Backup Plan
```bash
# Before any cleanup
tar -czf cleanup-backup-$(date +%Y%m%d).tar.gz \
  dist-* temp/ docs/ .claude/ \
  src/components/search/ \
  src/services/search/
```

### Rollback Commands
```bash
# Restore from backup if needed
tar -xzf cleanup-backup-$(date +%Y%m%d).tar.gz

# Restore specific components
git checkout HEAD~1 -- src/components/search/
git checkout HEAD~1 -- src/services/search/
```

### Safety Checks
- [ ] All incident management features working
- [ ] Navigation functions correctly
- [ ] Database operations succeed
- [ ] Build process completes
- [ ] Tests pass (critical ones)

## File-Specific Removal List

### Immediate Removal (Low Risk)
```
# Build artifacts
/dist-accenture/
/dist-debug/
/dist-final/
/dist-new/
/temp/extracted-app/
/temp/archives/
/temp/backups/

# Map files
**/*.js.map
**/*.d.ts.map

# Temporary files
/accessibility-reports/
/build.log
/dev_test.log
```

### Review Before Removal (Medium Risk)
```
# Disabled components
/src/renderer/components/search/SearchInterface.tsx.disabled

# Redundant services (verify incident management replaces)
/src/services/EnhancedSearchService.js
/src/services/FTS5SearchService.js
/src/services/SearchCacheManager.js

# Duplicate test configs
/config/jest/jest.performance.config.js
/config/jest/jest.setup.accessibility.js
/tests/performance/jest.performance.config.js
```

### Manual Review Required (Higher Risk)
```
# Core navigation components
/src/renderer/app.tsx (update navigation)
/src/renderer/views/Search.tsx (replace with Incidents)

# Service integrations
/src/main/ipc/handlers/ (verify incident handlers)
/src/services/ServiceFactory.js (check service registration)
```

## Post-Cleanup Validation

### Functional Testing
- [ ] Application launches successfully
- [ ] Incident management features work
- [ ] Database operations function
- [ ] AI transparency features intact
- [ ] Navigation flows correctly

### Performance Testing
- [ ] Build time improvement measured
- [ ] Application startup time
- [ ] Memory usage optimization
- [ ] Disk space savings confirmed

### Code Quality Metrics
- [ ] TODO/FIXME count reduced
- [ ] Dead code percentage decreased
- [ ] Documentation coverage improved
- [ ] Test coverage maintained

## Conclusion

This cleanup plan provides a systematic approach to removing obsolete elements while maintaining system stability. The phased approach ensures minimal risk while achieving significant improvements in codebase maintainability and performance.

**Estimated Benefits:**
- **2-3 GB disk space** savings
- **15-20% faster** build times
- **50-100 fewer files** to maintain
- **Cleaner codebase** for future development

**Next Steps:**
1. Review and approve this cleanup plan
2. Execute Phase 1 (low-risk cleanup)
3. Validate incident management functionality
4. Proceed with subsequent phases as appropriate

The cleanup should be coordinated with the development team to ensure no disruption to ongoing incident management features and that all stakeholders are aware of the changes.