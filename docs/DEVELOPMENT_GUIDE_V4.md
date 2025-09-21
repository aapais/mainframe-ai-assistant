# Development Guide v4.0 - Next.js + Electron Stack

## Quick Reference

### 🚀 Start Development
```bash
npm run dev
# Starts Next.js dev server + Electron simultaneously
```

### 🏗️ Build for Production
```bash
npm run build              # Build Next.js app
npm run electron:build     # Package Electron app
```

### 📦 Platform Packaging
```bash
npm run package:win        # Windows NSIS installer
npm run package:mac        # macOS DMG package
npm run package:linux      # Linux AppImage
```

## Development Workflow

### 1. Setting Up Environment

**Prerequisites:**
- Node.js ≥ 18.0.0
- npm ≥ 9.0.0

**Installation:**
```bash
# Clone and install
git clone <repository>
cd mainframe-ai-assistant
npm install                # Installs root + app dependencies
```

### 2. Development Commands

**Full Development Stack:**
```bash
npm run dev
# Runs: Next.js dev server (port 3000) + Electron
```

**Frontend Only (Next.js):**
```bash
cd app
npm run dev
# Runs: Next.js dev server only (port 3000)
```

**Electron Only:**
```bash
npm run electron
# Runs: Electron pointing to built app
```

### 3. Project Structure Understanding

```
mainframe-ai-assistant/
├── app/                    # 🌐 Next.js Frontend Application
│   ├── components/        # React components
│   │   ├── incident/     # Incident management UI
│   │   ├── kb-entry/     # Knowledge base UI
│   │   ├── forms/        # Form components
│   │   ├── ui/           # Base UI components
│   │   └── settings/     # Settings UI
│   ├── pages/            # Next.js pages (App Router)
│   │   ├── incidents/    # Incident pages
│   │   ├── knowledge-base/ # KB pages
│   │   └── settings/     # Settings pages
│   ├── styles/           # CSS and Tailwind
│   ├── utils/            # Frontend utilities
│   ├── package.json      # Next.js dependencies
│   ├── next.config.js    # Next.js configuration
│   └── tsconfig.json     # Frontend TypeScript config
│
├── src/                   # 🖥️ Electron Desktop Application
│   ├── main/             # Electron main process
│   │   ├── main.ts       # Electron entry point
│   │   └── ipc/          # IPC handlers
│   ├── preload/          # Preload scripts
│   │   └── preload.js    # Context bridge
│   └── database/         # Database schemas
│
├── docs/                 # 📚 Documentation
├── tests/                # 🧪 Tests
├── package.json          # Root package (Electron deps)
└── tsconfig.json         # Root TypeScript config
```

## Code Organization

### Frontend Components (app/components/)

**Component Structure:**
```typescript
// app/components/incident/IncidentCard.tsx
import React from 'react'
import { Incident } from '../types'

interface IncidentCardProps {
  incident: Incident
  onUpdate: (incident: Incident) => void
}

export const IncidentCard: React.FC<IncidentCardProps> = ({
  incident,
  onUpdate
}) => {
  return (
    <div className="p-4 border rounded-lg">
      {/* Component content */}
    </div>
  )
}
```

**Barrel Exports:**
```typescript
// app/components/incident/index.ts
export { IncidentCard } from './IncidentCard'
export { IncidentForm } from './IncidentForm'
export { IncidentList } from './IncidentList'
```

### IPC Communication

**Frontend → Backend:**
```typescript
// app/utils/api.ts
export const incidentAPI = {
  getAll: () => window.electronAPI.incidents.getAll(),
  create: (data: CreateIncidentData) =>
    window.electronAPI.incidents.create(data),
  update: (id: string, data: UpdateIncidentData) =>
    window.electronAPI.incidents.update(id, data)
}
```

**Backend Handler:**
```typescript
// src/main/ipc/IncidentHandler.ts
import { ipcMain } from 'electron'
import { IncidentService } from '../services/IncidentService'

export class IncidentHandler {
  constructor(private incidentService: IncidentService) {
    this.setupHandlers()
  }

  private setupHandlers() {
    ipcMain.handle('incidents:getAll', async () => {
      return this.incidentService.getAll()
    })

    ipcMain.handle('incidents:create', async (event, data) => {
      return this.incidentService.create(data)
    })
  }
}
```

## Development Best Practices

### 1. **File Naming Conventions**

```
Components:     PascalCase       (IncidentCard.tsx)
Pages:         kebab-case       (incident-detail.tsx)
Utilities:     camelCase        (formatDate.ts)
Types:         PascalCase       (Incident.ts)
Hooks:         camelCase        (useIncidents.ts)
```

### 2. **Component Patterns**

**Functional Components with TypeScript:**
```typescript
interface Props {
  title: string
  children: React.ReactNode
}

export const Card: React.FC<Props> = ({ title, children }) => {
  return (
    <div className="card">
      <h3>{title}</h3>
      {children}
    </div>
  )
}
```

**Custom Hooks:**
```typescript
// app/hooks/useIncidents.ts
import { useState, useEffect } from 'react'
import { incidentAPI } from '../utils/api'

export const useIncidents = () => {
  const [incidents, setIncidents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadIncidents = async () => {
      try {
        const data = await incidentAPI.getAll()
        setIncidents(data)
      } finally {
        setLoading(false)
      }
    }

    loadIncidents()
  }, [])

  return { incidents, loading, refetch: loadIncidents }
}
```

### 3. **Styling with Tailwind**

**Component Classes:**
```typescript
const buttonVariants = {
  primary: 'bg-blue-600 hover:bg-blue-700 text-white',
  secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-900',
  danger: 'bg-red-600 hover:bg-red-700 text-white'
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  children,
  ...props
}) => {
  return (
    <button
      className={`px-4 py-2 rounded-md ${buttonVariants[variant]}`}
      {...props}
    >
      {children}
    </button>
  )
}
```

## Testing Strategy

### Unit Tests
```typescript
// app/components/__tests__/IncidentCard.test.tsx
import { render, screen } from '@testing-library/react'
import { IncidentCard } from '../IncidentCard'

describe('IncidentCard', () => {
  it('renders incident title', () => {
    const incident = { id: '1', title: 'Test Incident' }
    render(<IncidentCard incident={incident} onUpdate={jest.fn()} />)

    expect(screen.getByText('Test Incident')).toBeInTheDocument()
  })
})
```

### Integration Tests
```typescript
// tests/e2e/incident-flow.test.ts
import { test, expect } from '@playwright/test'

test('create new incident', async ({ page }) => {
  await page.goto('/')
  await page.click('[data-testid="new-incident-button"]')
  await page.fill('[data-testid="incident-title"]', 'Test Incident')
  await page.click('[data-testid="save-button"]')

  await expect(page.locator('[data-testid="incident-list"]'))
    .toContainText('Test Incident')
})
```

## Database Operations

### Database Service
```typescript
// src/services/DatabaseService.ts
import Database from 'better-sqlite3'

export class DatabaseService {
  private db: Database.Database

  constructor(dbPath: string) {
    this.db = new Database(dbPath)
    this.setupTables()
  }

  private setupTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS incidents (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'open',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)
  }

  getIncidents() {
    return this.db.prepare('SELECT * FROM incidents ORDER BY created_at DESC').all()
  }

  createIncident(data: CreateIncidentData) {
    const stmt = this.db.prepare(`
      INSERT INTO incidents (id, title, description)
      VALUES (?, ?, ?)
    `)
    return stmt.run(data.id, data.title, data.description)
  }
}
```

## Build Process

### Development Build
```bash
# Next.js development with hot reload
cd app && npm run dev

# Electron development (separate terminal)
npm run electron
```

### Production Build
```bash
# 1. Build Next.js app
npm run build
# Runs: cd app && npm run build && npm run export

# 2. Package Electron
npm run electron:build
# Runs: electron-builder with app/out as source
```

### Build Configuration

**Next.js Config (app/next.config.js):**
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',           // Static export for Electron
  trailingSlash: true,        // Required for file:// protocol
  images: {
    unoptimized: true         // No optimization for Electron
  },
  assetPrefix: process.env.NODE_ENV === 'production' ? './' : '',
}

module.exports = nextConfig
```

**Electron Builder Config:**
```json
{
  "appId": "com.accenture.mainframe-ai-assistant",
  "productName": "Accenture Mainframe AI Assistant",
  "directories": {
    "output": "dist-packages"
  },
  "files": [
    "src/main/main.js",
    "src/preload/preload.js",
    "app/out/**/*",
    "kb-assistant.db"
  ]
}
```

## Debugging

### Development Debugging

**Next.js DevTools:**
- React DevTools (browser extension)
- Next.js debugger in browser dev tools
- Console logs in browser

**Electron DevTools:**
```typescript
// src/main/main.ts
if (isDev) {
  mainWindow.webContents.openDevTools()
}
```

**VS Code Debug Configuration:**
```json
// .vscode/launch.json
{
  "configurations": [
    {
      "name": "Debug Electron Main",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/src/main/main.ts",
      "outFiles": ["${workspaceFolder}/dist/**/*.js"]
    }
  ]
}
```

### Production Debugging

**Log Files:**
- Windows: `%USERPROFILE%\\AppData\\Roaming\\mainframe-ai-assistant\\logs\\`
- macOS: `~/Library/Logs/mainframe-ai-assistant/`
- Linux: `~/.config/mainframe-ai-assistant/logs/`

## Performance Optimization

### Next.js Optimization
```typescript
// Lazy loading components
const IncidentForm = lazy(() => import('./IncidentForm'))

// Memoization
const MemoizedIncidentCard = memo(IncidentCard)

// Performance monitoring
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals'

getCLS(console.log)
getFID(console.log)
getFCP(console.log)
getLCP(console.log)
getTTFB(console.log)
```

### Electron Optimization
```typescript
// Preload optimization
contextBridge.exposeInMainWorld('electronAPI', {
  incidents: {
    getAll: () => ipcRenderer.invoke('incidents:getAll'),
    // Pre-bind IPC calls for better performance
  }
})

// Memory management
process.on('warning', (warning) => {
  console.warn(warning.stack)
})
```

## Common Issues & Solutions

### Issue: Next.js dev server not starting
```bash
cd app
rm -rf .next node_modules
npm install
npm run dev
```

### Issue: Electron not connecting to Next.js
```bash
# Check if port 3000 is available
lsof -i :3000

# Verify wait-on configuration
wait-on http://localhost:3000
```

### Issue: Build failures
```bash
# Clean everything
npm run clean
npm run install:clean

# Rebuild
npm run build
```

### Issue: TypeScript errors
```bash
# Check types
npm run typecheck
cd app && npm run type-check

# Regenerate types
rm -rf node_modules/@types
npm install
```

## Git Workflow

### Branch Naming
```
feature/incident-management
bugfix/search-performance
hotfix/database-connection
```

### Commit Messages
```
feat: add incident status workflow
fix: resolve search performance issue
docs: update development guide
refactor: simplify component structure
```

### Pre-commit Hooks
```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "npm run lint && npm run typecheck"
    }
  }
}
```

---

**Development Stack**: Next.js 14 + Electron 33 + TypeScript
**Last Updated**: September 21, 2025