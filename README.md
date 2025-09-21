# Accenture Mainframe AI Assistant

**Enterprise Knowledge Management & AI-Powered Incident Resolution System**

[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](https://github.com/aapais/mainframe-ai-assistant)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)]()
[![License](https://img.shields.io/badge/license-Proprietary-red.svg)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.2.2-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14.2.18-black.svg)](https://nextjs.org/)
[![Electron](https://img.shields.io/badge/Electron-33.3.0-blue.svg)](https://www.electronjs.org/)

## 🎯 Overview

Modern **Next.js + Electron** enterprise application designed for mainframe operations teams to manage incidents, search knowledge bases, and leverage AI-powered solutions for faster problem resolution. Built with **Next.js 14** and **Electron 33**, the application features a unified architecture where resolved incidents automatically become searchable knowledge base entries, eliminating data duplication and creating an integrated knowledge ecosystem.

## 🚀 Technology Stack

- **Frontend**: Next.js 14 with App Router + React 18
- **Desktop**: Electron 33 with secure IPC communication
- **Database**: SQLite with Better-SQLite3 (embedded)
- **Styling**: Tailwind CSS with utility-first design
- **Language**: TypeScript (strict mode)
- **Build**: Static export optimized for Electron

## ✨ Key Features

### 🚨 **Incident Management**
- Complete lifecycle management (create → assign → resolve → knowledge)
- SLA tracking and deadline monitoring
- Priority-based queue management with real-time updates
- Status workflow automation with customizable transitions
- Bulk operations support for efficiency

### 🔍 **AI-Powered Unified Search**
- Hybrid search combining traditional and semantic capabilities
- Single interface for both active incidents and knowledge base
- Real-time suggestions and auto-complete
- Advanced filtering by category, severity, date range
- Cross-reference between incidents and solutions

### 📊 **Analytics & Insights**
- Real-time dashboard with key performance indicators
- Incident resolution time tracking and trends
- Knowledge base effectiveness metrics
- AI operation cost tracking and budget management
- Team performance analytics

### ⚙️ **Enterprise Settings**
- Hierarchical settings organization for scalability
- AI provider configuration (Gemini, OpenAI)
- Transparent AI operation authorization with cost tracking
- User preference management and customization
- Role-based access control

### ♿ **Accessibility & Performance**
- **WCAG 2.1 AA compliant** interface
- Screen reader optimized with proper ARIA labels
- Complete keyboard navigation support
- High contrast themes and focus management
- Optimized performance with lazy loading and code splitting

## 🏗️ Architecture: Next.js + Electron

```
┌─────────────────────────────────────────┐
│              ELECTRON SHELL             │
│  ┌─────────────────────────────────────┐ │
│  │         NEXT.JS APPLICATION         │ │
│  │         (Static Export)             │ │
│  └─────────────────────────────────────┘ │
│  ┌─────────────────────────────────────┐ │
│  │       IPC Communication             │ │
│  └─────────────────────────────────────┘ │
│  ┌─────────────────────────────────────┐ │
│  │    SQLite Database + File System    │ │
│  └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### **Clean Single Stack**
- **Frontend**: Next.js 14 with App Router (no Vite dependencies)
- **Desktop**: Electron 33 with secure IPC
- **Database**: SQLite with Better-SQLite3 (embedded)
- **Build**: Static export optimized for Electron
- **Development**: Concurrent Next.js dev server + Electron

### **Unified Database Design**
- **Single Schema**: Eliminates data duplication between incidents and knowledge
- **Type Discrimination**: `entry_type` field distinguishes incidents from knowledge entries
- **Automatic Conversion**: Resolved incidents become searchable knowledge automatically
- **Full-Text Search**: FTS5 implementation for high-performance search across all content

## 🚀 Quick Start

### Prerequisites

- Node.js ≥ 18.0.0
- npm ≥ 9.0.0

### Installation

```bash
# Clone repository
git clone <repository-url>
cd mainframe-ai-assistant

# Install dependencies (root + Next.js app)
npm install

# Start development (Next.js + Electron)
npm run dev
```

**Single Stack Development:**
- **Frontend**: Next.js dev server on `http://localhost:3000`
- **Desktop**: Electron app pointing to Next.js dev server
- **Hot Reload**: Full Next.js Fast Refresh support

## 📋 Available Scripts

### Development Commands
```bash
# Full Development Stack
npm run dev              # Start Next.js + Electron
npm run electron:dev     # Same as above (alias)

# Individual Components
cd app && npm run dev    # Next.js only (port 3000)
npm run electron         # Electron only (after Next.js built)
```

### Production Build
```bash
# Build & Package
npm run build            # Build Next.js app + export static files
npm run electron:build   # Package Electron application
npm run electron:dist    # Build without publishing

# Platform Specific
npm run package:win      # Windows NSIS installer
npm run package:mac      # macOS DMG package
npm run package:linux    # Linux AppImage
```

### Quality & Testing
```bash
# Type Checking & Linting
npm run typecheck        # TypeScript checking
npm run lint             # ESLint (Next.js app)
npm run lint:fix         # Auto-fix ESLint issues

# Testing
npm run test             # Run tests
npm run test:watch       # Watch mode testing
```

### Maintenance
```bash
npm run clean            # Clean all build artifacts
npm run install:clean    # Clean install all dependencies
```

## 📁 Project Structure

```
mainframe-ai-assistant/
├── app/                     # 🌐 Next.js 14 Application
│   ├── components/         # React components
│   │   ├── incident/      # Incident management UI
│   │   ├── kb-entry/      # Knowledge base UI
│   │   ├── forms/         # Form components
│   │   ├── ui/            # Base UI components
│   │   └── settings/      # Settings UI
│   ├── pages/             # Next.js pages (App Router)
│   ├── styles/            # CSS and Tailwind
│   ├── utils/             # Frontend utilities
│   ├── package.json       # Next.js dependencies
│   └── next.config.js     # Next.js configuration
│
├── src/                    # 🖥️ Electron Desktop Application
│   ├── main/              # Electron main process
│   │   ├── main.ts        # Electron entry point
│   │   └── ipc/           # IPC handlers
│   ├── preload/           # Preload scripts
│   ├── database/          # Database schemas
│   └── services/          # Core services
│
├── docs/                  # 📚 Documentation
├── tests/                 # 🧪 Tests
├── package.json           # Root package (Electron deps)
└── tsconfig.json          # Root TypeScript config
```

## 🔧 Core Components

### Active Components (312 files)
- **Incident Management**: Complete incident lifecycle
- **AI Integration**: Authorization dialogs and cost tracking
- **Search Interface**: Unified search with filters
- **Settings System**: Hierarchical settings management
- **Accessibility**: WCAG-compliant components
- **Performance**: Optimized rendering and loading

### Recently Removed (Major Cleanup)
- Legacy KB management components
- Outdated layout systems
- Redundant search components
- Complex interaction patterns
- Deprecated testing utilities

## 🚀 Key Features

### Incident Management
- Create, edit, and track mainframe incidents
- AI-powered analysis and recommendations
- Semantic search for similar incidents
- Status workflow management
- Bulk operations support

### AI Integration
- Transparent AI operation authorization
- Cost tracking and budget management
- Operation history and audit trail
- Configurable AI providers (Gemini, OpenAI)

### Search & Knowledge Base
- Hybrid search (traditional + semantic)
- Real-time suggestions and filters
- Category-based organization
- Usage analytics and success tracking

### Accessibility
- Screen reader optimized
- Keyboard navigation support
- High contrast themes
- Focus management
- ARIA landmarks and labels

## 🔄 Recent Changes

### Major Cleanup (September 2024)
- Removed 200+ legacy components and files
- Consolidated search functionality
- Streamlined component architecture
- Updated build and dependency management
- Improved TypeScript configuration

### Current Focus
- Incident management system refinement
- AI integration enhancement
- Performance optimization
- Accessibility compliance
- Modern React patterns adoption

## 🛠️ Development Guidelines

### Code Style
- TypeScript strict mode enabled
- Functional components with hooks
- Tailwind CSS for styling
- ESLint + Prettier for formatting

### Performance
- Lazy loading for non-critical components
- Optimized bundle splitting
- Efficient state management
- Minimal re-renders

### Accessibility
- Semantic HTML structure
- ARIA attributes where needed
- Keyboard navigation support
- Screen reader announcements

## 🐛 Troubleshooting

### Common Issues

**Build Errors**
```bash
npm run typecheck    # Check TypeScript issues
npm run fix:deps     # Fix dependency problems
```

**Database Issues**
```bash
npm run migrate:status    # Check migration state
npm run migrate          # Apply pending migrations
```

**Development Server**
```bash
npm run start:clean      # Clean start
rm -rf node_modules && npm install  # Full reset
```

## 📊 Performance Metrics

- **Bundle Size**: Optimized for enterprise environments
- **Load Time**: < 3s initial load on corporate networks
- **Accessibility**: WCAG 2.1 AA compliant
- **Browser Support**: Modern browsers (Chrome 90+, Firefox 88+, Safari 14+)

## 🤝 Contributing

1. Follow the existing code patterns
2. Write tests for new features
3. Ensure accessibility compliance
4. Run linting and type checking
5. Update documentation as needed

## 📝 License

Proprietary - Accenture. All rights reserved.

## 📚 Documentation

- **Stack Guide**: [docs/NEXTJS_ELECTRON_STACK.md](docs/NEXTJS_ELECTRON_STACK.md)
- **Development**: [docs/DEVELOPMENT_GUIDE_V4.md](docs/DEVELOPMENT_GUIDE_V4.md)
- **Migration**: [docs/MIGRATION_COMPLETED.md](docs/MIGRATION_COMPLETED.md)
- **Architecture**: [docs/architecture/](docs/architecture/)

---

**Built with Next.js 14 + Electron 33 - Clean, Modern, Single Stack** 🚀