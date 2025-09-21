# Quick Start Guide V2.0
## Accenture Mainframe AI Assistant - Get Up and Running in 15 Minutes

**Version**: 2.0.0
**Date**: September 21, 2024
**Estimated Time**: 15 minutes
**Target Audience**: New developers, QA engineers, stakeholders

---

## 🎯 Overview

This guide will get you up and running with the Accenture Mainframe AI Assistant in just 15 minutes. You'll have a fully functional development environment with the application running locally.

## ⚡ Express Setup (5 minutes)

### Prerequisites Check
```bash
# Verify you have the required tools
node --version    # Should be >=18.0.0
npm --version     # Should be >=9.0.0
git --version     # Should be >=2.30.0
```

If any of these fail, see the [detailed setup guide](./SETUP_GUIDE.md).

### 1. Clone and Install (2 minutes)
```bash
# Clone the repository
git clone <repository-url>
cd mainframe-ai-assistant

# Install dependencies (this may take 1-2 minutes)
npm install
```

### 2. Initialize Database (1 minute)
```bash
# Create and populate the database
npm run migrate

# Verify database was created
ls -la src/database/app.db
```

### 3. Start Development Server (30 seconds)
```bash
# Start the application
npm run dev

# The application will open automatically at http://localhost:3000
```

### 4. Verify Everything Works (1 minute)
- ✅ Application loads without errors
- ✅ You can see the dashboard
- ✅ No console errors in browser DevTools
- ✅ Database operations work (try creating an incident)

🎉 **Congratulations!** You have the application running in development mode.

---

## 🖥️ Desktop Mode (Additional 2 minutes)

### Start Electron Desktop App
```bash
# In a new terminal window
npm run electron:dev

# This will open the application as a native desktop app
```

---

## 🔍 Key Features Tour (5 minutes)

### 1. Dashboard Overview (1 minute)
- **Location**: Default page when app loads
- **What you see**: Metrics, active incidents, quick actions
- **Try**: Click on different metric cards to explore

### 2. Incident Management (2 minutes)
```bash
# Create your first incident
1. Click "Report Incident" button
2. Fill in the form:
   - Title: "Test Database Connection Issue"
   - Description: "Unable to connect to production database"
   - Category: "database"
   - Severity: "high"
   - Priority: 1
3. Click "Create Incident"
4. See it appear in the incidents queue
```

### 3. Unified Search (1 minute)
```bash
# Test the search functionality
1. Use the search bar at the top
2. Search for "database"
3. Notice it finds both incidents and knowledge entries
4. Try different filters (category, severity)
```

### 4. Settings Configuration (1 minute)
```bash
# Explore settings
1. Click the settings icon (gear) in the navigation
2. Browse through different setting categories
3. Try changing the theme (light/dark)
4. Notice settings are automatically saved
```

---

## 📝 Common First Tasks

### Task 1: Create Your First Knowledge Entry
```bash
# Scenario: Document a solution you know
1. Navigate to Knowledge Base section
2. Click "Add Knowledge Entry"
3. Fill in:
   - Title: "How to Restart Apache Service"
   - Description: "Steps to restart Apache web server on Linux"
   - Solution: "sudo systemctl restart apache2"
   - Category: "web-server"
   - Tags: ["apache", "restart", "linux"]
4. Save the entry
5. Test searching for it
```

### Task 2: Resolve an Incident
```bash
# Scenario: Resolve the test incident you created
1. Go to the incident you created earlier
2. Click "Resolve" button
3. Add a solution description
4. Notice how it automatically becomes searchable knowledge
5. Search for the solution to verify it's indexed
```

### Task 3: Configure AI Settings (Optional)
```bash
# If you have AI API keys
1. Go to Settings > AI Configuration
2. Choose your preferred provider (Gemini or OpenAI)
3. Add your API key
4. Test the connection
5. Try AI-powered incident analysis
```

---

## 🛠️ Development Workflow

### Code Changes and Hot Reload
```bash
# Make a simple change to test hot reload
1. Open src/renderer/components/ui/Button.tsx
2. Change button text or styling
3. Save the file
4. Notice the browser automatically refreshes with your changes
```

### Running Tests
```bash
# Run the test suite
npm test

# Run tests in watch mode while developing
npm run test:watch

# Check test coverage
npm run test:coverage
```

### Code Quality Checks
```bash
# TypeScript type checking
npm run typecheck

# Lint code for quality issues
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Format code with Prettier
npm run format
```

### Building for Production
```bash
# Create production build
npm run build

# Preview production build
npm run preview

# Package as desktop app
npm run package:win    # Windows
npm run package:mac    # macOS
npm run package:linux  # Linux
```

---

## 🎓 Learning Path

### Beginner (First Hour)
1. ✅ **Complete this quick start guide** (15 minutes)
2. 📚 **Read the main README.md** (10 minutes)
3. 🎯 **Create 3-5 test incidents and knowledge entries** (15 minutes)
4. 🔍 **Explore all main features** (20 minutes)

### Intermediate (First Day)
1. 📖 **Review the API documentation** (30 minutes)
2. 🏗️ **Understand the unified architecture** (30 minutes)
3. 🧪 **Write a simple test** (30 minutes)
4. 🎨 **Make a small UI change** (30 minutes)

### Advanced (First Week)
1. 📋 **Read the developer migration guide** (1 hour)
2. 🗃️ **Understand the database schema** (1 hour)
3. 🔧 **Implement a new feature** (4-6 hours)
4. 📊 **Add analytics or improve performance** (2-4 hours)

---

## 🐛 Quick Troubleshooting

### Application Won't Start
```bash
# Problem: npm run dev fails
# Solution: Check Node.js version and clean install
node --version  # Must be >=18.0.0
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### Database Errors
```bash
# Problem: Database operations fail
# Solution: Recreate database
rm src/database/app.db
npm run migrate
```

### Port Already in Use
```bash
# Problem: Port 3000 is busy
# Solution: Use different port
npm run dev -- --port 3001
# Or kill the process using port 3000
lsof -ti:3000 | xargs kill -9  # macOS/Linux
```

### Build Errors
```bash
# Problem: TypeScript or build errors
# Solution: Check types and clean cache
npm run typecheck
rm -rf node_modules/.vite
npm run dev
```

### Electron Won't Start
```bash
# Problem: Desktop app won't open
# Solution: Ensure dev server is running first
npm run dev  # In one terminal
npm run electron:dev  # In another terminal
```

---

## 🎯 Next Steps

### Immediate Actions (Today)
- [ ] Complete this quick start guide
- [ ] Create your user account/preferences
- [ ] Import or create real incident data
- [ ] Configure AI settings if available
- [ ] Bookmark important documentation

### Short Term (This Week)
- [ ] Read the [developer migration guide](./DEVELOPER_MIGRATION_GUIDE.md)
- [ ] Understand the [unified architecture](./MIGRATION_MASTER_DOCUMENTATION_V2.md)
- [ ] Set up your development environment fully
- [ ] Join team communications channels
- [ ] Review coding standards and conventions

### Medium Term (This Month)
- [ ] Contribute your first feature or bugfix
- [ ] Write tests for your contributions
- [ ] Help improve documentation
- [ ] Participate in code reviews
- [ ] Share feedback on user experience

---

## 📚 Essential Resources

### Documentation (Bookmark These)
- 🏠 **[Main README](../README.md)**: Project overview and features
- 🏗️ **[Master Documentation](./MIGRATION_MASTER_DOCUMENTATION_V2.md)**: Complete architecture guide
- ⚙️ **[Setup Guide](./SETUP_GUIDE.md)**: Detailed installation instructions
- 🔄 **[Migration Guide](./DEVELOPER_MIGRATION_GUIDE.md)**: Developer transition guide
- 🔧 **[API Documentation](./API_DOCUMENTATION.md)**: Complete API reference
- 🗃️ **[Database Schema](./DATABASE_SCHEMA_DOCUMENTATION.md)**: Database structure and queries

### Quick Reference Commands
```bash
# Essential development commands
npm run dev          # Start development server
npm run electron:dev # Start desktop app
npm test            # Run tests
npm run typecheck   # Check TypeScript
npm run lint        # Check code quality
npm run build       # Production build

# Database commands
npm run migrate             # Run database migrations
npm run migrate:status      # Check migration status
npm run migrate:rollback    # Rollback last migration

# Maintenance commands
npm run install:clean  # Clean install dependencies
npm run fix:deps      # Fix dependency issues
```

### Project Structure Quick Reference
```
src/
├── main/               # Electron main process
├── renderer/          # React application
│   ├── components/    # UI components
│   ├── pages/        # Main pages
│   ├── services/     # Business logic
│   └── hooks/        # Custom React hooks
├── database/         # SQLite schema and migrations
├── types/           # TypeScript definitions
└── styles/          # Global styles
```

---

## 💡 Pro Tips

### Productivity Hacks
```bash
# 1. Use keyboard shortcuts
Ctrl+Shift+T    # New terminal
Ctrl+`          # Toggle terminal
Ctrl+Shift+P    # Command palette in VS Code

# 2. Alias common commands
echo 'alias dev="npm run dev"' >> ~/.bashrc
echo 'alias test="npm test"' >> ~/.bashrc

# 3. Use VS Code extensions
# Install the recommended extensions from .vscode/extensions.json

# 4. Set up git hooks for quality
# Husky is configured to run checks on commit
```

### Debug Mode
```bash
# Enable debug logging
VITE_LOG_LEVEL=debug npm run dev

# Open DevTools in Electron
# Press F12 or Ctrl+Shift+I in the desktop app

# Database debugging
# Use DB Browser for SQLite to inspect data:
sqlitebrowser src/database/app.db
```

### Performance Monitoring
```bash
# Check bundle size
npm run build -- --analyze

# Monitor performance
# Use browser DevTools > Performance tab

# Check memory usage
# Use browser DevTools > Memory tab
```

---

## 🎉 Success Criteria

By the end of this guide, you should be able to:

### Basic Usage ✅
- [ ] Start the application in both web and desktop modes
- [ ] Navigate through all main sections (Dashboard, Incidents, Knowledge, Settings)
- [ ] Create, edit, and resolve incidents
- [ ] Create and search knowledge entries
- [ ] Use the unified search functionality

### Development Ready ✅
- [ ] Make code changes and see them reflected immediately
- [ ] Run tests and understand the results
- [ ] Use TypeScript effectively with proper typing
- [ ] Follow the project's coding standards
- [ ] Understand the database structure

### Next Level Ready ✅
- [ ] Know where to find detailed documentation
- [ ] Understand the overall architecture
- [ ] Ready to contribute features or fixes
- [ ] Can help onboard other team members

---

## 🆘 Getting Help

### Self-Service Resources
1. **Check this guide first** - Most common issues are covered here
2. **Review error messages** - They often contain helpful information
3. **Check browser console** - Look for JavaScript errors
4. **Read the documentation** - Comprehensive guides are available

### Team Support
1. **Ask team members** - Someone may have faced the same issue
2. **Check git history** - Recent commits might explain changes
3. **Review pull requests** - See how others implemented features
4. **Use debugging tools** - Browser DevTools and VS Code debugger

### Common Questions
**Q: Can I use this in production?**
A: This is a development setup. See deployment documentation for production.

**Q: How do I add new features?**
A: Read the developer migration guide and follow the established patterns.

**Q: Can I customize the UI?**
A: Yes, the app uses Tailwind CSS. Modify components in `src/renderer/components/`.

**Q: How do I backup my data?**
A: The database is in `src/database/app.db`. Copy this file to backup.

**Q: Is there a mobile version?**
A: Currently desktop and web only. Mobile support is on the roadmap.

---

## 🚀 Welcome to the Team!

You're now ready to start working with the Accenture Mainframe AI Assistant. The application represents the cutting edge of incident management and knowledge base integration, with a modern React architecture and intelligent automation features.

Remember:
- 🎯 **Start small** - Get comfortable with basic features first
- 📚 **Read documentation** - It will save you time in the long run
- 🤝 **Ask questions** - The team is here to help
- 🔄 **Iterate quickly** - Use hot reload to experiment
- ✅ **Test everything** - Write tests for your contributions

**Happy coding!** 🎉

---

**End of Quick Start Guide**

*For more detailed information, see the [complete documentation index](./MIGRATION_MASTER_DOCUMENTATION_V2.md).*