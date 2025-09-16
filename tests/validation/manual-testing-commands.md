# Manual Testing Commands for Vite + React + Electron Setup

This document provides specific test commands and expected outputs for manual validation of the development environment.

## Prerequisites

Ensure you have the following installed:
- Node.js 18+ (`node --version`)
- npm 9+ (`npm --version`)

## Test Commands with Expected Outputs

### 1. Dependency Validation

#### Test 1.1: Check package.json dependencies
```bash
cd /mnt/c/mainframe-ai-assistant
npm list --depth=0
```

**Expected Output:**
```
accenture-mainframe-ai-assistant@1.0.0
├── react@18.x.x
├── react-dom@18.x.x
├── typescript@5.x.x
├── better-sqlite3@8.x.x
└── [other dependencies...]
```

**❌ Failure Indicators:**
- Missing packages or UNMET DEPENDENCY warnings
- Version conflicts (ERESOLVE errors)

#### Test 1.2: Verify critical packages installation
```bash
ls node_modules/react node_modules/vite node_modules/electron
```

**Expected Output:**
```
node_modules/react:
[package files...]

node_modules/vite:
[package files...]

node_modules/electron:
[package files...]
```

### 2. Vite Dev Server Startup Validation

#### Test 2.1: Start Vite development server
```bash
npm run dev
```

**Expected Output:**
```
> accenture-mainframe-ai-assistant@1.0.0 dev
> vite --config vite.config.basic.ts

  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: use --host to expose
  ➜  press h to show help
```

**❌ Failure Indicators:**
- Port already in use errors
- Configuration file not found
- Module resolution errors
- TypeScript compilation errors

#### Test 2.2: Verify server response
```bash
# In a new terminal while dev server is running
curl -I http://localhost:3000
```

**Expected Output:**
```
HTTP/1.1 200 OK
Content-Type: text/html
...
```

#### Test 2.3: Check for hot reload functionality
1. Start dev server: `npm run dev`
2. Make a small change to `/src/renderer/App.tsx`
3. Save the file

**Expected Output in terminal:**
```
[vite] hmr update /src/renderer/App.tsx
```

### 3. React Application Loading Validation

#### Test 3.1: Verify React entry point
```bash
# Check if React entry point exists
ls -la src/renderer/index.tsx
cat src/renderer/index.tsx | head -10
```

**Expected Output:**
```
-rw-r--r-- 1 user user 3xxx src/renderer/index.tsx

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './mockElectronAPI';
...
```

#### Test 3.2: Check index.html configuration
```bash
grep -n "root\|module\|script" index.html
```

**Expected Output:**
```
84:    <div id="root">
124:    <script type="module" src="/src/renderer/index.tsx"></script>
```

### 4. Browser Console Error Detection

#### Test 4.1: Open browser and check console
1. Start dev server: `npm run dev`
2. Open http://localhost:3000 in browser
3. Open Developer Tools (F12)
4. Check Console tab

**Expected Results:**
- ✅ No red error messages about missing modules
- ✅ May show warning: "Electron API not found. Using mock API for web development."
- ✅ Application loads and displays content

**❌ Failure Indicators:**
- Module not found errors
- Import/export syntax errors
- TypeScript compilation errors
- Network request failures for assets

#### Test 4.2: Check Network tab
1. In browser Developer Tools, go to Network tab
2. Reload page (Ctrl+R)
3. Check for failed requests

**Expected Results:**
- ✅ All requests return 200 status
- ✅ index.html loads successfully
- ✅ JavaScript modules load without 404 errors

### 5. UI Features Validation

#### Test 5.1: Visual inspection
Visit http://localhost:3000 and verify:

**Expected Visual Elements:**
- ✅ Accenture purple gradient background
- ✅ Main heading: "🚀 Accenture Mainframe AI Assistant"
- ✅ Subtitle: "Enterprise Knowledge Management & AI-Powered Search"
- ✅ Status indicator: "✅ Application is running successfully!"
- ✅ 6 feature cards: Knowledge Base, Smart Search, Analytics, Performance, Themes, Accessibility
- ✅ Hover effects on feature cards

#### Test 5.2: Responsive design test
```bash
# Use browser dev tools or test with different window sizes
# Mobile: 375x667
# Tablet: 768x1024
# Desktop: 1920x1080
```

**Expected Results:**
- ✅ Layout adapts to different screen sizes
- ✅ Content remains readable and accessible
- ✅ No horizontal scrollbars on mobile

### 6. Mock Electron API Validation

#### Test 6.1: Check mock API in browser console
1. Open http://localhost:3000
2. Open browser console (F12)
3. Type: `window.electronAPI`

**Expected Output:**
```javascript
{logError: ƒ, onThemeChange: ƒ, onDatabaseStatus: ƒ, ...}
```

#### Test 6.2: Test mock API functions
In browser console, test:
```javascript
// Should not throw errors
window.electronAPI.logError({test: true});
typeof window.electronAPI.onThemeChange === 'function';
```

**Expected Results:**
- ✅ No errors thrown
- ✅ Functions return expected types

### 7. Performance Validation

#### Test 7.1: Page load performance
1. Open browser Developer Tools
2. Go to Network tab
3. Reload page with cache disabled (Ctrl+Shift+R)
4. Check timing

**Expected Performance Targets:**
- ✅ Initial page load: < 2 seconds
- ✅ DOM ready: < 1 second
- ✅ First contentful paint: < 1.5 seconds

#### Test 7.2: Bundle size check
```bash
npm run build
ls -lh dist/
```

**Expected Results:**
- ✅ Build completes without errors
- ✅ Generated files are reasonable size (< 5MB total)

### 8. TypeScript Validation

#### Test 8.1: Type checking
```bash
npm run typecheck
```

**Expected Output:**
```
> tsc --noEmit
# No output means no type errors
```

**❌ Failure Indicators:**
- TypeScript compilation errors
- Type mismatch warnings
- Missing type declarations

#### Test 8.2: Build validation
```bash
npm run build
```

**Expected Output:**
```
> npm run build:main && npm run build:renderer
...
Build completed successfully
```

## Automated Test Execution

### Run comprehensive validation
```bash
node tests/validation/comprehensive-test-plan.js
```

### Run browser tests
```bash
npx playwright test tests/validation/browser-validation.spec.ts --headed
```

### Quick validation sequence
```bash
# 1. Install dependencies
npm install

# 2. Type check
npm run typecheck

# 3. Start dev server (in background)
npm run dev &

# 4. Wait for server startup
sleep 10

# 5. Test server response
curl -f http://localhost:3000

# 6. Run automated tests
node tests/validation/comprehensive-test-plan.js

# 7. Clean up
pkill -f "vite"
```

## Troubleshooting Common Issues

### Issue: Port 3000 already in use
```bash
# Find and kill process using port 3000
lsof -ti:3000 | xargs kill -9
# Or use different port
npm run dev -- --port 3001
```

### Issue: Module not found errors
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Issue: TypeScript errors
```bash
# Check TypeScript configuration
npx tsc --showConfig
# Rebuild types
npm run typecheck
```

### Issue: Vite build failures
```bash
# Clear Vite cache
rm -rf node_modules/.vite
npm run dev
```

### Issue: Browser shows blank page
1. Check browser console for JavaScript errors
2. Verify React entry point exists: `src/renderer/index.tsx`
3. Check index.html has correct script tag
4. Ensure dev server is running and accessible

## Success Criteria Summary

✅ **All tests pass when:**
1. Dependencies install without conflicts
2. Vite dev server starts on port 3000
3. React application loads in browser
4. No critical console errors
5. UI elements display correctly
6. Mock Electron API functions work
7. Performance meets basic thresholds
8. TypeScript compiles without errors

✅ **Ready for development when:**
- All manual tests pass
- Automated test suite returns success
- Hot reload works for component changes
- Browser and server logs are clean