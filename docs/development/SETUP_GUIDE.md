# Setup Guide V3.0 - Hybrid Development Environment

## 🎯 Overview

This setup guide covers the complete installation and configuration of the Accenture Mainframe AI Assistant with hybrid Vite + Next.js + Electron architecture.

## 📋 Prerequisites

### System Requirements
- **Node.js**: 18.0.0 or higher
- **npm**: 9.0.0 or higher
- **Git**: Latest version
- **Operating System**: Windows 10+, macOS 12+, or Ubuntu 20.04+

### Development Tools (Recommended)
- **Visual Studio Code** with extensions:
  - TypeScript and JavaScript Language Features
  - ESLint
  - Prettier
  - Tailwind CSS IntelliSense
  - Auto Rename Tag

## 🚀 Installation Process

### 1. Repository Clone

```bash
# Clone the repository
git clone <repository-url>
cd mainframe-ai-assistant

# Verify directory structure
ls -la
```

### 2. Dependency Installation

```bash
# Install root dependencies (includes Vite, Electron, shared tools)
npm install

# Install Next.js app dependencies
cd app && npm install && cd ..

# Verify installations
npm list --depth=0
cd app && npm list --depth=0
```

### 3. Environment Configuration

#### Create Environment Files

```bash
# Root environment
cp .env.example .env.development

# Next.js environment
cd app && cp .env.local.example .env.local
```

#### Configure Environment Variables

**.env.development** (Root)
```bash
# Database
DATABASE_PATH=./kb-assistant.db
DATABASE_BACKUP_PATH=./backups/

# Server Configuration
SERVER_PORT=8080
SERVER_HOST=localhost

# AI Configuration (Optional)
OPENAI_API_KEY=your_openai_key_here
GOOGLE_AI_API_KEY=your_gemini_key_here

# Development Settings
NODE_ENV=development
DEBUG=false
LOG_LEVEL=info
```

**app/.env.local** (Next.js)
```bash
# Next.js Configuration
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_APP_MODE=development

# Feature Flags
NEXT_PUBLIC_ENABLE_AI=true
NEXT_PUBLIC_ENABLE_ANALYTICS=false

# Build Settings
ANALYZE=false
```

### 4. Database Setup

```bash
# Initialize SQLite database
npm run migrate

# Optional: Add sample data
node scripts/insert-sample-data.js

# Verify database
npm run db:check
```

## 🔧 Development Modes

### Mode 1: Vite Development (Legacy)

```bash
# Terminal 1: Start Vite dev server
npm run dev
# Available at: http://localhost:3000

# Terminal 2: Start backend server
npm run server:dev
# API available at: http://localhost:8080

# Terminal 3: Start Electron (optional)
npm run electron:dev
```

**Features:**
- Hot Module Replacement (HMR)
- TypeScript compilation
- Tailwind CSS processing
- ESLint integration
- React Router navigation

### Mode 2: Next.js Development (Modern)

```bash
# Terminal 1: Start Next.js dev server
npm run dev:next
# Available at: http://localhost:3001

# Terminal 2: Start backend server
npm run server:dev
# API available at: http://localhost:8080

# Terminal 3: Start Electron with Next.js
npm run electron:dev
```

**Features:**
- Fast Refresh
- App Router support
- Built-in API routes
- Optimized bundling
- Server-side rendering ready

### Mode 3: Combined Development

```bash
# Start all services concurrently
npm run dev & npm run dev:next & npm run server:dev

# Or use PM2 (if installed)
pm2 start ecosystem.config.js
```

### Mode 4: Production Testing

```bash
# Build and test Vite version
npm run build
npm run preview

# Build and test Next.js version
npm run build:next
npm run start:next

# Build and test Electron
npm run build:electron
```

## 🏗️ Project Structure Setup

### Directory Overview
```
mainframe-ai-assistant/
├── src/                    # Vite application source
│   ├── main/              # Electron main process
│   ├── renderer/          # Vite React application
│   ├── database/          # Database schema & migrations
│   ├── services/          # Shared business logic
│   ├── types/             # TypeScript definitions
│   └── styles/            # Global styles
├── app/                   # Next.js application
│   ├── components/        # Next.js React components
│   ├── (dashboard)/       # App Router routes
│   ├── api/               # API routes
│   ├── globals.css        # Next.js global styles
│   └── layout.tsx         # Root layout
├── docs/                  # Documentation
├── tests/                 # Test files
├── scripts/               # Build & utility scripts
└── dist/                  # Build output
```

### Configuration Files
```
├── package.json           # Root package configuration
├── next.config.js         # Next.js configuration
├── vite.config.ts         # Vite configuration
├── electron-builder.json  # Electron build configuration
├── tsconfig.json          # TypeScript configuration
├── tailwind.config.js     # Tailwind CSS configuration
├── .eslintrc.json         # ESLint configuration
└── .prettierrc            # Prettier configuration
```

## ⚙️ Development Configuration

### 1. TypeScript Setup

**Root tsconfig.json**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@main/*": ["./src/main/*"],
      "@renderer/*": ["./src/renderer/*"],
      "@shared/*": ["./src/shared/*"]
    }
  }
}
```

**app/tsconfig.json** (Next.js)
```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"],
      "@main/*": ["../src/main/*"],
      "@renderer/*": ["../src/renderer/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"]
}
```

### 2. ESLint Configuration

**.eslintrc.json**
```json
{
  "extends": [
    "eslint:recommended",
    "@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "plugin:jsx-a11y/recommended"
  ],
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint", "react", "react-hooks", "jsx-a11y"],
  "rules": {
    "react/react-in-jsx-scope": "off",
    "@typescript-eslint/no-unused-vars": "error",
    "jsx-a11y/anchor-is-valid": "off"
  },
  "settings": {
    "react": {
      "version": "detect"
    }
  }
}
```

### 3. Tailwind CSS Setup

**tailwind.config.js**
```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/renderer/**/*.{js,ts,jsx,tsx}',
    './app/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          500: '#3b82f6',
          900: '#1e3a8a',
        },
        accenture: {
          purple: '#A100FF',
          blue: '#0073E6',
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
};
```

## 🔄 Workflow Setup

### 1. Git Hooks (Husky)

```bash
# Install Husky
npm install --save-dev husky
npx husky install

# Add pre-commit hook
npx husky add .husky/pre-commit "npm run lint && npm run typecheck"

# Add pre-push hook
npx husky add .husky/pre-push "npm test"
```

### 2. VS Code Configuration

**.vscode/settings.json**
```json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "files.associations": {
    "*.css": "tailwindcss"
  },
  "tailwindCSS.includeLanguages": {
    "typescript": "javascript",
    "typescriptreact": "javascript"
  }
}
```

**.vscode/launch.json** (Debugging)
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Electron Main",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/src/main/main.ts",
      "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron",
      "runtimeArgs": ["--remote-debugging-port=9223"],
      "outFiles": ["${workspaceFolder}/dist/**/*.js"]
    },
    {
      "name": "Debug Next.js",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/app/node_modules/next/dist/bin/next",
      "args": ["dev", "-p", "3001"],
      "cwd": "${workspaceFolder}/app"
    }
  ]
}
```

## 🧪 Testing Setup

### 1. Jest Configuration

**jest.config.js**
```javascript
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@main/(.*)$': '<rootDir>/src/main/$1',
    '^@renderer/(.*)$': '<rootDir>/src/renderer/$1',
  },
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/tests/**/*.{js,jsx,ts,tsx}',
  ],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/main/**/*',
  ],
};
```

### 2. Test Scripts

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run Next.js specific tests
npm run test:next
```

## 🔧 Troubleshooting Setup

### Common Issues

#### 1. Node.js Version Issues
```bash
# Check version
node --version
npm --version

# Install specific version with nvm
nvm install 18
nvm use 18
```

#### 2. Permission Issues (Windows)
```powershell
# Run as Administrator
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Clear npm cache
npm cache clean --force
```

#### 3. Port Conflicts
```bash
# Check port usage
netstat -ano | findstr :3000
netstat -ano | findstr :3001
netstat -ano | findstr :8080

# Kill processes if needed
taskkill /PID <PID> /F
```

#### 4. Database Issues
```bash
# Reset database
rm kb-assistant.db
npm run migrate

# Check database file
ls -la *.db
```

#### 5. Build Failures
```bash
# Clear all caches
rm -rf node_modules package-lock.json
rm -rf app/node_modules app/package-lock.json
rm -rf dist app/.next

# Reinstall everything
npm install
cd app && npm install
```

### Verification Commands

```bash
# Verify installation
npm run typecheck
npm run lint
npm test

# Verify builds
npm run build
npm run build:next

# Verify Electron
npm run electron:dev
```

## 📊 Performance Optimization

### Development Performance

```bash
# Enable TypeScript incremental compilation
echo '{"compilerOptions": {"incremental": true}}' > tsconfig.tsbuildinfo

# Use Vite cache
rm -rf node_modules/.vite  # Only if issues

# Optimize Next.js
cd app && rm -rf .next  # Only if issues
```

### VS Code Performance

```json
// .vscode/settings.json
{
  "typescript.disableAutomaticTypeAcquisition": true,
  "typescript.preferences.includePackageJsonAutoImports": "off",
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.next": true
  }
}
```

## 🎯 Next Steps

After successful setup:

1. **Read Documentation**: Review `/docs/` folder
2. **Explore Codebase**: Start with `/src/renderer/` or `/app/`
3. **Run Tests**: `npm test` to verify everything works
4. **Start Development**: Choose your preferred mode
5. **Check Examples**: Look at existing components

### Learning Resources

- [Vite Documentation](https://vitejs.dev/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Electron Documentation](https://www.electronjs.org/docs)
- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## 🆘 Getting Help

### Internal Resources
- **Documentation**: `/docs/` folder
- **Examples**: `/src/renderer/examples/`
- **Tests**: `/tests/` folder

### External Resources
- [Project Issues](https://github.com/your-repo/issues)
- [Development Chat](https://teams.microsoft.com/your-team)
- [Code Reviews](https://github.com/your-repo/pulls)

---

You're now ready to develop with the hybrid Vite + Next.js + Electron architecture! Choose your preferred development mode and start building.