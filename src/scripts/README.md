# Test Data Generation Scripts

## generateTestData.js

Comprehensive test data generator for MVP1 v8 application database.

### Features

- **Realistic Mainframe Data**: Generates authentic mainframe scenarios including JCL errors, VSAM issues, DB2 problems, COBOL compilation errors, etc.
- **AI Transparency Features**: Creates test data for cost tracking, authorization decisions, and operation logs
- **Performance Optimized**: Uses SQLite transactions for efficient bulk inserts
- **Idempotent**: Safe to run multiple times without duplicating data
- **Configurable**: Customizable data volumes and time ranges
- **Progress Reporting**: Real-time progress indicators and detailed summary reports

### Usage

#### Basic Usage
```bash
# Generate test data with default settings
npm run test:data

# Generate test data and clear existing data first
npm run test:data:clean

# Use node directly
node src/scripts/generateTestData.js

# Clear existing data before generating new data
node src/scripts/generateTestData.js --clear
```

#### Advanced Usage
```bash
# Use custom database path
node src/scripts/generateTestData.js --db=/path/to/custom.db

# Clear data and use custom path
node src/scripts/generateTestData.js --clear --db=/path/to/custom.db

# Show help
node src/scripts/generateTestData.js --help
```

### Generated Data

#### Knowledge Base Entries (75 entries)
- **Categories**: JCL, VSAM, DB2, Batch, Functional, CICS, IMS, Security, Network
- **Realistic Problems**: S0C4 ABENDs, DB2 binding errors, VSAM file status issues
- **Professional Solutions**: Step-by-step resolution procedures with code examples
- **Metadata**: Error codes, COBOL versions, system components, subcategories

#### AI Transparency Data
- **Authorization Log** (80 entries): User decisions on AI operations
- **Cost Tracking** (120 entries): Token usage and costs for AI operations
- **Operation Logs** (250 entries): Comprehensive logging of all system operations
- **Budget Management**: Daily/weekly/monthly budget tracking

#### Usage Analytics
- **Search History** (150 entries): Realistic mainframe search queries
- **Usage Metrics** (500 entries): View, copy, rating, and export actions
- **Dashboard Metrics**: Pre-aggregated daily metrics for the last 30 days

#### Relationships and Tags
- **Entry Relations** (40 relations): Related, duplicate, and prerequisite links
- **Tags**: Category-specific tags for flexible filtering
- **User Preferences**: Customizable settings for multiple users

### Data Characteristics

#### Realistic Mainframe Scenarios
- **JCL Issues**: Job control problems, step failures, condition codes
- **VSAM Problems**: File status errors, catalog issues, cluster management
- **DB2 Errors**: SQL errors, binding problems, locking issues
- **COBOL Issues**: Compilation errors, runtime problems, array handling
- **System Errors**: MVS messages, RACF security, allocation failures

#### Time Distribution
- **Weighted Recent Data**: 70% of data from last 30 days
- **Business Hours**: Peak activity during 9-11 AM and 2-4 PM
- **Weekday Focus**: More activity Monday-Friday

#### Cost Simulation
- **Realistic Pricing**: Based on current AI model costs ($0.001-$0.50 per operation)
- **Budget Scenarios**: Daily ($1-3), Weekly ($5-15), Monthly ($20-50) budgets
- **Authorization Patterns**: Mix of approved, denied, and modified requests

### Database Schema Support

The script supports the complete MVP1 v8 schema including:

#### Core Tables
- `kb_entries` - Knowledge base articles
- `kb_tags` - Flexible tagging system
- `kb_relations` - Entry relationships
- `search_history` - Search analytics
- `usage_metrics` - Usage tracking

#### AI Transparency Tables
- `ai_authorization_log` - User authorization decisions
- `ai_cost_tracking` - AI operation costs and token usage
- `operation_logs` - Comprehensive operation logging
- `ai_cost_budgets` - Budget management
- `ai_authorization_preferences` - User AI preferences

#### Analytics Tables
- `dashboard_metrics` - Pre-aggregated dashboard data
- `user_preferences` - User configuration settings

### Configuration

The script uses a comprehensive configuration object:

```javascript
const CONFIG = {
  volumes: {
    kb_entries: 75,
    search_history: 150,
    usage_metrics: 500,
    ai_authorization_log: 80,
    ai_cost_tracking: 120,
    operation_logs: 250,
    kb_relations: 40,
    tags_per_entry: 4
  },
  costs: {
    min_operation: 0.001,
    max_operation: 0.50,
    avg_daily_budget: 2.50,
    high_cost_threshold: 0.10
  },
  timeRange: {
    days: 90,
    peakHours: [9, 10, 11, 14, 15, 16],
    peakDays: [1, 2, 3, 4, 5]
  }
}
```

### Sample Output

```
🚀 Starting comprehensive test data generation...
📊 Target volumes: { kb_entries: 75, search_history: 150, ... }

✅ Connected to database: /path/to/database/knowledge-base.db
✅ Database schema verified
📚 Generating 75 KB entries...
  ✅ Created 75 KB entries
🏷️  Generating KB tags...
  ✅ Generated tags for all entries
🔗 Generating KB entry relations...
  ✅ Generated 40 KB relations
🔍 Generating 150 search history entries...
  ✅ Generated 150 search history entries
📊 Generating 500 usage metrics...
  ✅ Generated 500 usage metrics
🔐 Generating 80 AI authorization decisions...
  ✅ Generated 80 authorization decisions
💰 Generating 120 AI cost tracking entries...
  ✅ Generated 120 cost tracking entries
📝 Generating 250 operation logs...
  ✅ Generated 250 operation logs
⚙️  Generating user preferences...
  ✅ Generated preferences for 6 users
💰 Generating AI budget data...
  ✅ Generated AI budgets for 4 users
🔐 Generating AI authorization preferences...
  ✅ Generated authorization preferences for 4 users
📊 Generating dashboard metrics...
  ✅ Generated dashboard metrics for 30 days

📊 Test Data Generation Summary
================================
✅ Records created: 2,847
❌ Errors: 0
⏱️  Duration: 2.34s
📁 Database: /path/to/database/knowledge-base.db

📈 Final Record Counts:
  kb_entries: 75
  kb_tags: 248
  kb_relations: 40
  search_history: 150
  usage_metrics: 500
  ai_authorization_log: 80
  ai_cost_tracking: 120
  operation_logs: 250
  user_preferences: 6
  ai_cost_budgets: 12
  dashboard_metrics: 1,366

💰 Cost Summary:
  Operations: 120
  Total cost: $2.4567
  Average cost: $0.020472
  Max cost: $0.0489

🎉 Test data generation completed successfully!

🔍 You can now:
  - Search the knowledge base with realistic queries
  - View AI cost tracking and transparency features
  - Test authorization workflows and budget management
  - Analyze usage patterns and performance metrics
  - Explore the dashboard with pre-populated analytics
```

### Error Handling

The script includes comprehensive error handling:

- **Database Connection**: Validates database connectivity and schema
- **Transaction Safety**: Uses SQLite transactions for data consistency
- **Graceful Degradation**: Continues generation even if individual inserts fail
- **Cleanup**: Proper resource cleanup on exit or interruption
- **Detailed Logging**: Clear error messages and troubleshooting information

### Integration

The generated test data is designed to work seamlessly with:

- **Search Components**: FTS5 full-text search with realistic queries
- **AI Features**: Cost tracking, authorization, and transparency workflows
- **Dashboard**: Pre-aggregated metrics for immediate visualization
- **User Management**: Multiple user scenarios with different preferences
- **Analytics**: Rich usage patterns and performance data

### Development

The script is modular and extensible:

- **Data Pools**: Easily add new mainframe scenarios and error types
- **Configuration**: Adjust volumes and characteristics via CONFIG object
- **Export Support**: Can be imported as a module for custom usage
- **Testing**: Built-in validation and summary reporting