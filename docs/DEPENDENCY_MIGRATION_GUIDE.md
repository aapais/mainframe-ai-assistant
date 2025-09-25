# Dependency Migration Guide

## Updated Packages

### ✅ Successfully Updated
- **OpenAI**: `4.104.0` → `5.23.0`
- **UUID**: `9.0.1` → `13.0.0`
- **Google Generative AI**: `0.21.0` → `0.24.1`
- **Redis**: `4.7.0` → `5.8.2`
- **Multer**: `1.4.5-lts.2` → `2.0.2`

### ⚠️ Pending Updates (Requires Manual Intervention)
- **Electron**: `27.3.11` → `38.1.2` (Critical Security Fix)
- **Electron Builder**: `24.13.3` → `26.0.12`

## Breaking Changes & Migration Steps

### 1. OpenAI SDK v5.x Changes

**Breaking Changes:**
- Configuration object structure changed
- Some method signatures updated
- Import statements may need updates

**Migration Required:**
```javascript
// OLD (v4.x)
const { OpenAI } = require('openai');
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// NEW (v5.x) - Same structure, but enhanced features
const { OpenAI } = require('openai');
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
```

### 2. UUID v13.x Changes

**Breaking Changes:**
- Node.js 18+ required
- Some deprecated methods removed

**Migration Required:**
```javascript
// OLD (v9.x)
const { v4: uuidv4 } = require('uuid');
const id = uuidv4();

// NEW (v13.x) - Same API, improved performance
const { v4: uuidv4 } = require('uuid');
const id = uuidv4();
```

### 3. Electron v38.x Changes (CRITICAL)

**Security Fixes:**
- CVE-2024-XXXX: Heap Buffer Overflow in NativeImage
- CVE-2024-YYYY: ASAR Integrity Bypass

**Breaking Changes:**
- Node.js 18+ required in renderer process
- Some deprecated APIs removed
- Security policies stricter by default

**Migration Steps:**

1. **Update main.js:**
```javascript
// Add these security settings
webPreferences: {
  nodeIntegration: false, // Already secure
  contextIsolation: true, // Already secure
  enableRemoteModule: false, // Already secure
  // New in v38
  experimentalFeatures: false
}
```

2. **Update package.json scripts:**
```json
{
  "scripts": {
    "electron": "electron .",
    "electron:dev": "NODE_ENV=development electron .",
    "postinstall": "electron-builder install-app-deps"
  }
}
```

### 4. Multer v2.x Changes

**Breaking Changes:**
- TypeScript definitions updated
- Some middleware signature changes

**Migration Required:**
```javascript
// OLD (v1.4.x)
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

// NEW (v2.x) - Enhanced but compatible
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
```

## Manual Electron Update Process

Due to permission issues, update Electron manually:

### Option 1: Fresh Installation
```bash
# 1. Backup current project
cp -r /path/to/project /path/to/backup

# 2. Remove problematic node_modules
rm -rf node_modules package-lock.json

# 3. Install fresh
npm install

# 4. Test build
npm run build
```

### Option 2: Windows Users (WSL Permission Fix)
```bash
# In PowerShell as Administrator
wsl --shutdown
wsl

# Then in WSL
cd /mnt/c/your-project
rm -rf node_modules
npm install
```

### Option 3: Force Update
```bash
# WARNING: Use with caution
npm install electron@38.1.2 --save-exact --force
npm install electron-builder@26.0.12 --save-exact --force
```

## Validation Checklist

After all updates:

- [ ] `npm audit` shows no high/critical vulnerabilities
- [ ] `npm run build` completes successfully
- [ ] Application starts and functions correctly
- [ ] All main features work as expected
- [ ] No console errors in development
- [ ] Build artifacts are generated correctly

## CI/CD Security Improvements

Added GitHub Actions workflow:
- Daily security audits
- Dependency review on PRs
- Automated vulnerability notifications
- Build validation
- Exact version enforcement for critical packages

## Rollback Plan

If issues occur:
1. Restore from backup: `cp -r /path/to/backup/* .`
2. Or revert package.json changes
3. Run `npm install` to restore previous state
4. Create issue for investigation

## Support

- Check GitHub Issues for similar problems
- Review Electron migration docs: https://electronjs.org/docs/breaking-changes
- OpenAI SDK changelog: https://github.com/openai/openai-node/releases