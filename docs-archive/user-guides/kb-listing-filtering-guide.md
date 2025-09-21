# Knowledge Base Listing & Filtering Interface - User Guide

## Table of Contents

1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [Advanced Search & Filtering](#advanced-search--filtering)
4. [View Options](#view-options)
5. [Batch Operations](#batch-operations)
6. [Keyboard Shortcuts](#keyboard-shortcuts)
7. [Export & Import Features](#export--import-features)
8. [Performance Tips](#performance-tips)
9. [Troubleshooting](#troubleshooting)

---

## Overview

The Knowledge Base Listing & Filtering Interface is a powerful tool for managing and searching through large collections of mainframe knowledge entries. It supports virtual scrolling for datasets of 10,000+ entries, real-time search, advanced filtering, and batch operations.

### Key Features

- ⚡ **Virtual Scrolling**: Handle massive datasets (10,000+ entries) with smooth performance
- 🔍 **Real-time Search**: Instant search results as you type
- 🏷️ **Advanced Filtering**: Filter by category, tags, severity, and more
- 📋 **Batch Operations**: Edit, delete, export, or duplicate multiple entries
- ⌨️ **Keyboard Navigation**: Full keyboard accessibility with shortcuts
- 📊 **Multiple View Modes**: List, grid, and compact views
- 🔄 **Inline Editing**: Edit entries directly in the list
- 📈 **Usage Metrics**: See which entries are most successful

---

## Getting Started

### Basic Interface Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ [🧠] Mainframe Knowledge Assistant            [📊 Metrics] [+ Add]  │
├─────────────────────────────────────────────────────────────────────┤
│ Search: [________________] Quick filters: [JCL] [VSAM] [DB2] [...]   │
├─────────────────────────────────────────────────────────────────────┤
│ ☐ Entry Title - VSAM Status 35                      [✏️][📋][⋯]    │
│   📂 VSAM  ⭐ 95%  👁 45  ✓ 87%  📅 Mar 15          |              │
│   Problem: Job abends with VSAM status code 35...   |              │
│   Tags: [vsam] [status-35] [file-not-found]         |              │
├─────────────────────────────────────────────────────┤              │
│ ☐ Another Entry Title...                            |   Preview    │
│   📂 JCL   ⭐ 92%  👁 32  ✓ 78%  📅 Mar 10           |   Panel      │
│   Problem: JCL fails with IEF212I dataset...        |              │
└─────────────────────────────────────────────────────┴──────────────┘
```

### Quick Start

1. **View all entries**: The interface loads with popular entries by default
2. **Search**: Type in the search box for real-time filtering
3. **Filter quickly**: Click category chips (JCL, VSAM, DB2, etc.) for quick filtering
4. **Select entries**: Click checkboxes or use Space key to select multiple entries
5. **Take actions**: Use the action buttons (✏️ Edit, 📋 Copy, ⋯ More) on individual entries

---

## Advanced Search & Filtering

### Search Types

#### Text Search
- **Basic**: Type any text to search across titles, problems, and solutions
- **Phrase**: Use quotes for exact phrases: `"VSAM status 35"`
- **Partial**: Search works with partial words and common abbreviations

#### Structured Search
- **Category search**: `category:VSAM` or `category:JCL`
- **Tag search**: `tag:s0c7` or `tag:file-error`
- **Combined**: `category:VSAM tag:status-35`

#### Search Examples

| Search Query | Description | Results |
|--------------|-------------|---------|
| `S0C7` | Find entries about S0C7 abends | All S0C7 related problems |
| `category:VSAM` | All VSAM-related entries | VSAM category entries only |
| `tag:urgent` | Entries tagged as urgent | High-priority issues |
| `"file not found"` | Exact phrase search | Entries with exact phrase |
| `VSAM status` | Multiple terms | Entries matching both terms |

### Advanced Filters

#### Filter Panel
Access via the filter button (🔧) or use the search syntax:

- **Categories**: JCL, VSAM, DB2, Batch, Functional, CICS, IMS
- **Severity**: Critical, High, Medium, Low
- **Success Rate**: Filter by effectiveness (>80%, 60-80%, <60%)
- **Usage**: Popular (>50 uses), Moderate (10-50), New (<10)
- **Date Range**: Last week, month, quarter, year

#### Sorting Options

| Sort By | Description | When to Use |
|---------|-------------|-------------|
| **Relevance** | Best match for search query | Default for searches |
| **Usage Count** | Most frequently accessed | Find popular solutions |
| **Success Rate** | Most effective solutions | Find reliable fixes |
| **Created Date** | Newest entries first | See recent additions |
| **Updated Date** | Recently modified | Find fresh updates |
| **Title** | Alphabetical order | Browse systematically |

---

## View Options

### View Modes

#### List View (Default)
```
☐ [📂 VSAM] Entry Title                    [⭐ 95%] [👁 45] [✓ 87%]
  Problem preview text appears here...
  Tags: [tag1] [tag2] [tag3]
```
- **Best for**: Detailed scanning and reading
- **Shows**: Full metadata, problem preview, all tags
- **Performance**: ~120px per entry

#### Grid View
```
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ Entry Title     │ │ Another Entry   │ │ Third Entry     │
│ 📂 VSAM ⭐ 95%  │ │ 📂 JCL  ⭐ 92%  │ │ 📂 DB2  ⭐ 89%  │
│ Tags: [vsam]    │ │ Tags: [jcl]     │ │ Tags: [db2]     │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```
- **Best for**: Visual browsing and comparison
- **Shows**: Essential metadata, limited tags
- **Performance**: ~150px per entry, 3 columns

#### Compact View
```
☐ Entry Title                      📂 VSAM  ⭐ 95%  👁 45
☐ Another Entry Title              📂 JCL   ⭐ 92%  👁 32
☐ Third Entry Title                📂 DB2   ⭐ 89%  👁 28
```
- **Best for**: Maximum entries on screen, scanning titles
- **Shows**: Title and key metrics only
- **Performance**: ~60px per entry, 2x more entries visible

### Display Options

#### Metadata Indicators
- **📂 Category**: Color-coded category badges
- **⭐ Relevance**: Relevance score for search results (0-100%)
- **👁 Usage**: Number of times entry was viewed
- **✓ Success**: Success rate based on user feedback (0-100%)
- **📅 Date**: Creation or last update date

#### Toggle Options
- **Preview Panel**: Show/hide detailed preview on the right
- **Metrics Display**: Show/hide usage statistics
- **Entry Numbers**: Show/hide entry position numbers
- **Highlight Matches**: Highlight search terms in results

---

## Batch Operations

### Selection Methods

#### Individual Selection
- **Mouse**: Click checkbox next to each entry
- **Keyboard**: Navigate with ↑↓ arrows, press Space to toggle

#### Bulk Selection
- **Select All**: Select all visible entries (current filter)
- **Select None**: Deselect all entries
- **Invert Selection**: Reverse current selection
- **Range Selection**: Shift+Click to select ranges

### Available Operations

#### Edit Operations
```
Selected: 5 entries    [✏️ Edit] [📋 Duplicate] [📤 Export] [🗑️ Delete]
```

| Operation | Description | Requirements | Impact |
|-----------|-------------|--------------|--------|
| **Batch Edit** | Edit common fields across entries | Edit permissions | Updates multiple entries |
| **Duplicate** | Create copies of selected entries | Add permissions | Creates new entries |
| **Export** | Download selected entries | None | Generates file |
| **Delete** | Archive selected entries | Delete permissions | Soft delete (recoverable) |

#### Export Options
- **JSON Format**: Complete data export for backups
- **CSV Format**: Spreadsheet-compatible format
- **Template Format**: For creating new entries based on selected ones

### Batch Edit Modal

When editing multiple entries, you'll see:

```
┌─────────────── Batch Edit: 5 entries ───────────────┐
│                                                      │
│ Category:  [VSAM      ▼] (Apply to all)  ☐         │
│ Severity:  [High      ▼] (Apply to all)  ☐         │
│ Tags:      [Add: emergency, update]       ☐         │
│            [Remove: old, deprecated]      ☐         │
│                                                      │
│ ⚠️  Changes will affect 5 entries                    │
│                                                      │
│                    [Cancel] [Apply Changes]          │
└──────────────────────────────────────────────────────┘
```

**Best Practices:**
- Review changes carefully before applying
- Use tags to group related changes
- Test with a small selection first
- Keep backups before major batch operations

---

## Keyboard Shortcuts

### Navigation Shortcuts

| Key Combination | Action | Context |
|----------------|--------|---------|
| `↑` `↓` | Navigate entries | Entry list |
| `Page Up` `Page Down` | Jump by page | Entry list |
| `Home` `End` | First/last entry | Entry list |
| `Tab` `Shift+Tab` | Navigate interface elements | Global |

### Action Shortcuts

| Key Combination | Action | Context |
|----------------|--------|---------|
| `Space` | Toggle entry selection | Focused entry |
| `Enter` | Open/view entry details | Focused entry |
| `Ctrl+Enter` | Quick view in preview panel | Focused entry |
| `Ctrl+E` | Edit entry | Focused entry |
| `Ctrl+D` | Duplicate entry | Focused entry |
| `Delete` | Delete entry (with confirmation) | Focused entry |

### Search & Filter Shortcuts

| Key Combination | Action | Context |
|----------------|--------|---------|
| `Ctrl+F` | Focus search box | Global |
| `Ctrl+K` | Advanced search modal | Global |
| `Esc` | Clear search/close modals | Global |
| `Ctrl+Shift+F` | Filter panel toggle | Global |

### Batch Operation Shortcuts

| Key Combination | Action | Context |
|----------------|--------|---------|
| `Ctrl+A` | Select all visible entries | Entry list |
| `Ctrl+Shift+A` | Select none | Entry list |
| `Ctrl+I` | Invert selection | Entry list |
| `Ctrl+E` | Batch edit selected | With selections |
| `Ctrl+Shift+E` | Export selected | With selections |

### Editing Shortcuts (Inline Edit Mode)

| Key Combination | Action | Context |
|----------------|--------|---------|
| `Ctrl+Enter` | Save changes | Editing |
| `Esc` | Cancel editing | Editing |
| `Tab` | Next field | Editing |
| `Shift+Tab` | Previous field | Editing |

---

## Export & Import Features

### Export Options

#### Single Entry Export
Right-click any entry and select:
- **Copy as JSON**: Copy to clipboard in JSON format
- **Copy as Text**: Copy formatted text for documentation
- **Export to File**: Save as individual JSON file

#### Bulk Export
Select multiple entries and use the export button:

```
┌─────────────── Export 15 entries ───────────────┐
│                                                  │
│ Format:     ○ JSON  ●  CSV  ○ Template          │
│                                                  │
│ Fields:     ☑ Title      ☑ Problem              │
│             ☑ Solution   ☑ Category             │
│             ☑ Tags       ☑ Metadata             │
│             ☑ Usage Stats ☐ Full History        │
│                                                  │
│ File name:  [kb-export-2024-03-15.csv]         │
│                                                  │
│                     [Cancel] [Export]           │
└──────────────────────────────────────────────────┘
```

#### Export Formats

**JSON Format:**
```json
{
  "version": "1.0",
  "exported": "2024-03-15T10:30:00Z",
  "entries": [
    {
      "id": "uuid-1234",
      "title": "VSAM Status 35 - File Not Found",
      "problem": "Job abends with VSAM status code 35...",
      "solution": "1. Verify dataset exists...",
      "category": "VSAM",
      "tags": ["vsam", "status-35"],
      "usage_count": 45,
      "success_rate": 0.87
    }
  ]
}
```

**CSV Format:**
```csv
ID,Title,Problem,Solution,Category,Tags,Usage Count,Success Rate
uuid-1234,"VSAM Status 35","Job abends...","1. Verify dataset...","VSAM","vsam,status-35",45,0.87
```

### Import Features

#### Supported Import Formats
- **JSON**: Full data import with metadata
- **CSV**: Structured data import
- **Legacy KB**: Migration from old knowledge bases

#### Import Process

1. **Select Import**: Click "Import" button in toolbar
2. **Choose Format**: Select file format and upload file
3. **Map Fields**: Review and map columns to KB fields
4. **Preview**: Review entries before import
5. **Import Options**: Choose merge or replace strategy
6. **Execute**: Import entries with progress tracking

```
┌─────────────── Import Knowledge Base ───────────────┐
│                                                      │
│ File: [kb-backup.json]              [Choose File]   │
│                                                      │
│ Import Strategy:                                     │
│   ● Merge (add new, update existing)                │
│   ○ Replace (clear existing, add all)               │
│   ○ Append (add all as new entries)                 │
│                                                      │
│ Conflict Resolution:                                 │
│   ● Skip duplicates                                  │
│   ○ Update duplicates                               │
│   ○ Create versions                                  │
│                                                      │
│ Preview: 150 entries ready to import                │
│                                                      │
│                     [Cancel] [Import]               │
└──────────────────────────────────────────────────────┘
```

---

## Performance Tips

### For Large Datasets (1000+ entries)

#### Optimal Search Strategies
1. **Use specific terms**: Avoid single-character searches
2. **Filter first**: Use categories/tags to narrow results before text search
3. **Search incrementally**: Let auto-complete guide your search
4. **Use exact matches**: Quotes for exact phrases improve performance

#### View Optimization
1. **Compact view**: Use for browsing large result sets
2. **Disable preview**: Turn off preview panel for faster scrolling
3. **Limit results**: Use filters to show only relevant entries
4. **Page through results**: Don't scroll through thousands of entries

### Browser Performance

#### Memory Usage
- **Close unused tabs**: Keep only necessary browser tabs open
- **Refresh occasionally**: Reload page if sluggish after extended use
- **Use recent browsers**: Modern browsers handle virtual scrolling better

#### Network Optimization
- **Fast connection**: Ensure stable internet for real-time search
- **Local caching**: Browser caches search results for better performance
- **Minimal filters**: Too many simultaneous filters can slow search

### Troubleshooting Performance

#### Slow Search (>2 seconds)
1. Check your search terms - avoid wildcards
2. Clear browser cache and cookies
3. Try category/tag filters instead of text search
4. Contact admin if database needs optimization

#### Memory Warnings
1. Close other applications
2. Use compact view mode
3. Clear browser cache
4. Restart browser

---

## Troubleshooting

### Common Issues

#### No Search Results
**Problem**: Search returns no entries despite knowing entries exist
**Solutions**:
1. Check spelling and try simpler terms
2. Clear any active filters (category, tags, etc.)
3. Try searching in different fields (title vs problem)
4. Use partial words instead of complete phrases
5. Check if entries might be archived

#### Slow Performance
**Problem**: Interface is sluggish or unresponsive
**Solutions**:
1. Switch to compact view mode
2. Reduce the number of selected entries
3. Clear browser cache (Ctrl+Shift+R)
4. Close other browser tabs
5. Try a different browser

#### Selection Not Working
**Problem**: Cannot select entries with checkboxes
**Solutions**:
1. Ensure you have appropriate permissions
2. Try using keyboard selection (Space key)
3. Refresh the page
4. Check if entries are locked by another user

#### Export Fails
**Problem**: Export operation doesn't complete
**Solutions**:
1. Reduce the number of selected entries
2. Try a different export format (CSV instead of JSON)
3. Check browser's download settings
4. Ensure sufficient disk space
5. Try exporting smaller batches

### Getting Help

#### Error Messages
The interface provides helpful error messages:
- **Red notifications**: Critical errors requiring action
- **Yellow notifications**: Warnings you should review
- **Blue notifications**: Informational messages
- **Green notifications**: Successful operations

#### Contact Information
- **Technical Issues**: Contact your system administrator
- **Feature Requests**: Submit via the feedback form (Help menu)
- **Training**: Check the Help menu for video tutorials
- **Documentation**: Access latest docs via Help → Documentation

#### Keyboard Shortcut Reference
Press `F1` or `Ctrl+?` to show the complete keyboard shortcut reference panel.

---

## Advanced Features

### Auto-Complete Search
The search box provides intelligent suggestions:
- **Recent searches**: Your previous search terms
- **Popular terms**: Commonly searched phrases
- **Entry titles**: Matching knowledge base entry titles
- **Categories**: `category:` prefix suggestions
- **Tags**: `tag:` prefix suggestions

### Search History
Access your recent searches:
1. Click the clock icon (🕒) next to the search box
2. Select from your last 10 searches
3. Clear history if needed

### Saved Filters
Create and save frequently used filter combinations:
1. Apply desired filters
2. Click "Save Filter" button
3. Name your filter set
4. Access via "Saved Filters" dropdown

### Real-time Updates
The interface automatically updates when:
- New entries are added by other users
- Entries are modified
- Usage statistics change
- Search indexes are updated

This ensures you always see the latest information without manual refresh.