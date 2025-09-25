# 🚀 Mainframe AI Assistant - Servers Architecture

## Active Servers

### 1. Static Files Server (Port 8080)
```bash
python3 -m http.server 8080
# or
npm start
```
- **Purpose**: Serves HTML, CSS, JS files
- **URL**: http://localhost:8080
- **Files**: index.html, app-login.html, assets/

### 2. PostgreSQL API Server (Port 3001)
```bash
node src/backend/postgresql-only-server.js
# or
npm run start:postgres
```
- **Purpose**: Main API with PostgreSQL database
- **URL**: http://localhost:3001
- **Health**: http://localhost:3001/api/health
- **Features**: Incidents, Knowledge Base, Document Processing

### 3. Windows Authentication Server (Port 3004)
```bash
node windows-auth-postgres.js
# or
npm run start:auth
```
- **Purpose**: Windows user authentication & JWT tokens
- **URL**: http://localhost:3004
- **Health**: http://localhost:3004/api/health

## Quick Start
```bash
# Start all servers in parallel
npm run start &
npm run start:postgres &
npm run start:auth &

# Access application
open http://localhost:8080
```

## Removed Servers (Cleaned Up)
- ❌ `server.js` - Old SQLite server
- ❌ `src/api/server.js` - Obsolete API server
- ❌ `src/api/incident-ai-server.js` - Unused AI server
- ❌ `src/backend/enhanced-server.js` - Duplicate server
- ❌ `src/backend/windows-auth-server.js` - Old auth server
- ❌ All lighthouse servers
- ❌ Build/integration scripts

## Dependencies Cleaned
- Removed: axios, express-rate-limit, express-validator, google-auth-library, node-cron, redis, winston, zod
- Kept: Essential deps for PostgreSQL, authentication, document processing

## Project Structure
```
mainframe-ai-assistant/
├── index.html                           # Dashboard
├── app-login.html                       # Login page
├── windows-auth-postgres.js             # Auth server
├── src/backend/postgresql-only-server.js # Main API server
├── package.json                         # Cleaned dependencies
└── SERVERS.md                          # This file
```