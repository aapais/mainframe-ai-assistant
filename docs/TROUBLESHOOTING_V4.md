# Troubleshooting Guide v4.0 - Next.js + Electron Stack

## Common Issues & Solutions

### 🚨 Development Issues

#### Issue: Next.js Development Server Won't Start

**Symptoms:**
- `npm run dev` fails to start Next.js
- Port 3000 already in use
- Module resolution errors

**Solutions:**

```bash
# Method 1: Check port availability
lsof -i :3000
kill -9 <PID>  # Kill process using port 3000

# Method 2: Clean Next.js cache
cd app
rm -rf .next node_modules
npm install
npm run dev

# Method 3: Use different port
cd app
npx next dev -p 3001
```

#### Issue: Electron Not Connecting to Next.js

**Symptoms:**
- Electron opens but shows blank screen
- "Cannot connect to localhost:3000" error
- Development mode fails

**Solutions:**

```bash
# Method 1: Check wait-on configuration
wait-on http://localhost:3000 && echo "Next.js is ready"

# Method 2: Start components separately
cd app && npm run dev  # Terminal 1
npm run electron       # Terminal 2 (after Next.js starts)

# Method 3: Check firewall settings
# Ensure localhost:3000 is accessible
curl http://localhost:3000
```

#### Issue: TypeScript Compilation Errors

**Symptoms:**
- TypeScript errors in development
- Type mismatches between Electron and Next.js
- Build failures

**Solutions:**

```bash
# Method 1: Check TypeScript configuration
npm run typecheck
cd app && npm run type-check

# Method 2: Regenerate types
rm -rf node_modules/@types app/node_modules/@types
npm install && cd app && npm install

# Method 3: Clear TypeScript cache
rm -rf .tscache app/.tscache
npx tsc --build --clean
```

### 🏗️ Build Issues

#### Issue: Production Build Failures

**Symptoms:**
- `npm run build` fails
- Next.js export errors
- Electron packaging fails

**Solutions:**

```bash
# Method 1: Clean build environment
npm run clean
npm run install:clean

# Method 2: Build step by step
cd app
npm run build      # Should create .next folder
npm run export     # Should create out folder
cd ..
npm run electron:build

# Method 3: Check build configuration
cat app/next.config.js  # Verify export settings
cat electron-builder.json  # Verify file paths
```

#### Issue: Static Export Problems

**Symptoms:**
- Next.js build succeeds but export fails
- Missing static files
- Image optimization errors

**Solutions:**

```javascript
// app/next.config.js - Ensure correct configuration
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  assetPrefix: process.env.NODE_ENV === 'production' ? './' : '',
}

module.exports = nextConfig
```

#### Issue: Electron Packaging Errors

**Symptoms:**
- Electron-builder fails
- Missing dependencies in packaged app
- Platform-specific build failures

**Solutions:**

```bash
# Method 1: Check file inclusion
cat electron-builder.json
# Ensure app/out/**/* is included

# Method 2: Debug packaging
DEBUG=electron-builder npm run electron:build

# Method 3: Platform-specific fixes
# Windows
npm run package:win

# macOS (requires macOS)
npm run package:mac

# Linux
npm run package:linux
```

### 🗄️ Database Issues

#### Issue: SQLite Database Errors

**Symptoms:**
- Database not found
- Permission errors
- Migration failures

**Solutions:**

```bash
# Method 1: Check database file
ls -la kb-assistant.db
# Should exist and be readable

# Method 2: Check database permissions
chmod 644 kb-assistant.db

# Method 3: Recreate database
rm kb-assistant.db
# Restart app to recreate with default data
```

#### Issue: IPC Communication Failures

**Symptoms:**
- Frontend can't communicate with backend
- "electronAPI is not defined" errors
- IPC timeouts

**Solutions:**

```javascript
// Check preload script is loading
// src/preload/preload.js should expose electronAPI

// Frontend check
if (typeof window !== 'undefined' && window.electronAPI) {
  console.log('Electron API available')
} else {
  console.error('Electron API not available')
}
```

### ⚡ Performance Issues

#### Issue: Slow Application Startup

**Symptoms:**
- Long loading times
- High memory usage
- Slow initial render

**Solutions:**

```bash
# Method 1: Optimize Next.js build
cd app
npm run build -- --debug

# Method 2: Check bundle size
npx @next/bundle-analyzer

# Method 3: Enable performance monitoring
# Add to app/next.config.js
const nextConfig = {
  // ... other config
  experimental: {
    instrumentationHook: true
  }
}
```

#### Issue: Memory Leaks

**Symptoms:**
- Increasing memory usage over time
- Application becoming unresponsive
- System slowdown

**Solutions:**

```javascript
// Add memory monitoring
process.on('warning', (warning) => {
  console.warn(warning.stack)
})

// Check for memory leaks in development
if (process.env.NODE_ENV === 'development') {
  setInterval(() => {
    const used = process.memoryUsage()
    console.log('Memory usage:', used)
  }, 30000)
}
```

### 🔧 Development Environment Issues

#### Issue: Node.js Version Conflicts

**Symptoms:**
- npm install failures
- Version compatibility errors
- Build tool conflicts

**Solutions:**

```bash
# Method 1: Check Node.js version
node --version  # Should be >= 18.0.0
npm --version   # Should be >= 9.0.0

# Method 2: Use Node Version Manager
nvm install 18
nvm use 18

# Method 3: Clear npm cache
npm cache clean --force
```

#### Issue: Dependency Conflicts

**Symptoms:**
- npm install warnings
- Peer dependency issues
- Package version conflicts

**Solutions:**

```bash
# Method 1: Check for conflicts
npm ls --depth=0

# Method 2: Force resolution
npm install --force

# Method 3: Use npm overrides
# Add to package.json
{
  "overrides": {
    "package-name": "version"
  }
}
```

### 🖥️ Platform-Specific Issues

#### Windows Issues

**Issue: Path Length Limitations**
```bash
# Use shorter paths
# Move project closer to drive root
# Use npm dedupe to reduce node_modules depth
npm dedupe
```

**Issue: PowerShell Execution Policy**
```powershell
# Run as administrator
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

#### macOS Issues

**Issue: Gatekeeper Blocking App**
```bash
# Disable Gatekeeper for development
sudo spctl --master-disable

# Or sign the app for distribution
# (requires Apple Developer account)
```

#### Linux Issues

**Issue: Missing Dependencies**
```bash
# Install required libraries
sudo apt-get install libgtk-3-dev libwebkit2gtk-4.0-dev

# For AppImage creation
sudo apt-get install fuse
```

### 🔍 Debugging Techniques

#### Enable Debug Mode

```bash
# Debug Next.js
cd app
DEBUG=* npm run dev

# Debug Electron
DEBUG=electron:* npm run electron:dev

# Debug specific modules
DEBUG=app:* npm run dev
```

#### Log Analysis

```javascript
// Add structured logging
const log = {
  info: (msg, data) => console.log(`[INFO] ${msg}`, data),
  error: (msg, error) => console.error(`[ERROR] ${msg}`, error),
  debug: (msg, data) => console.debug(`[DEBUG] ${msg}`, data)
}

// Use throughout application
log.info('Application starting', { version: '2.0.0' })
```

#### Performance Profiling

```javascript
// Add performance markers
performance.mark('app-start')
// ... application code
performance.mark('app-ready')
performance.measure('app-startup', 'app-start', 'app-ready')

const measurements = performance.getEntriesByType('measure')
console.log('Performance measurements:', measurements)
```

### 🆘 Emergency Recovery

#### Complete Reset

```bash
# Nuclear option - complete reset
rm -rf node_modules app/node_modules
rm -rf .next app/.next app/out
rm -rf dist-packages
rm package-lock.json app/package-lock.json

# Reinstall everything
npm install
cd app && npm install
cd ..

# Rebuild
npm run build
```

#### Backup and Restore

```bash
# Backup important files
cp kb-assistant.db kb-assistant.db.backup
cp -r app/out app/out.backup

# Restore if needed
cp kb-assistant.db.backup kb-assistant.db
cp -r app/out.backup app/out
```

### 📊 Health Checks

#### Application Health Check Script

```bash
#!/bin/bash
# health-check.sh

echo "🔍 Checking application health..."

# Check Node.js version
echo "Node.js version: $(node --version)"

# Check npm version
echo "npm version: $(npm --version)"

# Check TypeScript
echo "TypeScript version: $(npx tsc --version)"

# Check Next.js
cd app
echo "Next.js version: $(npx next --version)"
cd ..

# Check database
if [ -f "kb-assistant.db" ]; then
    echo "✅ Database file exists"
else
    echo "❌ Database file missing"
fi

# Check app build
if [ -d "app/out" ]; then
    echo "✅ Next.js build exists"
else
    echo "❌ Next.js build missing"
fi

echo "Health check complete!"
```

### 📞 Getting Help

#### Log Collection

```bash
# Collect logs for support
mkdir troubleshooting-logs
cp kb-assistant.db troubleshooting-logs/
npm ls > troubleshooting-logs/dependencies.txt
cd app && npm ls > ../troubleshooting-logs/app-dependencies.txt
cd ..
npm run typecheck > troubleshooting-logs/typecheck.log 2>&1
cd app && npm run type-check > ../troubleshooting-logs/app-typecheck.log 2>&1
cd ..
tar -czf troubleshooting-$(date +%Y%m%d).tar.gz troubleshooting-logs/
```

#### Common Questions

**Q: Why am I seeing "Module not found" errors?**
A: Check that dependencies are installed in both root and app directories. Run `npm install` in both locations.

**Q: Why is the Electron app showing a blank screen?**
A: Ensure Next.js dev server is running and accessible. Check that wait-on is waiting for the correct URL.

**Q: Why are my TypeScript types not working?**
A: Verify that @types packages are installed and that tsconfig.json paths are correct for both root and app.

**Q: Why is the production build different from development?**
A: Next.js static export may behave differently. Check next.config.js settings and ensure all features are compatible with static export.

---

**Stack**: Next.js 14 + Electron 33 + TypeScript
**Last Updated**: September 21, 2025

For additional help, check the documentation or create an issue with detailed logs.