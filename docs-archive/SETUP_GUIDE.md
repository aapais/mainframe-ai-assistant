# Setup Guide - Accenture Mainframe AI Assistant

Complete installation and development setup guide for the Mainframe AI Assistant application.

## 🎯 Prerequisites

### System Requirements
- **Node.js**: 18.0.0 or higher
- **npm**: 9.0.0 or higher
- **Git**: Latest version
- **Operating System**: Windows 10+, macOS 12+, or Linux

### Recommended Development Tools
- **VS Code**: With TypeScript and React extensions
- **Chrome/Firefox**: For development and debugging
- **Git client**: Command line or GUI tool

## 🚀 Installation Steps

### 1. Clone Repository

```bash
# Clone the repository
git clone <repository-url>
cd mainframe-ai-assistant

# Verify you're in the correct directory
ls -la
```

### 2. Install Dependencies

```bash
# Install all dependencies
npm install

# Alternative if you encounter issues
npm run install:clean
```

### 3. Database Setup

```bash
# Run database migrations
npm run migrate

# Verify migration status
npm run migrate:status
```

### 4. Start Development Server

```bash
# Start the development server
npm run dev

# Alternative start commands
npm start
npm run start:clean
```

The application will be available at: `http://localhost:3000`

## 📋 Development Scripts

### Core Development Commands

```bash
# Start development server
npm run dev              # Primary development command
npm start                # Alternative start
npm run start:clean      # Clean start with scripts

# Build for production
npm run build            # Create production build
npm run preview          # Preview production build locally
```

### Code Quality & Testing

```bash
# Run tests
npm test                 # Run all tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Generate coverage report

# Code quality
npm run lint             # Run ESLint
npm run lint:check       # Check without fixing
npm run format           # Format with Prettier
npm run format:check     # Check formatting
npm run typecheck        # TypeScript type checking
```

### Database Management

```bash
# Migration commands
npm run migrate          # Apply pending migrations
npm run migrate:status   # Check migration status
npm run migrate:rollback # Rollback last migration
```

### Maintenance & Troubleshooting

```bash
# Dependency management
npm run install:clean    # Clean install (removes node_modules)
npm run fix:deps         # Fix dependency issues with legacy peer deps

# CI/CD commands (used in pipelines)
npm run ci:install       # Clean install for CI
npm run ci:lint          # Lint check for CI
npm run ci:test          # Test with coverage for CI
npm run ci:build         # Build with type checking for CI
```

## 🗂️ Project Structure Overview

```
mainframe-ai-assistant/
├── src/
│   ├── components/          # Legacy components (being phased out)
│   ├── database/           # SQLite schema and migrations
│   ├── main/              # Electron main process
│   ├── renderer/          # React application (MAIN DEVELOPMENT AREA)
│   │   ├── components/    # Active React components
│   │   │   ├── ai/        # AI integration components
│   │   │   ├── incident/  # Incident management
│   │   │   ├── search/    # Search functionality
│   │   │   ├── settings/  # Settings and configuration
│   │   │   ├── ui/        # Base UI components
│   │   │   └── ...        # Other component categories
│   │   ├── pages/         # Main application pages
│   │   ├── views/         # Application views
│   │   ├── hooks/         # Custom React hooks
│   │   ├── contexts/      # React contexts
│   │   ├── services/      # Business logic
│   │   └── styles/        # Component-specific styles
│   ├── services/          # Core application services
│   ├── types/             # TypeScript type definitions
│   └── styles/            # Global styles
├── docs/                  # Documentation
├── tests/                 # Test files
├── config/               # Configuration files
└── scripts/              # Build and utility scripts
```

## 🛠️ Development Workflow

### 1. Starting Development

```bash
# Pull latest changes
git pull origin master

# Install/update dependencies
npm install

# Run migrations if needed
npm run migrate

# Start development server
npm run dev
```

### 2. Making Changes

```bash
# Create feature branch (recommended)
git checkout -b feature/your-feature-name

# Make your changes in src/renderer/ directory

# Run type checking
npm run typecheck

# Run tests
npm test

# Format code
npm run format
```

### 3. Testing Your Changes

```bash
# Run all quality checks
npm run lint
npm run typecheck
npm test

# Test production build
npm run build
npm run preview
```

### 4. Committing Changes

```bash
# Stage your changes
git add .

# Commit with descriptive message
git commit -m "feat: description of your changes"

# Push to your branch
git push origin feature/your-feature-name
```

## 🔧 Configuration

### Environment Setup

The application uses environment-specific configurations:

```bash
# Development (automatic)
NODE_ENV=development

# Production build
NODE_ENV=production
```

### TypeScript Configuration

TypeScript is configured with strict mode enabled. Key files:
- `tsconfig.json` - Main TypeScript configuration
- `src/types/` - Custom type definitions

### Build Configuration

- **Vite**: `vite.config.ts` - Build tool configuration
- **Tailwind**: `tailwind.config.js` - CSS framework configuration
- **PostCSS**: `postcss.config.js` - CSS processing

## 🚨 Troubleshooting

### Common Issues & Solutions

#### Build Errors

```bash
# TypeScript errors
npm run typecheck
# Fix reported type issues

# Dependency issues
npm run fix:deps
# or
npm run install:clean
```

#### Database Issues

```bash
# Check migration status
npm run migrate:status

# Reset database (development only)
rm -f kb-assistant.db
npm run migrate
```

#### Development Server Issues

```bash
# Clear cache and restart
npm run start:clean

# Full reset
rm -rf node_modules package-lock.json
npm install
npm run dev
```

#### Port Already in Use

```bash
# Kill process on port 3000
npx kill-port 3000

# Or use different port
npm run dev -- --port 3001
```

### Performance Issues

```bash
# Check bundle size
npm run build
npm run analyze:bundle

# Run performance tests
npm run test:performance
```

## 🔍 Debugging

### Browser DevTools
- **React DevTools**: Install browser extension
- **Redux DevTools**: If using Redux (currently not used)
- **Network Tab**: Monitor API calls and performance

### VS Code Setup
Recommended extensions:
- ES7+ React/Redux/React-Native snippets
- TypeScript Importer
- Tailwind CSS IntelliSense
- ESLint
- Prettier

### Logging
```typescript
// Use console methods for debugging
console.log('Debug info:', data);
console.warn('Warning:', warning);
console.error('Error:', error);
```

## 📊 Testing Strategy

### Unit Tests
```bash
npm test                    # Run all tests
npm run test:watch         # Watch mode
npm run test:coverage      # With coverage
```

### Integration Tests
```bash
npm run test:integration   # Currently configured to echo
```

### E2E Tests
```bash
npm run test:e2e          # Currently configured to echo
```

## 🚀 Production Deployment

### Build for Production

```bash
# Create production build
npm run build

# Test production build locally
npm run preview

# The build output will be in the `dist/` directory
```

### Production Checklist

- [ ] All tests passing (`npm test`)
- [ ] No TypeScript errors (`npm run typecheck`)
- [ ] No linting errors (`npm run lint`)
- [ ] Production build successful (`npm run build`)
- [ ] All migrations applied (`npm run migrate:status`)

## 📝 Additional Resources

### Documentation
- [Current State Documentation](./CURRENT_STATE.md)
- [API Documentation](./API_DOCUMENTATION.md)
- [Component Library](./DESIGN_SYSTEM.md)

### Learning Resources
- [React 18 Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Vite Guide](https://vitejs.dev/guide/)

## 🆘 Getting Help

### Internal Resources
- Check existing documentation in `docs/` directory
- Review component examples in `src/renderer/components/`
- Examine test files for usage patterns

### External Resources
- React community and documentation
- TypeScript community support
- Tailwind CSS community

---

**Last Updated**: September 20, 2024
**Setup Difficulty**: Beginner Friendly
**Estimated Setup Time**: 10-15 minutes