# Setup Guide V2.0
## Accenture Mainframe AI Assistant Development Environment

**Version**: 2.0.0
**Date**: September 21, 2024
**Target Audience**: Developers, DevOps, QA Engineers

---

## 🎯 Overview

This guide provides comprehensive setup instructions for the Accenture Mainframe AI Assistant development environment. The application uses a modern stack with React 18, TypeScript, Vite, and Electron for cross-platform desktop deployment.

## 📋 System Requirements

### Minimum Requirements
```yaml
Operating System:
  - Windows: 10/11 (64-bit)
  - macOS: 10.14+ (Mojave or later)
  - Linux: Ubuntu 18.04+ / Debian 10+ / CentOS 8+

Hardware:
  - RAM: 8GB minimum, 16GB recommended
  - CPU: Dual-core 2.5GHz minimum, Quad-core 3.0GHz recommended
  - Storage: 5GB free space for development environment
  - Display: 1920x1080 minimum resolution

Network:
  - Internet connection for package downloads
  - Corporate firewall configuration may be required
```

### Required Software
```yaml
Core Development:
  - Node.js: >=18.0.0 (LTS recommended)
  - npm: >=9.0.0 (comes with Node.js)
  - Git: >=2.30.0

Database:
  - SQLite: Built into Better-SQLite3 package
  - Database Browser (optional): DB Browser for SQLite

Code Editor (Recommended):
  - Visual Studio Code: >=1.80.0
  - Extensions: See .vscode/extensions.json

Optional Tools:
  - Docker: >=20.10.0 (for containerized testing)
  - Chrome/Edge: Latest version (for debugging)
```

---

## 🛠️ Environment Setup

### 1. Install Node.js and npm

#### Windows
```powershell
# Option 1: Download from official website
# Visit https://nodejs.org and download LTS version

# Option 2: Using Chocolatey
choco install nodejs

# Option 3: Using winget
winget install OpenJS.NodeJS

# Verify installation
node --version  # Should be >=18.0.0
npm --version   # Should be >=9.0.0
```

#### macOS
```bash
# Option 1: Download from official website
# Visit https://nodejs.org and download LTS version

# Option 2: Using Homebrew
brew install node

# Option 3: Using MacPorts
sudo port install nodejs18

# Verify installation
node --version  # Should be >=18.0.0
npm --version   # Should be >=9.0.0
```

#### Linux (Ubuntu/Debian)
```bash
# Option 1: Using NodeSource repository (recommended)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Option 2: Using snap
sudo snap install node --classic

# Option 3: Using package manager (may be outdated)
sudo apt update
sudo apt install nodejs npm

# Verify installation
node --version  # Should be >=18.0.0
npm --version   # Should be >=9.0.0
```

### 2. Install Git

#### Windows
```powershell
# Option 1: Download from https://git-scm.com/download/win

# Option 2: Using Chocolatey
choco install git

# Option 3: Using winget
winget install Git.Git
```

#### macOS
```bash
# Git comes with Xcode Command Line Tools
xcode-select --install

# Or using Homebrew
brew install git
```

#### Linux
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install git

# CentOS/RHEL/Fedora
sudo yum install git
# or
sudo dnf install git
```

### 3. Configure Git (Required)
```bash
# Set your identity
git config --global user.name "Your Name"
git config --global user.email "your.email@accenture.com"

# Set default branch name
git config --global init.defaultBranch main

# Configure line endings (Windows users)
git config --global core.autocrlf true

# Configure line endings (macOS/Linux users)
git config --global core.autocrlf input

# Verify configuration
git config --list
```

---

## 📁 Project Setup

### 1. Clone Repository
```bash
# Clone the repository
git clone <repository-url>
cd mainframe-ai-assistant

# Verify you're on the correct branch
git branch -a
git checkout main  # or development branch
```

### 2. Install Dependencies
```bash
# Clean install (recommended for first setup)
npm install

# If you encounter permission errors on Windows
npm install --no-optional

# If you encounter native dependency issues
npm install --build-from-source

# Verify installation
npm list --depth=0
```

### 3. Environment Configuration
```bash
# Copy environment template
cp .env.example .env.development

# Edit environment variables (optional)
# Most defaults should work for local development
```

#### Environment Variables
```bash
# .env.development
NODE_ENV=development
VITE_API_BASE_URL=http://localhost:3000
VITE_ENABLE_DEVTOOLS=true
VITE_LOG_LEVEL=debug

# Optional: AI Configuration
GEMINI_API_KEY=your_gemini_key_here
OPENAI_API_KEY=your_openai_key_here

# Optional: Development Features
VITE_ENABLE_PERFORMANCE_MONITORING=true
VITE_ENABLE_ACCESSIBILITY_TESTING=true
```

### 4. Database Setup
```bash
# Initialize database with migrations
npm run migrate

# Verify database creation
ls -la src/database/
# Should show app.db file

# Check migration status
npm run migrate:status

# Optional: Seed with test data
npm run seed  # If seed script exists
```

---

## 🔧 IDE Configuration

### Visual Studio Code Setup

#### 1. Install VS Code
```bash
# Download from https://code.visualstudio.com/

# Or using package managers:
# Windows (Chocolatey)
choco install vscode

# macOS (Homebrew)
brew install --cask visual-studio-code

# Linux (Ubuntu/Debian)
sudo snap install code --classic
```

#### 2. Install Recommended Extensions
```bash
# Open project in VS Code
code .

# VS Code will prompt to install recommended extensions
# Or install manually:
```

**Essential Extensions** (defined in `.vscode/extensions.json`):
- **TypeScript**: Enhanced TypeScript support
- **ESLint**: Code linting and formatting
- **Prettier**: Code formatting
- **Tailwind CSS**: Tailwind intellisense and autocomplete
- **Auto Rename Tag**: Automatically rename paired HTML tags
- **Bracket Pair Colorizer**: Color-code bracket pairs
- **GitLens**: Enhanced Git capabilities

#### 3. VS Code Settings
The project includes workspace settings in `.vscode/settings.json`:
```json
{
  "typescript.preferences.includePackageJsonAutoImports": "auto",
  "eslint.workingDirectories": ["src"],
  "prettier.configPath": ".prettierrc",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "tailwindCSS.includeLanguages": {
    "typescript": "javascript",
    "typescriptreact": "javascript"
  },
  "files.associations": {
    "*.css": "tailwindcss"
  }
}
```

#### 4. Keyboard Shortcuts (Recommended)
Add to VS Code keybindings.json:
```json
[
  {
    "key": "ctrl+shift+t",
    "command": "workbench.action.terminal.new"
  },
  {
    "key": "ctrl+shift+p",
    "command": "workbench.action.showCommands"
  },
  {
    "key": "ctrl+`",
    "command": "workbench.action.terminal.toggleTerminal"
  }
]
```

---

## 🚀 Development Workflow

### 1. Start Development Server
```bash
# Start the development server
npm run dev

# Alternative start command
npm start

# Clean start (clears cache)
npm run start:clean

# The application will open at: http://localhost:3000
```

#### Development Server Features
- **Hot Module Replacement**: Changes reflect instantly
- **TypeScript Checking**: Real-time type checking
- **ESLint Integration**: Code quality feedback
- **Automatic Port Selection**: Finds available port if 3000 is busy

### 2. Run in Electron (Desktop Mode)
```bash
# Start Electron development mode
npm run electron:dev

# This will:
# 1. Start the Vite dev server
# 2. Launch Electron with the app
# 3. Enable hot reload for both processes
```

### 3. Code Quality Checks
```bash
# TypeScript type checking
npm run typecheck

# ESLint code quality check
npm run lint

# Fix auto-fixable ESLint issues
npm run lint:fix

# Format code with Prettier
npm run format

# Run all quality checks
npm run quality-check  # If script exists
```

### 4. Testing
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- --testPathPattern=IncidentForm

# Debug tests
npm test -- --verbose
```

### 5. Building
```bash
# Build for production
npm run build

# Preview production build
npm run preview

# Build for Electron
npm run build:electron

# Package for distribution
npm run package:win    # Windows
npm run package:mac    # macOS
npm run package:linux  # Linux
```

---

## 🗃️ Database Management

### SQLite Database
The application uses SQLite with Better-SQLite3 for data storage.

#### Database Location
```bash
# Development database
src/database/app.db

# Test database (if running tests)
src/database/test.db

# Backup location
src/database/backups/
```

#### Database Operations
```bash
# Run migrations
npm run migrate

# Check migration status
npm run migrate:status

# Rollback last migration
npm run migrate:rollback

# Create new migration
npm run migration:create migration_name

# Reset database (warning: deletes all data)
npm run db:reset
```

#### Database Browser Setup
```bash
# Install DB Browser for SQLite
# Windows: Download from https://sqlitebrowser.org/
# macOS: brew install --cask db-browser-for-sqlite
# Linux: sudo apt install sqlitebrowser

# Open database
sqlitebrowser src/database/app.db
```

#### Manual Database Inspection
```bash
# Using sqlite3 command line
sqlite3 src/database/app.db

# Common commands:
.tables                 # List all tables
.schema entries         # Show table schema
SELECT COUNT(*) FROM entries;  # Count entries
.quit                   # Exit
```

---

## 🌐 Network Configuration

### Corporate Firewall Setup
If working behind a corporate firewall:

#### npm Configuration
```bash
# Set npm registry (if needed)
npm config set registry https://registry.npmjs.org/

# Configure proxy (if needed)
npm config set proxy http://proxy.company.com:8080
npm config set https-proxy http://proxy.company.com:8080

# Verify configuration
npm config list
```

#### Git Configuration for Corporate Networks
```bash
# Configure Git proxy (if needed)
git config --global http.proxy http://proxy.company.com:8080
git config --global https.proxy http://proxy.company.com:8080

# Configure SSL verification (if needed)
git config --global http.sslVerify false  # Use with caution
```

### Port Configuration
Default ports used by the application:
```yaml
Development Server: 3000
Electron IPC: Internal
Database: Local file (no port)
API Server: 3001 (if using separate backend)
```

To change the default port:
```bash
# Method 1: Environment variable
PORT=3001 npm run dev

# Method 2: Update package.json
"dev": "npx vite --port 3001 --host"

# Method 3: Update vite.config.ts
server: {
  port: 3001
}
```

---

## 🧪 Testing Setup

### Test Environment Configuration
```bash
# Test database setup (automatic)
NODE_ENV=test npm run migrate

# Run test suite
npm test

# Watch mode for development
npm run test:watch
```

### Testing Tools Included
- **Jest**: Test framework and runner
- **React Testing Library**: React component testing
- **@testing-library/jest-dom**: Additional Jest matchers
- **ts-jest**: TypeScript support for Jest

### Test File Patterns
```bash
# Test files are automatically detected:
**/*.test.ts
**/*.test.tsx
**/*.spec.ts
**/*.spec.tsx
**/__tests__/**/*.ts
**/__tests__/**/*.tsx
```

### Writing Your First Test
```typescript
// Example: src/components/Button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';

describe('Button Component', () => {
  test('renders button with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button')).toHaveTextContent('Click me');
  });

  test('calls onClick when clicked', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

---

## 🔍 Troubleshooting Setup Issues

### Common Issues and Solutions

#### Issue 1: Node.js Version Problems
```bash
# Problem: "Node.js version not supported"
# Solution: Check and update Node.js version

node --version
# If version is < 18.0.0, update Node.js

# Using nvm (Node Version Manager)
nvm install 18
nvm use 18
```

#### Issue 2: npm Install Failures
```bash
# Problem: Permission errors or package conflicts
# Solution: Clean install

# Clear npm cache
npm cache clean --force

# Delete node_modules and package-lock.json
rm -rf node_modules package-lock.json

# Reinstall
npm install

# On Windows with permission issues:
npm install --no-optional
```

#### Issue 3: SQLite Build Errors
```bash
# Problem: Better-SQLite3 native compilation fails
# Solution: Install build tools

# Windows: Install Visual Studio Build Tools
npm install --global --production windows-build-tools

# macOS: Install Xcode Command Line Tools
xcode-select --install

# Linux: Install build essentials
sudo apt install build-essential python3

# Then rebuild
npm rebuild better-sqlite3
```

#### Issue 4: Port Already in Use
```bash
# Problem: Port 3000 is already in use
# Solution: Use different port or kill process

# Find process using port 3000
lsof -ti:3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows

# Kill process
kill -9 <PID>  # macOS/Linux
taskkill /PID <PID> /F  # Windows

# Or use different port
npm run dev -- --port 3001
```

#### Issue 5: TypeScript Errors
```bash
# Problem: TypeScript compilation errors
# Solution: Check configuration and update

# Run type check
npm run typecheck

# Common fixes:
# 1. Update tsconfig.json
# 2. Install missing type definitions
npm install --save-dev @types/node @types/react @types/react-dom

# 3. Clear TypeScript cache
rm -rf node_modules/.cache
```

#### Issue 6: Vite Build Issues
```bash
# Problem: Vite build or dev server issues
# Solution: Clear cache and rebuild

# Clear Vite cache
rm -rf node_modules/.vite

# Clear browser cache
# Chrome: DevTools > Network > Disable cache

# Restart development server
npm run dev
```

---

## 📊 Performance Optimization

### Development Performance
```bash
# Enable Vite optimizations
# In vite.config.ts:
optimizeDeps: {
  include: ['react', 'react-dom', 'react-router-dom'],
  exclude: ['electron']
}

# Use SWC for faster builds (if needed)
npm install --save-dev @vitejs/plugin-react-swc
```

### Memory Optimization
```bash
# Increase Node.js memory limit (if needed)
export NODE_OPTIONS="--max-old-space-size=4096"

# Or in package.json scripts:
"dev": "NODE_OPTIONS=\"--max-old-space-size=4096\" npx vite --port 3000"
```

### Build Optimization
```bash
# Analyze bundle size
npm run build -- --analyze

# Monitor build performance
npm run build -- --profile

# Enable compression
npm install --save-dev vite-plugin-compression
```

---

## 🔒 Security Considerations

### Development Security
```bash
# Keep dependencies updated
npm audit
npm audit fix

# Use exact versions for critical dependencies
npm install --save-exact react@18.3.1

# Configure CSP headers (Content Security Policy)
# In Electron main process:
session.defaultSession.webSecurity = true
```

### Environment Variables Security
```bash
# Never commit sensitive data
# Add to .gitignore:
.env.local
.env.development.local
.env.production.local

# Use environment-specific files:
.env.development  # Committed (no secrets)
.env.local        # Not committed (secrets)
```

---

## 📚 Additional Resources

### Documentation
- **Project Documentation**: `/docs` directory
- **Component Library**: Storybook (if implemented)
- **API Documentation**: Auto-generated from TypeScript interfaces

### Learning Resources
- **React 18**: https://react.dev/
- **TypeScript**: https://www.typescriptlang.org/docs/
- **Vite**: https://vitejs.dev/guide/
- **Electron**: https://www.electronjs.org/docs/latest/
- **Tailwind CSS**: https://tailwindcss.com/docs

### Support Channels
1. **Team Documentation**: This guide and related docs
2. **Code Comments**: Inline documentation in source code
3. **Git History**: Commit messages and PR descriptions
4. **Team Members**: Ask experienced team members

---

## ✅ Setup Verification

### Final Verification Checklist
Run these commands to verify your setup:

```bash
# 1. Verify Node.js and npm versions
node --version  # Should be >=18.0.0
npm --version   # Should be >=9.0.0

# 2. Verify project dependencies
npm list --depth=0  # Should show all dependencies

# 3. Verify TypeScript compilation
npm run typecheck  # Should pass without errors

# 4. Verify linting
npm run lint  # Should pass without errors

# 5. Verify database setup
ls -la src/database/app.db  # Should exist

# 6. Verify development server
npm run dev  # Should start without errors
# Open http://localhost:3000 in browser

# 7. Verify Electron mode
npm run electron:dev  # Should open desktop app

# 8. Verify tests
npm test  # Should run and pass

# 9. Verify build
npm run build  # Should complete without errors
```

### Success Indicators
When setup is complete, you should see:
- ✅ Development server starts on http://localhost:3000
- ✅ Application loads without console errors
- ✅ TypeScript compilation passes
- ✅ Tests run successfully
- ✅ Electron app opens in desktop mode
- ✅ Database operations work (create/read incidents)

---

## 🎉 Congratulations!

Your development environment is now set up and ready for development. You can start:

1. **Exploring the codebase**: Browse `src/renderer/components/`
2. **Running the application**: Use `npm run dev` for web or `npm run electron:dev` for desktop
3. **Making changes**: Edit components and see changes instantly
4. **Writing tests**: Add tests in `tests/` directory
5. **Contributing**: Follow the development workflow in the migration guide

For next steps, refer to:
- **Developer Migration Guide**: `docs/DEVELOPER_MIGRATION_GUIDE.md`
- **Architecture Documentation**: `docs/MIGRATION_MASTER_DOCUMENTATION_V2.md`
- **Component Examples**: `src/renderer/components/unified/`

Happy coding! 🚀