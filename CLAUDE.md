# Claude Code Configuration - Mainframe AI Assistant
## Multi-Tool Orchestration for Maximum Efficiency

### 🎯 **Core Philosophy**
This project **REQUIRES** comprehensive utilization of ALL available tools for optimal performance, efficiency, and effectiveness. **Spec-Driven Development** using GitHub Spec Kit, **Claude Flow 2.0 Alpha** orchestration, **MCP ecosystem** (Puppeteer, Flow Nexus, Sublinear Solver), and **parallel tool execution** are MANDATORY for all complex tasks.

### ⚡ **CRITICAL: Tool Usage Mandate**
**ALWAYS use ALL relevant tools in parallel when solving problems:**
- **Claude Flow**: Multi-agent swarm orchestration for complex tasks
- **Flow Nexus**: Sandbox environments, workflow automation, neural networks
- **MCP Puppeteer**: Browser automation, E2E testing, visual documentation
- **Sublinear Solver**: Mathematical optimizations, performance algorithms
- **Task Tool**: Specialized agents for research and implementation
- **Parallel Execution**: Multiple tool calls in single message for speed

**NEVER resort to manual debugging when orchestration tools are available!**

---

## 🚀 **Available Commands & Workflows**

### **Primary Spec-Driven Commands**
- `/specify "[feature description]"` - Create comprehensive specifications
- `/plan "[technical stack and architecture]"` - Generate implementation plans
- `/tasks` - Break down into executable TDD tasks
- `/implement specs/001-feature/plan.md` - Execute implementation
- `/constitution` - Update project governance principles

### **Claude Flow 2.0 Alpha Commands**
```bash
# Initialize swarm orchestration (use once per feature)
npx claude-flow@alpha init --force

# Hive-mind coordination for complex features
npx claude-flow@alpha hive-mind spawn "Feature: Advanced mainframe analytics dashboard" --claude

# Swarm intelligence for parallel development
npx claude-flow@alpha swarm "Implement real-time data visualization with D3.js" --continue-session

# Memory operations for context persistence
npx claude-flow@alpha memory query "authentication system" --recent
npx claude-flow@alpha memory store "User prefers PostgreSQL over MongoDB for all database operations"

# SPARC methodology modes (17 specialized agents)
npx claude-flow@alpha sparc run architect "Design microservices architecture for mainframe integration"
npx claude-flow@alpha sparc run coder "Implement JWT authentication middleware"
npx claude-flow@alpha sparc run tdd "Create comprehensive test suite for API endpoints"
npx claude-flow@alpha sparc run security "Audit authentication flow for vulnerabilities"
npx claude-flow@alpha sparc run devops "Set up CI/CD pipeline with automated deployment"
```

---

## 🧠 **Memory & Context Management**

### **Memory Hierarchy (Persistent Across Sessions)**
1. **Constitution Memory** (`/memory/constitution.md`) - Non-negotiable principles
2. **Project Memory** (`/.swarm/memory.db`) - Feature context, decisions, patterns
3. **User Memory** (`~/.claude/`) - Personal preferences, coding standards
4. **Session Memory** - Current conversation context

### **Memory Best Practices**
```bash
# ALWAYS start sessions by loading relevant memory
npx claude-flow@alpha memory query "current-feature" --context

# Store important decisions immediately
npx claude-flow@alpha memory store "Decision: Using Express.js over Fastify for better ecosystem compatibility"

# Query memory before making architecture decisions
npx claude-flow@alpha memory search "database" --semantic

# Clean obsolete memory periodically
npx claude-flow@alpha memory cleanup --older-than-30-days
```

---

## 🌐 **MCP Puppeteer Integration**

### **Web Automation Capabilities**
The Puppeteer MCP provides browser automation for:
- **Documentation Generation**: Capture screenshots of UI components
- **Testing**: Automated E2E testing with real browser interactions
- **Data Extraction**: Scrape mainframe documentation from web sources
- **Visual Testing**: Screenshot comparisons for responsive design

### **Puppeteer Usage Patterns**
```javascript
// Example: Automated testing integration
{
  "tool": "puppeteer_navigate",
  "parameters": {
    "url": "http://localhost:3000/login",
    "launchOptions": {
      "headless": false,
      "defaultViewport": { "width": 1280, "height": 720 }
    }
  }
}

// Screenshot for documentation
{
  "tool": "puppeteer_screenshot", 
  "parameters": {
    "name": "login-form",
    "selector": ".auth-container",
    "width": 1024,
    "height": 768,
    "encoded": false
  }
}

// Execute JavaScript for data extraction
{
  "tool": "puppeteer_evaluate",
  "parameters": {
    "script": "document.querySelector('.mainframe-status').textContent"
  }
}
```

---

## 📁 **Project Organization & File Management**

### **Directory Structure (Auto-maintained)**
```
mainframe-ai-assistant/
├── .swarm/                    # Claude Flow memory & orchestration
│   ├── memory.db             # Persistent SQLite memory
│   └── sessions/             # Session histories
├── .hive-mindsessions/       # Hive-mind coordination data
├── .specify/                 # Spec Kit automation scripts
├── memory/                   # Project constitution & governance
├── specs/                    # Feature specifications (versioned)
│   └── 001-feature-name/
│       ├── spec.md          # Business requirements
│       ├── plan.md          # Technical implementation
│       ├── tasks.md         # Executable task list
│       └── contracts/       # API contracts
├── src/                      # Implementation code
├── tests/                    # Test suites (TDD)
└── docs/                     # Generated documentation
```

### **File Lifecycle Management**
```bash
# Automated cleanup of obsolete files
npx claude-flow@alpha cleanup --obsolete --backup

# Archive completed feature specs
npx claude-flow@alpha archive specs/001-completed-feature/

# Sync documentation with current codebase
npx claude-flow@alpha docs sync --auto-update

# Remove duplicate dependencies and unused imports
npx claude-flow@alpha optimize --remove-duplicates
```

---

## 🏗️ **Development Workflow - MANDATORY TOOL ORCHESTRATION**

### **🔴 CRITICAL: Problem-Solving Approach**
**For ANY problem (debugging, implementation, analysis), ALWAYS:**
1. **Deploy multiple tools in parallel** - Never work sequentially
2. **Use specialized agents** - Each agent handles specific aspects
3. **Leverage MCP ecosystem** - All available servers must be utilized
4. **Store learnings** - Every solution goes to persistent memory

### **Example: Settings Persistence Fix (What Should Have Been Done)**
```bash
# PARALLEL EXECUTION - All at once!
1. npx claude-flow@alpha swarm "Analyze settings persistence issue" --mode hierarchical
2. mcp__flow-nexus__workflow_create (debugging workflow)
3. Task tool with researcher agent for codebase analysis
4. mcp__puppeteer__puppeteer_navigate (test UI interactions)
5. mcp__sublinear-solver__psycho_symbolic_reason (root cause analysis)

# Result: 5x faster resolution with comprehensive understanding
```

### **1. Feature Specification (Human-Led)**
```bash
# Start with business requirement
/specify "Implement advanced mainframe log analysis with AI-powered pattern detection, real-time alerts, and customizable dashboards for operations teams"

# PARALLEL: Initialize ALL relevant tools immediately
npx claude-flow@alpha hive-mind spawn "Feature planning" --claude &
mcp__flow-nexus__workflow_create "Feature specification workflow" &
mcp__sublinear-solver__knowledge_graph_query "mainframe log analysis patterns"
```

### **2. Technical Planning (AI-Augmented + Tool Orchestration)**
```bash
# MANDATORY: Use ALL planning tools in parallel
/plan "Technical stack definition"

# Simultaneous execution:
npx claude-flow@alpha sparc run architect "System design" &
npx claude-flow@alpha sparc run analyst "Requirements analysis" &
mcp__flow-nexus__neural_train (pattern detection model) &
mcp__flow-nexus__sandbox_create (development environment) &
Task tool "Research log parsing libraries and patterns"
```

### **3. Multi-Agent Implementation (FULL ORCHESTRATION)**
```bash
# NEVER implement manually - Use full swarm deployment
/tasks

# Parallel swarm + MCP coordination:
npx claude-flow@alpha swarm "Backend implementation" --mode hierarchical &
npx claude-flow@alpha swarm "Frontend implementation" --mode parallel &
mcp__flow-nexus__daa_agent_create (autonomous debugging) &
mcp__puppeteer (automated UI testing) &
mcp__sublinear-solver__emergence_matrix_process (optimization)

# Each swarm spawns 5+ specialized agents working simultaneously
```

### **4. Quality Assurance (Multi-Tool Validation)**
```bash
# Comprehensive parallel testing
npx claude-flow@alpha test e2e --with-puppeteer &
npx claude-flow@alpha sparc run security "Full audit" &
npx claude-flow@alpha sparc run performance "Benchmark all endpoints" &
mcp__flow-nexus__neural_validation_workflow &
mcp__puppeteer__puppeteer_screenshot (visual regression testing)

---

## 🔧 **Configuration & Standards**

### **Constitution Compliance**
All development MUST follow `/memory/constitution.md`:
- **Security First**: All data local-first, encrypted communications
- **Performance**: <2s response times, optimized database queries
- **Testing**: TDD mandatory, 80% minimum coverage
- **Cross-Platform**: Windows, macOS, Linux compatibility
- **Documentation**: Auto-generated, always current

### **Tech Stack Standards**
- **Backend**: Node.js + Express.js + PostgreSQL
- **Frontend**: Modern JavaScript + HTML5 + CSS3
- **Desktop**: Electron (cross-platform)
- **AI Integration**: OpenAI API + Google Generative AI
- **Testing**: Jest + Puppeteer + Contract Testing
- **Memory**: SQLite (.swarm/memory.db)

### **Code Quality Gates**
```bash
# Pre-commit verification (automated)
npx claude-flow@alpha verify init strict --threshold 0.95

# Continuous verification during development
npx claude-flow@alpha pair --start --with-verification

# Performance benchmarking
swarm-bench run "Build mainframe integration API" --strategy development
```

---

## 🎛️ **Advanced Features**

### **Swarm Intelligence Modes**
1. **Hierarchical**: Queen agent coordinates specialist workers
2. **Peer-to-Peer**: Agents collaborate directly on shared tasks
3. **Pipeline**: Sequential processing with handoff validation
4. **Parallel**: Independent agents working on separate components

### **Neural Learning System**
```bash
# Initialize SAFLA (Self-Aware Framework Learning Agent)
npx claude-flow@alpha neural init --force

# Goal-Oriented Action Planning
npx claude-flow@alpha goal "Optimize database query performance by 50%"
```

### **MCP Server Configuration**
Ensure your `claude_desktop_config.json` includes:
```json
{
  "mcpServers": {
    "puppeteer": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-puppeteer"],
      "env": {
        "PUPPETEER_LAUNCH_OPTIONS": "{\"headless\": false}",
        "ALLOW_DANGEROUS": "true"
      }
    },
    "memory": {
      "command": "npx", 
      "args": ["-y", "@modelcontextprotocol/server-memory"],
      "env": {
        "MEMORY_PATH": "./.swarm/claude-memory.json"
      }
    }
  }
}
```

---

## 📊 **Monitoring & Optimization**

### **Performance Metrics**
- **Development Speed**: Target 20x improvement with swarm coordination
- **Code Quality**: 95% verification threshold
- **Test Coverage**: 80% minimum, TDD-driven
- **Response Time**: <2s for all user interactions
- **Memory Efficiency**: Auto-cleanup of obsolete data

### **Continuous Improvement**
```bash
# Weekly performance review
npx claude-flow@alpha metrics review --weekly

# Agent performance optimization
npx claude-flow@alpha train-pipeline validate

# Memory system health check
npx claude-flow@alpha memory health --detailed
```

---

## 🚨 **Important Guidelines**

### **✅ MANDATORY DO's:**
- ✅ **ALWAYS use parallel tool execution** - Multiple tools in single message
- ✅ **Deploy swarms for ANY complex task** - No manual implementation
- ✅ **Use Task tool for research** - Never manually search files
- ✅ **Leverage ALL MCP servers** - Puppeteer, Flow Nexus, Sublinear Solver
- ✅ **Store every learning** - Claude Flow memory for all solutions
- ✅ **Test with automation** - Puppeteer for UI, swarms for unit tests
- ✅ **Optimize with algorithms** - Sublinear solver for performance
- ✅ **Create workflows** - Flow Nexus for repeatable processes
- ✅ **Use specialized agents** - SPARC modes for specific tasks
- ✅ **Monitor with metrics** - Continuous performance tracking

### **❌ ABSOLUTELY DON'T:**
- ❌ **Manual debugging** - ALWAYS use swarm analysis first
- ❌ **Sequential tool usage** - ALWAYS parallel execution
- ❌ **Direct file editing without analysis** - Use agents to understand first
- ❌ **Skip orchestration for "simple" tasks** - No task is too simple
- ❌ **Implement without swarm coordination** - Even small features
- ❌ **Test manually** - Automation is mandatory
- ❌ **Forget to store learnings** - Every session adds to memory
- ❌ **Use single agent when swarm available** - Always multi-agent
- ❌ **Ignore available MCP tools** - All servers must be utilized
- ❌ **Work without TodoWrite tracking** - Task management is critical

---

## 🔄 **Version & Updates**

- **Spec Kit**: GitHub Spec Kit v0.0.53
- **Claude Flow**: v2.0.0 Alpha.88 (64 specialized agents)
- **MCP Puppeteer**: @modelcontextprotocol/server-puppeteer v2025.5.12
- **Constitution**: v1.0.0 (see `/memory/constitution.md`)

**Last Updated**: 2025-09-25
**Next Review**: Monitor Claude Flow Alpha releases weekly

---

## 🎓 **Learning from Mistakes**

### **Case Study: Settings Persistence Issue**
**What Happened**: Manual debugging approach took excessive time
**What Should Have Happened**: Parallel swarm deployment with:
- Claude Flow swarm for code analysis
- Flow Nexus workflow for systematic debugging
- Puppeteer for UI testing
- Task tool for research
- Sublinear solver for optimization

**Lesson**: EVERY problem deserves full tool orchestration, regardless of perceived simplicity.

---

*🌊 Powered by GitHub Spec Kit + Claude Flow 2.0 Alpha + Full MCP Ecosystem*
*Maximum efficiency through comprehensive tool orchestration*