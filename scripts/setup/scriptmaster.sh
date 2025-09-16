#!/bin/bash
# =====================================================
# CONTEXT ENGINEERING OPTIMIZADO - CLAUDE FLOW 2.0 ALPHA
# MVP1 Knowledge Base Implementation - Week 2, Day 8
# =====================================================

set -e

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║   🧠 CONTEXT ENGINEERING LOADER - CLAUDE FLOW 2.0 ALPHA     ║"
echo "║   Knowledge-First Platform MVP1 - Week 2 Implementation      ║"
echo "╔══════════════════════════════════════════════════════════════╝"

# ============================================================
# STEP 1: CHECK & PRESERVE EXISTING MEMORY
# ============================================================

echo ""
echo "📊 CHECKING EXISTING MEMORY STATE..."
echo "════════════════════════════════════════════════════════════════"

# Backup existing memory if exists
if npx claude-flow@alpha memory stats &>/dev/null 2>&1; then
    echo "✅ Found existing memory - creating backup..."
    TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    npx claude-flow@alpha memory export "memory-backup-${TIMESTAMP}.json"
    echo "💾 Backup saved: memory-backup-${TIMESTAMP}.json"
    
    # Check current day context
    CURRENT_DAY=$(npx claude-flow@alpha memory query "current/day" --limit 1 2>/dev/null | grep -oP 'day\d+' | head -1 || echo "")
    echo "📅 Current context: ${CURRENT_DAY:-unknown}"
else
    echo "⚠️  No existing memory found - fresh initialization"
fi

# ============================================================
# STEP 2: CORE PROJECT CONTEXT (Context Engineering Best Practice)
# ============================================================

echo ""
echo "🎯 LOADING CORE PROJECT CONTEXT..."
echo "════════════════════════════════════════════════════════════════"

# 1. PROJECT IDENTITY & MISSION (Top-level context)
npx claude-flow@alpha memory store "project/identity" "
PROJECT: Knowledge-First Platform v6.0
TYPE: Enterprise AI Platform with Transparency
CURRENT_MVP: MVP1 - Knowledge Base Foundation
TIMELINE: 13 months total, Week 2 Day 8 of MVP1
TARGET_ROI: €312,000/month
PAYBACK: 1.6 months
STATUS: Day 8 - Search Implementation Phase
"

# 2. CURRENT ACTIVE CONTEXT (Most relevant for immediate tasks)
npx claude-flow@alpha memory store "current/active-day8" "
CURRENT LOCATION: Week 2, Day 8 of 20
CURRENT TASK: Search Interface Implementation

MORNING COMPLETED:
✅ High-performance search interface design
✅ SearchBar.tsx with debouncing (300ms)
🔄 SearchResults.tsx in progress

AFTERNOON TASKS (Active):
- FTS5 search integration with BM25 ranking
- Search caching layer (LRU cache)
- Search analytics system
- Performance validation (<1s response)

CRITICAL REQUIREMENTS:
- Search response: <1s MANDATORY
- Autocomplete: <200ms
- Virtual scroll for >20 results
- WCAG 2.1 AA compliance
- TypeScript strict mode
"

# ============================================================
# STEP 3: HIERARCHICAL DOCUMENT LOADING (Namespaced)
# ============================================================

echo ""
echo "📚 LOADING PROJECT DOCUMENTATION (Documents 1-7)..."
echo "════════════════════════════════════════════════════════════════"

# Check if documents exist
DOCS_PATH="project-docs/complete"
if [ ! -d "$DOCS_PATH" ]; then
    echo "❌ Error: Documentation folder not found at $DOCS_PATH"
    exit 1
fi

# Document 1: Master Document - High-level vision
if [ -f "$DOCS_PATH/1-DOCUMENTO-MESTRE-KNOWLEDGE-FIRST-v6.md" ]; then
    echo "📄 Loading Document 1: Master Vision..."
    npx claude-flow@alpha memory store "docs/1-master-vision" "
DOCUMENT: Master Vision v6.0
PURPOSE: Strategic overview and business case
KEY_POINTS:
- €312,000/month ROI target
- 3 strategic improvements: AI State-of-art, Transparency, KB On-Demand
- 13-month implementation timeline
- First-mover advantage in transparency AI
RELEVANCE: Strategic context for all decisions
$(head -100 $DOCS_PATH/1-DOCUMENTO-MESTRE-KNOWLEDGE-FIRST-v6.md)
"
fi

# Document 2: Technical Architecture
if [ -f "$DOCS_PATH/2-ARQUITETURA-E-DESIGN-TECNICO-v6.md" ]; then
    echo "📄 Loading Document 2: Technical Architecture..."
    npx claude-flow@alpha memory store "docs/2-architecture" "
DOCUMENT: Technical Architecture v6.0
PURPOSE: Stack and design decisions
KEY_POINTS:
- Progressive stack: Electron + React + SQLite → PostgreSQL
- MVP1: Local SQLite with FTS5
- Design System: Accessibility-first, WCAG 2.1 AA
- Performance: <1s search, <5s startup
CURRENT_RELEVANCE: Day 8 search implementation specs
$(grep -A 50 "Search" $DOCS_PATH/2-ARQUITETURA-E-DESIGN-TECNICO-v6.md || head -100 $DOCS_PATH/2-ARQUITETURA-E-DESIGN-TECNICO-v6.md)
"
fi

# Document 3: Functional Specification
if [ -f "$DOCS_PATH/3-ESPECIFICACAO-FUNCIONAL-COMPLETA-v6.md" ]; then
    echo "📄 Loading Document 3: Functional Specs..."
    npx claude-flow@alpha memory store "docs/3-functional-specs" "
DOCUMENT: Functional Specification v6.0
PURPOSE: User stories and use cases
KEY_POINTS:
- UC-KB-001: Intelligent search with <1s response
- Transparency score for all results
- Support team workflow optimization
- Pattern detection preparation (MVP2)
CURRENT_RELEVANCE: Search UC-KB-001 implementation
$(grep -A 100 "UC-KB-001" $DOCS_PATH/3-ESPECIFICACAO-FUNCIONAL-COMPLETA-v6.md || head -100 $DOCS_PATH/3-ESPECIFICACAO-FUNCIONAL-COMPLETA-v6.md)
"
fi

# Document 4: Implementation Guide
if [ -f "$DOCS_PATH/4-GUIA-IMPLEMENTACAO-MASTER-v6.md" ]; then
    echo "📄 Loading Document 4: Implementation Guide..."
    npx claude-flow@alpha memory store "docs/4-implementation-guide" "
DOCUMENT: Implementation Guide v6.0
PURPOSE: Technical setup and deployment
KEY_POINTS:
- MVP1: 4 weeks, local deployment
- Search: SQLite FTS5 + optional Gemini API
- Testing: Jest + React Testing Library
- Performance: Benchmarks and monitoring
CURRENT_RELEVANCE: Day 8 search implementation details
$(grep -A 100 "Search" $DOCS_PATH/4-GUIA-IMPLEMENTACAO-MASTER-v6.md || head -100 $DOCS_PATH/4-GUIA-IMPLEMENTACAO-MASTER-v6.md)
"
fi

# Document 5: Advanced Strategy (AI improvements)
if [ -f "$DOCS_PATH/5-ESTRATEGIA-MELHORIAS-AVANCADAS-v6.md" ]; then
    echo "📄 Loading Document 5: Advanced AI Strategy..."
    npx claude-flow@alpha memory store "docs/5-advanced-strategy" "
DOCUMENT: Advanced AI Strategy v6.0
PURPOSE: AI enhancements and transparency
KEY_POINTS:
- Context Engineering implementation
- Graph RAG for MVP3
- Transparency interface requirements
- Smart discovery system
FUTURE_RELEVANCE: Foundation for MVP2-5
$(head -80 $DOCS_PATH/5-ESTRATEGIA-MELHORIAS-AVANCADAS-v6.md)
"
fi

# Document 6: Migration Strategy
if [ -f "$DOCS_PATH/6-MIGRACAO-E-DADOS-v6.md" ]; then
    echo "📄 Loading Document 6: Data Migration..."
    npx claude-flow@alpha memory store "docs/6-migration-data" "
DOCUMENT: Migration & Data Strategy v6.0
PURPOSE: Data management and connectors
KEY_POINTS:
- MVP1: 50-200 KB entries via CSV
- ServiceNow connector priority
- SQLite FTS5 optimization
- Quality validation framework
CURRENT_RELEVANCE: Search data structure
$(grep -A 50 "SQLite" $DOCS_PATH/6-MIGRACAO-E-DADOS-v6.md || head -80 $DOCS_PATH/6-MIGRACAO-E-DADOS-v6.md)
"
fi

# Document 7: Project Governance
if [ -f "$DOCS_PATH/7-GESTAO-PROJETO-E-GOVERNANCE-v6.md" ]; then
    echo "📄 Loading Document 7: Project Governance..."
    npx claude-flow@alpha memory store "docs/7-governance" "
DOCUMENT: Project Governance v6.0
PURPOSE: Management and success metrics
KEY_POINTS:
- Success: <1s search, 5+ users, -60% resolution time
- Quality gates every phase
- Risk: complexity management
- Weekly progress tracking
CURRENT_RELEVANCE: Week 2 success metrics
$(grep -A 50 "Week 2" $DOCS_PATH/7-GESTAO-PROJETO-E-GOVERNANCE-v6.md || head -80 $DOCS_PATH/7-GESTAO-PROJETO-E-GOVERNANCE-v6.md)
"
fi

# ============================================================
# STEP 4: WEEK 1 DISCOVERIES & LEARNINGS
# ============================================================

echo ""
echo "💡 LOADING WEEK 1 DISCOVERIES..."
echo "════════════════════════════════════════════════════════════════"

npx claude-flow@alpha memory store "learnings/week1-discoveries" "
WEEK 1 KEY DISCOVERIES (Must Apply):
- SQLite requires compound indexes for search performance
- IPC communication needs optimization for <1s response
- Component library needs accessibility-first design
- Storage abstraction essential for plugin architecture
- React performance requires memo optimization
- Search algorithm needs FTS5 with custom ranking
- Testing framework requires E2E for Electron specifics

APPLIED IN WEEK 2:
- ✅ Accessibility foundation (WCAG 2.1 AA)
- ✅ React.memo for all components
- 🔄 FTS5 implementation (Day 8 afternoon)
- 🔄 Performance monitoring setup
"

# ============================================================
# STEP 5: TECHNICAL CONTEXT FOR DAY 8
# ============================================================

echo ""
echo "🔧 LOADING DAY 8 TECHNICAL CONTEXT..."
echo "════════════════════════════════════════════════════════════════"

npx claude-flow@alpha memory store "technical/day8-search" "
DAY 8 SEARCH IMPLEMENTATION SPECS:

SEARCHBAR COMPONENT:
interface SearchBarProps {
  onSearch: (query: string, filters?: SearchFilters) => void;
  placeholder?: string;
  debounceMs?: number; // 300ms default
  showFilters?: boolean;
  autoFocus?: boolean;
}

SEARCH SERVICE:
class SearchService {
  // SQLite FTS5 with BM25 ranking
  private db: Database;
  private cache: LRUCache<string, SearchResult[]>;
  
  async search(query: string): Promise<SearchResult[]> {
    // 1. Check cache
    // 2. Execute FTS5 query
    // 3. Apply BM25 ranking
    // 4. Return results <1s
  }
}

PERFORMANCE REQUIREMENTS:
- First query: <1s
- Cached query: <100ms
- Autocomplete: <200ms
- Result rendering: <16ms (60fps)

ACCESSIBILITY:
- ARIA labels on all inputs
- Keyboard navigation (Tab, Enter, Esc)
- Screen reader announcements
- Focus management
"

# ============================================================
# STEP 6: IMMEDIATE NEXT ACTIONS
# ============================================================

echo ""
echo "🎯 SETTING IMMEDIATE CONTEXT..."
echo "════════════════════════════════════════════════════════════════"

npx claude-flow@alpha memory store "immediate/next-actions" "
IMMEDIATE NEXT STEPS (Day 8 Afternoon):

1. COMPLETE SearchBar.tsx:
   - Implement debouncing (300ms)
   - Add autocomplete dropdown
   - Ensure accessibility (ARIA)
   - Add category filters

2. IMPLEMENT FTS5 Search:
   - Create search tables with indexes
   - Implement BM25 ranking
   - Add mainframe tokenizer (JCL, VSAM, COBOL)
   - Test <1s performance

3. ADD Caching Layer:
   - LRU cache for recent queries
   - Predictive prefetching
   - Cache invalidation strategy

4. PERFORMANCE VALIDATION:
   - Measure search latency
   - Profile React rendering
   - Ensure 60fps scrolling

COMMANDS TO RUN:
npx claude-flow@alpha hive-mind spawn 'Complete SearchBar with all Day 8 requirements' --claude
npx claude-flow@alpha swarm 'Implement FTS5 with BM25 ranking for mainframe terms' --claude
"

# ============================================================
# STEP 7: VALIDATE CONTEXT LOADING
# ============================================================

echo ""
echo "✅ VALIDATING CONTEXT INTEGRITY..."
echo "════════════════════════════════════════════════════════════════"

# Test critical context queries
echo "Testing context retrieval:"

echo -n "  Project identity... "
npx claude-flow@alpha memory query "project/identity" --limit 1 &>/dev/null && echo "✅" || echo "❌"

echo -n "  Current day context... "
npx claude-flow@alpha memory query "current/active" --limit 1 &>/dev/null && echo "✅" || echo "❌"

echo -n "  Documentation... "
npx claude-flow@alpha memory query "docs/" --limit 1 &>/dev/null && echo "✅" || echo "❌"

echo -n "  Technical specs... "
npx claude-flow@alpha memory query "technical/day8" --limit 1 &>/dev/null && echo "✅" || echo "❌"

echo -n "  Next actions... "
npx claude-flow@alpha memory query "immediate/" --limit 1 &>/dev/null && echo "✅" || echo "❌"

# ============================================================
# STEP 8: MEMORY OPTIMIZATION
# ============================================================

echo ""
echo "🔄 OPTIMIZING MEMORY..."
echo "════════════════════════════════════════════════════════════════"

# Compact database for performance
npx claude-flow@alpha memory compact

# Show final stats
echo ""
echo "📊 FINAL MEMORY STATUS:"
npx claude-flow@alpha memory stats

# ============================================================
# STEP 9: READY MESSAGE
# ============================================================

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║   ✅ CONTEXT LOADING COMPLETE!                              ║"
echo "╔══════════════════════════════════════════════════════════════╝"
echo ""
echo "📍 YOU ARE: Week 2, Day 8 - Search Implementation (Afternoon)"
echo ""
echo "🎯 IMMEDIATE ACTIONS:"
echo "  1. Complete SearchBar component"
echo "  2. Implement FTS5 search with BM25"
echo "  3. Add caching layer"
echo "  4. Validate <1s performance"
echo ""
echo "💡 QUICK COMMANDS:"
echo "  Query context: npx claude-flow@alpha memory query 'current'"
echo "  Get help: npx claude-flow@alpha swarm 'What should I implement next for Day 8?' --claude"
echo "  Check docs: npx claude-flow@alpha memory query 'docs/3-functional' --limit 1"
echo ""
echo "🚀 Ready for Day 8 afternoon tasks with optimized context!"

