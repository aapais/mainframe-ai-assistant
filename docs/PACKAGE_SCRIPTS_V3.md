# Package Scripts V3.0 - Hybrid Development Commands

## 🎯 Overview

The Package Scripts V3.0 documentation covers all npm scripts available in the hybrid Vite + Next.js + Electron architecture. This includes root-level scripts and Next.js app-specific scripts.

## 📦 Root Package Scripts (package.json)

### 🚀 Development Scripts

#### Frontend Development
```bash
# Vite Development (Legacy Mode)
npm run dev              # Start Vite dev server on port 3000
npm start                # Alternative command for Vite dev server
npm run start:clean      # Clean start with optimizations

# Next.js Development (Modern Mode)
npm run dev:next         # Start Next.js dev server on port 3001
npm run start:next       # Start Next.js production server

# Combined Development
npm run dev & npm run dev:next & npm run server:dev  # All services
```

#### Backend Development
```bash
# Express Server
npm run server           # Start Express server on port 8080
npm run server:dev       # Start server with auto-reload (--watch)

# Database Operations
npm run migrate          # Run database migrations
npm run migrate:status   # Check migration status
npm run db:check         # Verify database integrity
```

### 🏗️ Build Scripts

#### Production Builds
```bash
# Individual Builds
npm run build            # Build Vite version for production
npm run build:next       # Build Next.js version for production
npm run preview          # Preview Vite production build

# Combined Builds
npm run build:all        # Build both Vite + Next.js versions
npm run build:combined   # Optimized combined build process

# Electron Builds
npm run build:electron   # Build complete Electron application
npm run package:win      # Package Windows installer (.exe)
npm run package:mac      # Package macOS application (.dmg)
npm run package:linux    # Package Linux application (.AppImage)
```

### 🧪 Testing & Quality Scripts

#### Testing
```bash
# Core Testing
npm test                 # Run Jest tests (all)
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Run tests with coverage report

# Platform-Specific Testing
npm run test:next        # Run Next.js linting and tests
npm run test:e2e         # Run end-to-end tests (Playwright)
npm run test:electron    # Test Electron application
```

#### Code Quality
```bash
# Linting
npm run lint             # Run ESLint on source files
npm run lint:fix         # Auto-fix ESLint issues

# Type Checking
npm run typecheck        # Run TypeScript compiler checks
npm run typecheck:watch  # Run type checking in watch mode

# Formatting
npm run format           # Format code with Prettier
npm run format:check     # Check if code is properly formatted
```

### 🔧 Utility Scripts

#### Dependency Management
```bash
# Installation & Updates
npm run install:clean    # Clean install (remove node_modules + reinstall)
npm run deps:update      # Update all dependencies
npm run deps:audit       # Security audit for dependencies
npm run deps:fix         # Fix security vulnerabilities

# Dependency Analysis
npm run deps:check       # Check dependency synchronization
npm run bundle:analyze   # Analyze bundle sizes
```

#### Development Tools
```bash
# Electron Development
npm run electron         # Start Electron application
npm run electron:dev     # Start Electron with development settings
npm run electron:debug   # Start Electron with debugging enabled

# Database Management
npm run db:backup        # Backup database
npm run db:restore       # Restore database from backup
npm run db:reset         # Reset database to initial state
```

### 🧹 Maintenance Scripts

#### Cleanup
```bash
# Build Cleanup
npm run clean            # Remove build artifacts
npm run clean:all        # Deep clean (node_modules, builds, cache)
npm run clean:cache      # Clear npm and build caches

# Log Management
npm run logs:clear       # Clear application logs
npm run logs:archive     # Archive old logs
```

## 📱 Next.js App Scripts (app/package.json)

### Core Next.js Commands
```bash
# Development
cd app && npm run dev    # Start Next.js dev server (port 3001)
cd app && npm start      # Start Next.js production server

# Building
cd app && npm run build  # Build Next.js application
cd app && npm run export # Export static Next.js application

# Quality
cd app && npm run lint   # Run Next.js ESLint configuration
```

### Integrated Scripts (Root Level)
```bash
# These root scripts automatically handle app/ directory
npm run dev:next         # Equivalent to: cd app && npm run dev
npm run build:next       # Equivalent to: cd app && npm run build
npm run start:next       # Equivalent to: cd app && npm start
npm run test:next        # Equivalent to: cd app && npm run lint
```

## 🔄 Script Categories & Usage

### 1. Daily Development Workflow

#### Morning Setup
```bash
# Start development environment
npm run dev:next         # Next.js frontend (recommended)
# OR
npm run dev              # Vite frontend (legacy)

# In separate terminals:
npm run server:dev       # Backend API server
npm run electron:dev     # Electron desktop app (optional)
```

#### Development Commands
```bash
# Code quality checks
npm run typecheck        # Before committing
npm run lint             # Check for issues
npm run lint:fix         # Auto-fix issues

# Testing
npm test                 # Unit tests
npm run test:watch       # Continuous testing
```

#### End of Day
```bash
# Build verification
npm run build:next       # Verify Next.js builds
npm run build            # Verify Vite builds (if changed)

# Clean up
npm run clean:cache      # Clear development cache
```

### 2. Feature Development Workflow

#### New Feature (Next.js)
```bash
# 1. Start Next.js development
npm run dev:next

# 2. Develop feature in app/ directory
# 3. Test during development
npm run typecheck
npm run lint

# 4. Build and test
npm run build:next
npm run start:next

# 5. Test in Electron
npm run electron:dev
```

#### Bug Fix (Existing Code)
```bash
# 1. Determine code location (Vite vs Next.js)
# 2. Start appropriate dev server
npm run dev              # For Vite components
# OR
npm run dev:next         # For Next.js components

# 3. Fix and test
npm test
npm run typecheck

# 4. Verify in both modes if shared
npm run build:all
```

### 3. Release Workflow

#### Pre-Release Testing
```bash
# 1. Clean build all versions
npm run clean
npm install
npm run build:all

# 2. Run complete test suite
npm test
npm run test:next
npm run test:e2e

# 3. Security audit
npm run deps:audit

# 4. Build Electron packages
npm run build:electron
npm run package:win      # Windows
```

#### Release Build
```bash
# 1. Version bump
npm version patch|minor|major

# 2. Production build
NODE_ENV=production npm run build:all

# 3. Package all platforms
npm run package:win
npm run package:mac
npm run package:linux

# 4. Verify distributions
ls -la dist-packages/
```

## 🎛️ Advanced Script Usage

### Environment-Specific Scripts

#### Development Environment
```bash
# With environment variables
NODE_ENV=development npm run dev:next
DEBUG=* npm run server:dev

# With specific ports
PORT=3002 npm run dev:next
SERVER_PORT=8081 npm run server:dev
```

#### Production Environment
```bash
# Production builds
NODE_ENV=production npm run build:all
NODE_ENV=production npm run build:electron

# Production server
NODE_ENV=production npm run start:next
```

#### Testing Environment
```bash
# Test-specific environment
NODE_ENV=test npm test
NODE_ENV=test npm run test:e2e

# CI environment
CI=true npm test
CI=true npm run build:all
```

### Parallel Script Execution

#### Using npm-run-all (if installed)
```bash
# Install utility
npm install --save-dev npm-run-all

# Run scripts in parallel
npx run-p dev dev:next server:dev

# Run scripts in sequence
npx run-s clean build:all test
```

#### Using Built-in Shell
```bash
# Background processes
npm run dev & npm run dev:next & npm run server:dev

# Wait for completion
npm run build && npm run test

# Conditional execution
npm run lint || npm run lint:fix
```

## 🔧 Custom Script Configuration

### Adding New Scripts

#### Root Package.json
```json
{
  "scripts": {
    // Custom development script
    "dev:full": "npm run dev & npm run dev:next & npm run server:dev",

    // Custom build script
    "build:optimized": "npm run clean && npm run build:all && npm run bundle:analyze",

    // Custom testing script
    "test:full": "npm run typecheck && npm run lint && npm test && npm run test:e2e"
  }
}
```

#### Environment-Specific Scripts
```json
{
  "scripts": {
    "dev:staging": "NODE_ENV=staging npm run dev:next",
    "build:staging": "NODE_ENV=staging npm run build:next",
    "deploy:staging": "npm run build:staging && scp -r app/out/ staging-server:/var/www/"
  }
}
```

### Script Composition

#### Complex Workflows
```json
{
  "scripts": {
    "release": "npm run deps:audit && npm run test:full && npm run build:all && npm version patch",
    "deploy": "npm run release && npm run package:win && ./scripts/deploy.sh",
    "health-check": "npm run typecheck && npm run lint && npm test && npm run build:next"
  }
}
```

## 📊 Script Performance Monitoring

### Timing Scripts

#### Using time Command
```bash
# Measure build times
time npm run build
time npm run build:next
time npm run build:all

# Compare performance
echo "Vite: $(time npm run build 2>&1 | grep real)"
echo "Next.js: $(time npm run build:next 2>&1 | grep real)"
```

#### Performance Tracking Script
```bash
# Add to package.json
"perf:build": "node scripts/measure-build-performance.js"
```

```javascript
// scripts/measure-build-performance.js
const { execSync } = require('child_process');
const fs = require('fs');

function measureBuild(command, name) {
  const start = Date.now();
  execSync(command, { stdio: 'inherit' });
  const duration = Date.now() - start;

  console.log(`${name}: ${duration}ms`);
  return { name, duration };
}

const results = [
  measureBuild('npm run build', 'Vite Build'),
  measureBuild('npm run build:next', 'Next.js Build'),
];

fs.writeFileSync('build-performance.json', JSON.stringify(results, null, 2));
```

## 🚨 Troubleshooting Scripts

### Common Script Issues

#### Port Conflicts
```bash
# Check port usage
netstat -ano | findstr :3000
netstat -ano | findstr :3001
netstat -ano | findstr :8080

# Kill processes
npm run kill:ports        # Custom script to kill common ports
```

#### Permission Issues
```bash
# Fix npm permissions
npm run fix:permissions   # Custom script

# Clear npm cache
npm run clean:cache
```

#### Build Failures
```bash
# Debug builds
DEBUG=* npm run build
DEBUG=* npm run build:next

# Verbose output
npm run build -- --verbose
npm run build:next -- --verbose
```

### Diagnostic Scripts

```json
{
  "scripts": {
    "diagnose": "npm run check:node && npm run check:deps && npm run check:ports",
    "check:node": "node --version && npm --version",
    "check:deps": "npm list --depth=0",
    "check:ports": "node scripts/check-ports.js",
    "fix:permissions": "sudo chown -R $(whoami) ~/.npm && npm cache clean --force",
    "kill:ports": "node scripts/kill-ports.js"
  }
}
```

## 🎯 Script Best Practices

### Naming Conventions

```bash
# Good script names
npm run dev:next         # Environment:mode
npm run build:electron   # Action:target
npm run test:e2e         # Action:type
npm run deps:audit       # Category:action

# Avoid ambiguous names
npm run start            # Which service?
npm run build            # Which version?
```

### Error Handling

```json
{
  "scripts": {
    "build:safe": "npm run typecheck && npm run lint && npm run build",
    "test:required": "npm test || (echo 'Tests failed!' && exit 1)",
    "deploy:with-checks": "npm run health-check && npm run build:all && ./deploy.sh"
  }
}
```

### Documentation

```json
{
  "scripts": {
    "help": "echo 'Available scripts:' && npm run",
    "dev:help": "echo 'Development: npm run dev (Vite) or npm run dev:next (Next.js)'",
    "build:help": "echo 'Building: npm run build:all for both versions'"
  }
}
```

## 🔮 Future Script Enhancements

### Planned Improvements

#### Automation Scripts
- [ ] Automated dependency updates
- [ ] Performance regression detection
- [ ] Automated testing across modes
- [ ] Build optimization suggestions

#### Developer Experience
- [ ] Interactive script selector
- [ ] Script execution time tracking
- [ ] Intelligent script recommendations
- [ ] Visual script dependency graph

#### CI/CD Integration
- [ ] GitHub Actions integration
- [ ] Automated quality gates
- [ ] Performance monitoring
- [ ] Deployment automation

---

The Package Scripts V3.0 provides comprehensive command documentation for efficient development with the hybrid Vite + Next.js + Electron architecture.