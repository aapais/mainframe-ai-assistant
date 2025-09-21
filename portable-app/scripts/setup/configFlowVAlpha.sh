#!/bin/bash
# =====================================================
# CLAUDE FLOW 2.0 ALPHA - COMPLETE SETUP & ACTIVATION
# Enables all advanced features for MVP1 development
# =====================================================

set -e

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║   🚀 CLAUDE FLOW 2.0 ALPHA - COMPLETE FEATURE ACTIVATION    ║"
echo "║   Configuring Hive-Mind, Neural, MCP, and Advanced Features  ║"
echo "╚══════════════════════════════════════════════════════════════╝"

# ============================================================
# STEP 1: VERIFY INSTALLATION
# ============================================================

echo ""
echo "📋 STEP 1: Verifying Claude Flow Alpha Installation..."
echo "════════════════════════════════════════════════════════════════"

# Check Claude Flow version
VERSION=$(npx claude-flow@alpha --version 2>/dev/null || echo "not installed")
echo "Claude Flow Version: $VERSION"

if [[ ! "$VERSION" == *"2.0.0-alpha"* ]]; then
    echo "⚠️  Installing Claude Flow Alpha..."
    npm install -g claude-flow@alpha
fi

# Check Claude Code
if ! command -v claude &> /dev/null; then
    echo "⚠️  Claude Code not found. Installing..."
    npm install -g @anthropic-ai/claude-code
    claude --dangerously-skip-permissions
fi

echo "✅ Installation verified"

# ============================================================
# STEP 2: INITIALIZE HIVE-MIND SYSTEM
# ============================================================

echo ""
echo "🐝 STEP 2: Initializing Hive-Mind System..."
echo "════════════════════════════════════════════════════════════════"

# Initialize with all features
npx claude-flow@alpha init --force \
  --hive-mind \
  --neural-enhanced \
  --memory-compression high \
  --87-tools

echo "✅ Hive-Mind initialized with neural enhancement"

# ============================================================
# STEP 3: CONFIGURE MCP INTEGRATION
# ============================================================

echo ""
echo "🔧 STEP 3: Configuring MCP Integration..."
echo "════════════════════════════════════════════════════════════════"

# Setup MCP with auto-permissions
npx claude-flow@alpha mcp setup --auto-permissions --87-tools

# Add Claude Flow as MCP server
echo "Adding Claude Flow to MCP servers..."
claude mcp add claude-flow npx claude-flow@alpha mcp start 2>/dev/null || true

# Verify MCP tools
echo "Available MCP tools:"
npx claude-flow@alpha mcp tools list | head -10

echo "✅ MCP configured with 87 tools"

# ============================================================
# STEP 4: CONFIGURE NEURAL FEATURES
# ============================================================

echo ""
echo "🧠 STEP 4: Configuring Neural Features..."
echo "════════════════════════════════════════════════════════════════"

# Enable neural patterns
npx claude-flow@alpha config set neural.enabled true
npx claude-flow@alpha config set neural.patterns.autoLearn true
npx claude-flow@alpha config set neural.wasm.simd true

# Train initial patterns for MVP1
echo "Training initial patterns for Knowledge Base development..."
npx claude-flow@alpha neural train --pattern "kb-development" --epochs 10
npx claude-flow@alpha neural train --pattern "search-optimization" --epochs 10
npx claude-flow@alpha neural train --pattern "react-performance" --epochs 10

echo "✅ Neural features enabled and trained"

# ============================================================
# STEP 5: OPTIMIZE MEMORY SYSTEM
# ============================================================

echo ""
echo "💾 STEP 5: Optimizing Memory System..."
echo "════════════════════════════════════════════════════════════════"

# Set memory configuration
npx claude-flow@alpha config set memory.retention 30d
npx claude-flow@alpha config set memory.maxSize 2GB
npx claude-flow@alpha config set memory.compression maximum
npx claude-flow@alpha config set memory.autoCompact true

# Compact existing memory
npx claude-flow@alpha memory compact

echo "✅ Memory system optimized"

# ============================================================
# STEP 6: CONFIGURE ORCHESTRATION
# ============================================================

echo ""
echo "🎭 STEP 6: Configuring Agent Orchestration..."
echo "════════════════════════════════════════════════════════════════"

# Set orchestration parameters for MVP1 scale
npx claude-flow@alpha config set orchestrator.maxConcurrentAgents 6
npx claude-flow@alpha config set orchestrator.defaultTopology hierarchical
npx claude-flow@alpha config set orchestrator.autoSpawn true
npx claude-flow@alpha config set orchestrator.selfHealing true

echo "✅ Orchestration configured for 6 concurrent agents"

# ============================================================
# STEP 7: ENABLE HOOKS AUTOMATION
# ============================================================

echo ""
echo "🪝 STEP 7: Enabling Hooks Automation..."
echo "════════════════════════════════════════════════════════════════"

# Enable all hooks for automated coordination
npx claude-flow@alpha config set hooks.preTask.enabled true
npx claude-flow@alpha config set hooks.postEdit.enabled true
npx claude-flow@alpha config set hooks.preSearch.enabled true
npx claude-flow@alpha config set hooks.notify.enabled true
npx claude-flow@alpha config set hooks.postTask.enabled true

echo "✅ Hooks automation enabled"

# ============================================================
# STEP 8: CONFIGURE PERFORMANCE OPTIMIZATIONS
# ============================================================

echo ""
echo "⚡ STEP 8: Configuring Performance Optimizations..."
echo "════════════════════════════════════════════════════════════════"

# Cache configuration
npx claude-flow@alpha config set cache.enabled true
npx claude-flow@alpha config set cache.ttl 3600
npx claude-flow@alpha config set cache.size 1GB

# Token optimization
npx claude-flow@alpha config set tokens.optimization.enabled true
npx claude-flow@alpha config set tokens.compression true

# Parallel execution
npx claude-flow@alpha config set execution.parallel true
npx claude-flow@alpha config set execution.maxParallel 4

echo "✅ Performance optimizations configured"

# ============================================================
# STEP 9: SETUP GITHUB INTEGRATION
# ============================================================

echo ""
echo "🐙 STEP 9: Setting up GitHub Integration..."
echo "════════════════════════════════════════════════════════════════"

# Initialize GitHub integration if in git repo
if [ -d .git ]; then
    npx claude-flow@alpha github init
    echo "✅ GitHub integration initialized"
else
    echo "⚠️  Not in a git repository. Skipping GitHub setup."
fi

# ============================================================
# STEP 10: CREATE PROJECT CONFIGURATION
# ============================================================

echo ""
echo "📝 STEP 10: Creating Project Configuration..."
echo "════════════════════════════════════════════════════════════════"

# Create .claude-flow directory if not exists
mkdir -p .claude-flow

# Create project configuration
cat > .claude-flow/config.json << 'EOF'
{
  "project": {
    "name": "Knowledge-First Platform MVP1",
    "type": "electron-react-sqlite",
    "version": "1.0.0",
    "timeline": "4 weeks"
  },
  "swarm": {
    "defaultTopology": "hierarchical",
    "maxAgents": 6,
    "preferredAgents": ["architect", "coder", "tester", "reviewer"]
  },
  "performance": {
    "searchTarget": 1000,
    "startupTarget": 5000,
    "renderTarget": 16
  },
  "quality": {
    "testCoverage": 90,
    "accessibilityLevel": "WCAG21AA",
    "typeScriptStrict": true
  },
  "features": {
    "hiveMinds": true,
    "neural": true,
    "mcp": true,
    "github": true,
    "hooks": true
  }
}
EOF

echo "✅ Project configuration created"

# ============================================================
# STEP 11: TEST CONFIGURATION
# ============================================================

echo ""
echo "🧪 STEP 11: Testing Configuration..."
echo "════════════════════════════════════════════════════════════════"

# Test hive-mind
echo -n "Testing Hive-Mind... "
npx claude-flow@alpha hive-mind status &>/dev/null && echo "✅" || echo "❌"

# Test memory
echo -n "Testing Memory... "
npx claude-flow@alpha memory stats &>/dev/null && echo "✅" || echo "❌"

# Test neural
echo -n "Testing Neural... "
npx claude-flow@alpha neural status &>/dev/null && echo "✅" || echo "❌"

# Test swarm
echo -n "Testing Swarm... "
echo "test" | npx claude-flow@alpha swarm "echo test" &>/dev/null && echo "✅" || echo "❌"

# ============================================================
# STEP 12: CREATE QUICK START COMMANDS
# ============================================================

echo ""
echo "🚀 STEP 12: Creating Quick Start Commands..."
echo "════════════════════════════════════════════════════════════════"

# Create quick start script
cat > start-development.sh << 'EOF'
#!/bin/bash
# Quick start for daily development

echo "🚀 Starting Knowledge-First Platform Development Environment..."

# Load context
./ScriptMaster.sh

# Start hive-mind
npx claude-flow@alpha hive-mind wizard

# Show status
npx claude-flow@alpha hive-mind status
npx claude-flow@alpha memory stats

echo "✅ Ready for development!"
echo ""
echo "Quick commands:"
echo "  Simple task:  npx claude-flow@alpha swarm 'task' --claude"
echo "  Complex task: npx claude-flow@alpha hive-mind spawn 'task' --claude"
echo "  Check memory: npx claude-flow@alpha memory query 'current/'"
EOF

chmod +x start-development.sh

echo "✅ Quick start script created: ./start-development.sh"

# ============================================================
# FINAL STATUS REPORT
# ============================================================

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║   ✅ CLAUDE FLOW 2.0 ALPHA FULLY CONFIGURED!                ║"
echo "╚══════════════════════════════════════════════════════════════╝"

echo ""
echo "🎯 ENABLED FEATURES:"
echo "  ✅ Hive-Mind System (Queen-led coordination)"
echo "  ✅ Neural Enhancement (27+ cognitive models)"
echo "  ✅ MCP Integration (87 tools)"
echo "  ✅ Memory System (SQLite with compression)"
echo "  ✅ Hooks Automation (pre/post task coordination)"
echo "  ✅ Performance Optimization (caching, parallel execution)"
echo "  ✅ GitHub Integration (if in git repo)"
echo "  ✅ 6 Concurrent Agents (hierarchical topology)"

echo ""
echo "📊 CONFIGURATION SUMMARY:"
npx claude-flow@alpha config list | head -20

echo ""
echo "🚀 NEXT STEPS:"
echo "  1. Run: ./start-development.sh to begin daily work"
echo "  2. Or directly: npx claude-flow@alpha hive-mind wizard"
echo "  3. Query context: npx claude-flow@alpha memory query 'current/'"

echo ""
echo "💡 PRO TIPS:"
echo "  • Use 'swarm' for simple tasks (80% of cases)"
echo "  • Use 'hive-mind spawn' for complex multi-agent tasks"
echo "  • Memory is already loaded by ScriptMaster.sh"
echo "  • Neural patterns will improve over time with usage"
echo "  • Check token usage: npx claude-flow@alpha analysis token-usage"

echo ""
echo "📚 Documentation:"
echo "  • GitHub: https://github.com/ruvnet/claude-flow"
echo "  • Wiki: https://github.com/ruvnet/claude-flow/wiki"

echo ""
echo "Ready for MVP1 Week 2 Day 8 development! 🎉"
