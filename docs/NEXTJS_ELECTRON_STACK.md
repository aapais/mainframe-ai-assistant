# Next.js + Electron Stack Guide

## Architecture Overview

This project uses a **Next.js 14 + Electron 33** architecture with clear separation between the frontend application and desktop wrapper.

```
┌─────────────────────────────────────────┐
│              ELECTRON SHELL             │
│  ┌─────────────────────────────────────┐ │
│  │         NEXT.JS APPLICATION         │ │
│  │                                     │ │
│  │  ┌───────────┐  ┌─────────────────┐ │ │
│  │  │    UI     │  │  Business Logic │ │ │
│  │  │Components │  │   & Services    │ │ │
│  │  └───────────┘  └─────────────────┘ │ │
│  │                                     │ │
│  │  ┌─────────────────────────────────┐ │ │
│  │  │        App Router (Next.js)     │ │ │
│  │  └─────────────────────────────────┘ │ │
│  └─────────────────────────────────────┘ │
│                                          │
│  ┌─────────────────────────────────────┐ │
│  │       IPC Communication             │ │
│  └─────────────────────────────────────┘ │
│                                          │
│  ┌─────────────────────────────────────┐ │
│  │       Native OS Integration         │ │
│  │    (File System, Notifications)     │ │
│  └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

## Project Structure

```
mainframe-ai-assistant/
├── app/                          # Next.js 14 Application
│   ├── components/              # React components
│   │   ├── incident/           # Incident management
│   │   ├── kb-entry/           # Knowledge base
│   │   ├── forms/              # Forms & inputs
│   │   ├── ui/                 # Base UI components
│   │   └── ...
│   ├── pages/                  # Next.js pages
│   │   ├── incidents/          # Incident pages
│   │   ├── knowledge-base/     # KB pages
│   │   └── settings/           # Settings pages
│   ├── styles/                 # CSS & Tailwind
│   ├── utils/                  # Frontend utilities
│   ├── package.json           # Next.js dependencies
│   ├── next.config.js         # Next.js configuration
│   └── tsconfig.json          # Next.js TypeScript config
│
├── src/                        # Electron Application
│   ├── main/                  # Electron main process
│   │   ├── main.ts            # Entry point
│   │   └── ipc/               # IPC handlers
│   ├── preload/               # Preload scripts
│   └── shared/                # Shared utilities
│
├── docs/                      # Documentation
├── tests/                     # Tests
├── package.json              # Root dependencies (Electron)
├── tsconfig.json             # Root TypeScript config
└── electron-builder.json    # Electron packaging config
```

## Development Workflow

### 1. Development Mode

Start both Next.js and Electron in development:
```bash
npm run dev
```

This command:
1. Starts Next.js dev server on `http://localhost:3000`
2. Waits for Next.js to be ready
3. Launches Electron pointing to the dev server

### 2. Individual Components

**Next.js only** (for frontend development):
```bash
cd app
npm run dev
```

**Electron only** (after Next.js is built):
```bash
npm run electron
```

### 3. Production Build

**Full production build**:
```bash
npm run build              # Builds Next.js + exports static files
npm run electron:build     # Packages Electron application
```

**Platform-specific packaging**:
```bash
npm run package:win        # Windows NSIS installer
npm run package:mac        # macOS DMG package
npm run package:linux      # Linux AppImage
```

## Technology Stack

### Frontend (Next.js App)
- **Framework**: Next.js 14 with App Router
- **UI Library**: React 18
- **Styling**: Tailwind CSS
- **Components**: Custom component library
- **State Management**: React hooks + Context
- **TypeScript**: Full type safety
- **Forms**: Custom form components
- **Routing**: Next.js App Router

### Desktop (Electron)
- **Framework**: Electron 33
- **Main Process**: TypeScript
- **IPC**: Custom handlers for frontend communication
- **Database**: Better-SQLite3 (embedded)
- **File System**: Native Node.js APIs
- **Notifications**: Electron notifications

### Database & Backend
- **Database**: SQLite with Better-SQLite3
- **Migrations**: Custom migration system
- **Schema**: Incident management + Knowledge base
- **Backup**: File-based backup system

## Key Features

### 1. **Incident Management**
- Create, update, delete incidents
- Status workflow (Open → In Progress → Resolved → Closed)
- Priority levels and categorization
- Related incidents and KB entries
- AI-powered suggestions

### 2. **Knowledge Base**
- Problem-solution entries
- Full-text search with FTS5
- Category and tag management
- Usage tracking and success rates
- Import/export capabilities

### 3. **Search & Discovery**
- Unified search across incidents and KB
- Advanced filtering and sorting
- Search result ranking
- Recent searches and history

### 4. **Settings & Configuration**
- User preferences
- AI integration settings
- Export/import configurations
- Theme and appearance

## Development Commands

### Root Package Commands
```bash
# Development
npm run dev                    # Start full development environment
npm run electron:dev          # Same as dev (alias)

# Building
npm run build                 # Build Next.js app + export
npm run electron:build       # Package Electron app
npm run electron:dist        # Build without publishing

# Platform Packaging
npm run package:win          # Windows installer
npm run package:mac          # macOS package
npm run package:linux       # Linux package

# Maintenance
npm run clean                # Clean all build artifacts
npm run install:clean       # Clean install all dependencies
```

### App Package Commands (cd app/)
```bash
# Development
npm run dev                  # Next.js development server
npm run build               # Production build
npm run export              # Export static files
npm run start               # Production server

# Quality
npm run lint                # ESLint checking
npm run lint:fix            # Fix ESLint issues
npm run type-check          # TypeScript checking
npm run test                # Run tests
```

## Configuration Files

### Next.js Configuration (`app/next.config.js`)
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',           // Static export for Electron
  trailingSlash: true,        // Required for Electron
  images: {
    unoptimized: true         // No image optimization for Electron
  },
  assetPrefix: process.env.NODE_ENV === 'production' ? './' : '',
}

module.exports = nextConfig
```

### Electron Builder (`electron-builder.json`)
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

## Communication Flow

### Frontend → Backend (IPC)
```typescript
// Frontend (Next.js)
const result = await window.electronAPI.incidents.getAll()
const incident = await window.electronAPI.incidents.create(data)

// Backend (Electron)
ipcMain.handle('incidents:getAll', async () => {
  return incidentService.getAll()
})
```

### Database Operations
```typescript
// IPC Handler
ipcMain.handle('database:query', async (event, sql, params) => {
  return database.prepare(sql).all(params)
})

// Frontend Usage
const incidents = await window.electronAPI.database.query(
  'SELECT * FROM incidents WHERE status = ?',
  ['open']
)
```

## Best Practices

### 1. **File Organization**
- Keep Next.js components in `app/components/`
- Organize by feature (incident, kb-entry, forms)
- Use index files for clean imports

### 2. **State Management**
- Use React Context for global state
- Local state with useState/useReducer
- IPC calls in custom hooks

### 3. **TypeScript**
- Define interfaces in `src/types/`
- Use strict type checking
- Share types between frontend/backend

### 4. **Performance**
- Use Next.js static export for production
- Lazy load components when possible
- Optimize images and assets

### 5. **Testing**
- Unit tests for utilities and hooks
- Integration tests for IPC communication
- E2E tests for critical workflows

## Troubleshooting

### Common Issues

**1. Next.js dev server not starting**
```bash
cd app
rm -rf .next node_modules
npm install
npm run dev
```

**2. Electron not connecting to Next.js**
- Check if port 3000 is available
- Verify `wait-on` is waiting for correct URL
- Check firewall settings

**3. Build failures**
```bash
npm run clean
npm run install:clean
npm run build
```

**4. TypeScript errors**
```bash
npm run typecheck
cd app && npm run type-check
```

### Debug Mode

Enable debug mode:
```bash
DEBUG=* npm run dev
```

### Logs Location
- **Development**: Console output
- **Production**: `~/Library/Logs/mainframe-ai-assistant/` (macOS)
- **Production**: `%USERPROFILE%\AppData\Roaming\mainframe-ai-assistant\logs\` (Windows)

## Migration Notes

This project was migrated from Vite to Next.js. Key changes:
- Removed all Vite dependencies and configurations
- Restructured components into Next.js app directory
- Updated build pipeline for static export
- Separated frontend and desktop dependencies

For detailed migration information, see `MIGRATION_COMPLETED.md`.

---

**Stack**: Next.js 14 + Electron 33 + TypeScript
**Last Updated**: September 21, 2025