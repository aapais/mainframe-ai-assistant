# Document Processor Routing Issue - Root Cause Analysis

## Problem Summary
The Enhanced Server is returning 404 errors for all `/api/documents/*` routes despite logging successful registration of the document processor API routes.

## Root Cause Identified

### Primary Issue: Static File Middleware Order
The critical issue is in `/mnt/c/mainframe-ai-assistant/src/backend/enhanced-server.js` at **line 149**:

```javascript
// Line 112-117: Document processor routes registered FIRST
if (documentProcessorApi) {
  console.log('📋 Registering document processor API routes (early)...');
  app.use('/api/documents', documentProcessorApi);
  console.log('✅ Document processor API routes registered (early)');
}

// Line 149-156: Static file serving registered AFTER
app.use(express.static('.', {
  index: 'index.html',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.set('Cache-Control', 'no-cache');
    }
  }
}));
```

### Why This Causes 404s

1. **Static File Middleware Position**: The `express.static('.')` middleware is placed **after** the API route registration
2. **Directory Lookup**: When a request comes in for `/api/documents/status`, Express first tries the document processor routes
3. **Static Override**: Then Express tries to serve static files from the root directory (`'.'`)
4. **File System Check**: Express looks for `/mnt/c/mainframe-ai-assistant/api/documents/status` as a file/directory
5. **404 from Static**: Since no such file exists, `express.static` returns a 404 response
6. **Route Never Reached**: The properly registered API routes never get a chance to handle the request

### Evidence Supporting This Analysis

1. **Logs Show Routes Registered**: Server logs confirm routes are registered twice:
   - `✅ Document processor API routes registered (early)` (line 116)
   - `✅ Document processor API routes registered` (line 540)

2. **Curl Response Headers**: The 404 response includes:
   ```
   Content-Security-Policy: default-src 'none'
   X-Content-Type-Options: nosniff
   Content-Type: text/html; charset=utf-8
   ```
   These are typical static file middleware headers, not API response headers.

3. **Directory Structure**: No `/api/` directory exists in the project root, confirming static middleware is trying to serve non-existent files.

## Secondary Issues

### Duplicate Route Registration
The document processor routes are registered **twice**:
1. **Early registration** (lines 113-116): Before static middleware
2. **Late registration** (lines 537-540): After database initialization in `initializeServer()`

This creates potential conflicts and confusion.

### CORS Middleware Position
CORS middleware is positioned **after** static file serving (line 159), which may cause issues for API requests that get intercepted by static middleware.

## Recommended Solution

### Fix 1: Reorder Middleware (Critical)
Move the static file middleware to the **END** of middleware chain:

```javascript
// Move from line 149 to after all API routes are registered
// Place this LAST in the middleware chain
app.use(express.static('.', {
  index: 'index.html',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.set('Cache-Control', 'no-cache');
    }
  }
}));
```

### Fix 2: Remove Duplicate Registration
Remove either the early registration (lines 113-116) or late registration (lines 537-540).
Recommend keeping the late registration after database initialization.

### Fix 3: Reorder CORS Middleware
Move CORS middleware before static file serving for proper API handling.

## Code Snippets Showing Problematic Areas

### Current Problematic Order (enhanced-server.js):
```javascript
// Lines 113-117: API routes registered
app.use('/api/documents', documentProcessorApi);

// Lines 149-156: Static middleware BLOCKS subsequent routes
app.use(express.static('.', { ... }));

// Lines 159-168: CORS after static (too late)
app.use((req, res, next) => { ... });

// Lines 537-540: Duplicate route registration (never reached)
app.use('/api/documents', documentProcessorApi);
```

### Working Router Configuration (document-processor-api.js):
The router itself is correctly configured:
```javascript
const router = express.Router();
router.get('/status', (req, res) => { ... });        // Would work
router.get('/supported-formats', (req, res) => { ... }); // Would work
router.post('/preview', upload.single('document'), ...); // Would work
```

## Impact Assessment
- **Severity**: Critical - Complete API unavailability
- **Scope**: All `/api/documents/*` endpoints
- **Working Endpoints**: `/api/health`, `/api/incidents` work because they're registered in the main server file
- **User Impact**: Document processing functionality completely broken

## Testing Validation
After implementing the fix, test with:
```bash
curl http://localhost:3001/api/documents/status
curl http://localhost:3001/api/documents/supported-formats
```

Expected: JSON responses instead of 404 HTML errors.