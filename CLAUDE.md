# Claude Code Configuration - Mainframe AI Assistant
## Spec-Driven Development with Advanced MCP Integration

### 🎯 **Core Philosophy**
This project follows **Spec-Driven Development** using GitHub Spec Kit, enhanced with **Claude Flow 2.0 Alpha** orchestration and **MCP Puppeteer** for web automation. Focus on architecture and strategy while AI handles implementation through coordinated multi-agent workflows.

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

## 🏗️ **Development Workflow**

### **1. Feature Specification (Human-Led)**
```bash
# Start with business requirement
/specify "Implement advanced mainframe log analysis with AI-powered pattern detection, real-time alerts, and customizable dashboards for operations teams"

# Refine specification iteratively
/clarify "What specific log formats should be supported?"
/clarify "Define SLA requirements for real-time processing"
```

### **2. Technical Planning (AI-Augmented)**
```bash
# Define technical approach
/plan "Use Node.js with Stream processing, TensorFlow.js for pattern detection, Socket.io for real-time updates, React dashboard with Chart.js visualizations, PostgreSQL for metadata storage"

# Initialize swarm for complex planning
npx claude-flow@alpha hive-mind spawn "Technical Architecture: Log Analysis System" --claude
```

### **3. Multi-Agent Implementation (AI-Led)**
```bash
# Generate tasks with TDD approach
/tasks

# Execute with swarm coordination
npx claude-flow@alpha swarm "Implement log parsing engine with TensorFlow.js integration" --mode hierarchical

# Parallel agent deployment:
# - Agent 1: Backend API development
# - Agent 2: Frontend React components  
# - Agent 3: Test suite creation
# - Agent 4: Documentation generation
# - Agent 5: Security validation
```

### **4. Quality Assurance (Automated)**
```bash
# Comprehensive testing with Puppeteer
npx claude-flow@alpha test e2e --with-puppeteer

# Security audit
npx claude-flow@alpha sparc run security "Audit log analysis system"

# Performance validation
npx claude-flow@alpha benchmark --target-response-time 2s
```

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

### **DO:**
- ✅ Always load memory context before starting work
- ✅ Use swarm mode for complex, multi-component features  
- ✅ Follow TDD: Tests → Fail → Implement → Pass
- ✅ Store architectural decisions in persistent memory
- ✅ Use Puppeteer for E2E testing and documentation screenshots
- ✅ Maintain single source of truth in `.swarm/memory.db`

### **DON'T:**
- ❌ Create duplicate servers or conflicting processes
- ❌ Skip constitution compliance checks
- ❌ Leave obsolete files in project directories
- ❌ Implement without specifications
- ❌ Bypass security validation for auth flows
- ❌ Mix development environments (use containers)

---

## 🔄 **Version & Updates**

- **Spec Kit**: GitHub Spec Kit v0.0.53
- **Claude Flow**: v2.0.0 Alpha.88 (64 specialized agents)
- **MCP Puppeteer**: @modelcontextprotocol/server-puppeteer v2025.5.12
- **Constitution**: v1.0.0 (see `/memory/constitution.md`)

**Last Updated**: 2025-09-25  
**Next Review**: Monitor Claude Flow Alpha releases weekly

---

*🌊 Powered by GitHub Spec Kit + Claude Flow 2.0 Alpha + MCP Puppeteer*  
*Orchestrating the future of AI-powered development*