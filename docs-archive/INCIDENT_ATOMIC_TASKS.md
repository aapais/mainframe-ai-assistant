# Incident Management Implementation - Atomic Task Breakdown

## Executive Summary

Based on analysis of the existing codebase, **80% of the incident management infrastructure is already built**. The mainframe AI assistant has a complete knowledge base system that can be semantically reframed to function as an incident management system with minimal changes.

## Current Architecture Analysis

### ✅ Already Built (80%)
- **KBEntry interface** with all necessary incident fields (id, title, problem, solution, category, tags, usage tracking)
- **Complete database schema** with search, analytics, and audit capabilities
- **Search interface** with local and AI-powered search
- **CRUD operations** with forms, modals, and validation
- **Navigation system** ready for new tabs
- **Component library** with buttons, inputs, modals, and data display
- **Performance optimizations** with FTS search and indexing

### 🔄 Needs Adaptation (15%)
- Navigation labels and terminology
- Form field labels and placeholders
- Search interface terminology
- Component text content

### 🆕 New Development (5%)
- Incident-specific workflow fields
- Queue/status management UI
- Analytics dashboard enhancements

---

# PHASE 1: SEMANTIC REFRAMING (2-3 Days)
*Quick wins through terminology updates and navigation additions*

## Task 1.1: Update Navigation Labels
**Effort: 1 hour**
**Files: 1**
**Dependencies: None**

### File Changes:
#### `/src/renderer/App.tsx` (Lines 245-272)
```typescript
// BEFORE (Lines 253-262):
<button
  onClick={() => setCurrentView('search')}
  className={`px-4 py-2 rounded-lg transition-colors ${
    currentView === 'search' ? 'bg-white/20' : 'hover:bg-white/10'
  }`}
>
  Search
</button>

// AFTER:
<button
  onClick={() => setCurrentView('search')}
  className={`px-4 py-2 rounded-lg transition-colors ${
    currentView === 'search' ? 'bg-white/20' : 'hover:bg-white/10'
  }`}
>
  Knowledge Base
</button>

// ADD NEW BUTTON AFTER LINE 262:
<button
  onClick={() => setCurrentView('incidents')}
  className={`px-4 py-2 rounded-lg transition-colors ${
    currentView === 'incidents' ? 'bg-white/20' : 'hover:bg-white/10'
  }`}
>
  Incidents
</button>
```

#### Update state type (Line 109):
```typescript
// BEFORE:
const [currentView, setCurrentView] = useState<'dashboard' | 'search' | 'ai-transparency'>('dashboard');

// AFTER:
const [currentView, setCurrentView] = useState<'dashboard' | 'search' | 'incidents' | 'ai-transparency'>('dashboard');
```

**Validation**: Navigate between Knowledge Base and Incidents tabs

## Task 1.2: Create Incidents View Component
**Effort: 2 hours**
**Files: 1 new**
**Dependencies: Task 1.1**

### New File: `/src/renderer/views/Incidents.tsx`
```typescript
import React, { useState, useCallback, useEffect } from 'react';
import { AlertTriangle, Search as SearchIcon, Database, Brain, Clock } from 'lucide-react';
import LocalSearchTab from '../components/search/LocalSearchTab';
import AISearchTab from '../components/search/AISearchTab';
import { searchService } from '../services/searchService';

// Reuse existing SearchResult interface but with incident terminology
export interface IncidentResult {
  id: string;
  title: string;
  content: string;
  type: 'incident' | 'alert' | 'issue' | 'outage' | 'maintenance' | 'resolved';
  status?: 'open' | 'investigating' | 'in-progress' | 'resolved' | 'closed';
  priority?: 'critical' | 'high' | 'medium' | 'low';
  path?: string;
  lastModified?: Date;
  relevanceScore?: number;
  highlights?: string[];
}

const Incidents: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'queue' | 'search'>('queue');
  const [searchQuery, setSearchQuery] = useState('');
  const [queueResults, setQueueResults] = useState<IncidentResult[]>([]);
  const [searchResults, setSearchResults] = useState<IncidentResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Transform KBEntry results to IncidentResult format
  const transformToIncidents = (kbResults: any[]): IncidentResult[] => {
    return kbResults.map(entry => ({
      id: entry.id,
      title: entry.title,
      content: `${entry.problem}\n\n${entry.solution}`,
      type: 'incident',
      status: entry.usage_count > 0 ? 'resolved' : 'open',
      priority: entry.category === 'Critical' ? 'critical' : 'medium',
      lastModified: new Date(entry.updated_at),
      relevanceScore: entry.score || 1.0,
      highlights: entry.highlights || []
    }));
  };

  // Reuse existing search functionality
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchService.searchLocal(query);
      setSearchResults(transformToIncidents(results));
    } catch (error) {
      console.error('Incident search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Load incident queue (reuse KB entries with incident terminology)
  const loadIncidentQueue = useCallback(async () => {
    try {
      const results = await searchService.searchLocal(''); // Get all entries
      setQueueResults(transformToIncidents(results));
    } catch (error) {
      console.error('Failed to load incident queue:', error);
    }
  }, []);

  useEffect(() => {
    loadIncidentQueue();
  }, [loadIncidentQueue]);

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
            <AlertTriangle className="w-7 h-7 mr-3 text-red-600 dark:text-red-400" />
            Incident Management
          </h1>

          {/* Tab Navigation */}
          <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg mb-6">
            {(['queue', 'search'] as const).map((tab) => {
              const Icon = tab === 'queue' ? Clock : SearchIcon;
              const isActive = activeTab === tab;

              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex items-center px-4 py-2 rounded-md transition-all duration-200 ${
                    isActive
                      ? 'bg-white dark:bg-gray-600 text-red-600 dark:text-red-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {tab === 'queue' ? 'Incident Queue' : 'Search Incidents'}
                  {(tab === 'queue' ? queueResults : searchResults).length > 0 && (
                    <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                      isActive
                        ? 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400'
                        : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-400'
                    }`}>
                      {(tab === 'queue' ? queueResults : searchResults).length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Search Input for Search Tab */}
          {activeTab === 'search' && (
            <div className="relative mb-4">
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  performSearch(e.target.value);
                }}
                placeholder="Search incidents, problems, solutions..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              />
              {isSearching && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full"></div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <div className="max-w-4xl mx-auto p-6 h-full">
          {activeTab === 'queue' ? (
            <IncidentQueue incidents={queueResults} />
          ) : (
            <IncidentSearch
              results={searchResults}
              isSearching={isSearching}
              query={searchQuery}
            />
          )}
        </div>
      </div>
    </div>
  );
};

// Simple incident queue component (reuses existing patterns)
const IncidentQueue: React.FC<{ incidents: IncidentResult[] }> = ({ incidents }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Open Incidents ({incidents.length})
        </h2>
      </div>
      <div className="grid gap-4">
        {incidents.map((incident) => (
          <div key={incident.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 border-red-500">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-medium text-gray-900 dark:text-white">{incident.title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{incident.content.split('\n')[0]}</p>
                <div className="flex items-center mt-2 space-x-4">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    incident.status === 'resolved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {incident.status || 'Open'}
                  </span>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    incident.priority === 'critical' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {incident.priority || 'Medium'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Simple incident search component (reuses existing patterns)
const IncidentSearch: React.FC<{
  results: IncidentResult[];
  isSearching: boolean;
  query: string;
}> = ({ results, isSearching, query }) => {
  if (isSearching) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full"></div>
        <span className="ml-3 text-gray-600 dark:text-gray-400">Searching incidents...</span>
      </div>
    );
  }

  if (!query) {
    return (
      <div className="text-center text-gray-500 dark:text-gray-400 mt-12">
        <SearchIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>Enter a search term to find incidents</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Found {results.length} incidents matching "{query}"
      </p>
      <div className="grid gap-4">
        {results.map((incident) => (
          <div key={incident.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h3 className="font-medium text-gray-900 dark:text-white">{incident.title}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{incident.content.substring(0, 200)}...</p>
            {incident.highlights && incident.highlights.length > 0 && (
              <div className="mt-2">
                <span className="text-xs text-gray-500">Matches: </span>
                {incident.highlights.map((highlight, idx) => (
                  <span key={idx} className="text-xs bg-yellow-100 text-yellow-800 px-1 rounded mr-1">
                    {highlight}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Incidents;
```

**Validation**: New Incidents tab shows queue and search functionality

## Task 1.3: Add Incidents Route to App.tsx
**Effort: 30 minutes**
**Files: 1**
**Dependencies: Task 1.2**

### File Changes:
#### `/src/renderer/App.tsx`
**Add import (after line 24):**
```typescript
import Incidents from './views/Incidents';
```

**Add incidents route (after line 406):**
```typescript
{currentView === 'incidents' && <Incidents />}
```

**Validation**: Clicking Incidents tab loads the new view

## Task 1.4: Update Search Terminology
**Effort: 1 hour**
**Files: 2**
**Dependencies: None**

### File Changes:
#### `/src/renderer/views/Search.tsx` (Lines 114, 125)
```typescript
// BEFORE (Line 114):
Search

// AFTER:
Knowledge Base Search

// BEFORE (Line 125):
placeholder={activeTab === 'local' ? "Search files, settings, users..." : "Ask AI to search and analyze..."}

// AFTER:
placeholder={activeTab === 'local' ? "Search knowledge base entries..." : "Ask AI to search and analyze knowledge..."}
```

#### `/src/renderer/App.tsx` (Lines 288, 304-307)
```typescript
// BEFORE (Line 288):
placeholder="Search mainframe solutions..."

// AFTER:
placeholder="Search knowledge base..."

// BEFORE (Lines 304-307):
<button
  onClick={handleAddEntry}
  className="px-6 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:shadow-lg transition-shadow"
>
  Add Entry
</button>

// AFTER:
<button
  onClick={handleAddEntry}
  className="px-6 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:shadow-lg transition-shadow"
>
  Add KB Entry
</button>
```

**Validation**: Terminology reflects Knowledge Base vs Incidents distinction

---

# PHASE 2: UX ENHANCEMENT (3-5 Days)
*Add incident-specific workflows and status management*

## Task 2.1: Extend Database Schema for Incident Fields
**Effort: 2 hours**
**Files: 1**
**Dependencies: Phase 1 Complete**

### File Changes:
#### `/src/database/schema.sql` (Add after line 40)
```sql
-- Add incident-specific fields to kb_entries table
ALTER TABLE kb_entries ADD COLUMN status TEXT DEFAULT 'open' CHECK(status IN ('open', 'investigating', 'in-progress', 'resolved', 'closed'));
ALTER TABLE kb_entries ADD COLUMN priority TEXT DEFAULT 'medium' CHECK(priority IN ('critical', 'high', 'medium', 'low'));
ALTER TABLE kb_entries ADD COLUMN assigned_to TEXT;
ALTER TABLE kb_entries ADD COLUMN reported_by TEXT;
ALTER TABLE kb_entries ADD COLUMN impact_level TEXT DEFAULT 'medium' CHECK(impact_level IN ('critical', 'high', 'medium', 'low'));
ALTER TABLE kb_entries ADD COLUMN estimated_resolution_time INTEGER; -- in minutes
ALTER TABLE kb_entries ADD COLUMN actual_resolution_time INTEGER; -- in minutes
ALTER TABLE kb_entries ADD COLUMN parent_incident_id TEXT; -- For related incidents
ALTER TABLE kb_entries ADD COLUMN root_cause TEXT;
ALTER TABLE kb_entries ADD COLUMN preventive_measures TEXT;
```

### Add incident status history table (after line 88):
```sql
-- Incident status change history
CREATE TABLE IF NOT EXISTS incident_status_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    incident_id TEXT NOT NULL,
    old_status TEXT,
    new_status TEXT NOT NULL,
    changed_by TEXT NOT NULL,
    change_reason TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (incident_id) REFERENCES kb_entries(id) ON DELETE CASCADE
);

-- Incident escalation tracking
CREATE TABLE IF NOT EXISTS incident_escalations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    incident_id TEXT NOT NULL,
    escalated_from TEXT,
    escalated_to TEXT NOT NULL,
    escalation_reason TEXT,
    escalated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    FOREIGN KEY (incident_id) REFERENCES kb_entries(id) ON DELETE CASCADE
);
```

### Add indexes (after line 214):
```sql
-- Incident-specific indexes
CREATE INDEX IF NOT EXISTS idx_kb_status ON kb_entries(status, priority);
CREATE INDEX IF NOT EXISTS idx_kb_assigned ON kb_entries(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_kb_priority ON kb_entries(priority, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incident_status_history ON incident_status_history(incident_id, timestamp DESC);
```

**Validation**: Database supports incident fields and status tracking

## Task 2.2: Create Incident Status Workflow Component
**Effort: 4 hours**
**Files: 1 new**
**Dependencies: Task 2.1**

### New File: `/src/renderer/components/incidents/IncidentStatusWorkflow.tsx`
```typescript
import React, { useState, useCallback } from 'react';
import {
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  User,
  ArrowRight,
  Edit3,
  MessageSquare
} from 'lucide-react';

interface IncidentStatusWorkflowProps {
  incident: {
    id: string;
    title: string;
    status: 'open' | 'investigating' | 'in-progress' | 'resolved' | 'closed';
    priority: 'critical' | 'high' | 'medium' | 'low';
    assigned_to?: string;
    created_at: Date;
    estimated_resolution_time?: number;
  };
  onStatusChange: (incidentId: string, newStatus: string, reason?: string) => Promise<void>;
  onAssignmentChange: (incidentId: string, assignedTo: string) => Promise<void>;
}

const IncidentStatusWorkflow: React.FC<IncidentStatusWorkflowProps> = ({
  incident,
  onStatusChange,
  onAssignmentChange
}) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [reason, setReason] = useState('');

  const statusConfig = {
    open: {
      color: 'red',
      icon: AlertTriangle,
      label: 'Open',
      nextStates: ['investigating', 'closed']
    },
    investigating: {
      color: 'yellow',
      icon: Clock,
      label: 'Investigating',
      nextStates: ['in-progress', 'resolved', 'closed']
    },
    'in-progress': {
      color: 'blue',
      icon: Edit3,
      label: 'In Progress',
      nextStates: ['resolved', 'closed']
    },
    resolved: {
      color: 'green',
      icon: CheckCircle,
      label: 'Resolved',
      nextStates: ['closed', 'open'] // Can reopen if needed
    },
    closed: {
      color: 'gray',
      icon: XCircle,
      label: 'Closed',
      nextStates: ['open'] // Can reopen if needed
    }
  };

  const priorityConfig = {
    critical: { color: 'red', label: 'Critical' },
    high: { color: 'orange', label: 'High' },
    medium: { color: 'yellow', label: 'Medium' },
    low: { color: 'blue', label: 'Low' }
  };

  const handleStatusChange = useCallback(async (newStatus: string) => {
    setSelectedStatus(newStatus);
    setShowReasonModal(true);
  }, []);

  const confirmStatusChange = useCallback(async () => {
    setIsUpdating(true);
    try {
      await onStatusChange(incident.id, selectedStatus, reason);
      setShowReasonModal(false);
      setReason('');
    } catch (error) {
      console.error('Failed to update status:', error);
    } finally {
      setIsUpdating(false);
    }
  }, [incident.id, selectedStatus, reason, onStatusChange]);

  const currentConfig = statusConfig[incident.status];
  const CurrentIcon = currentConfig.icon;
  const currentPriority = priorityConfig[incident.priority];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-4">
      {/* Current Status Display */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-full bg-${currentConfig.color}-100`}>
            <CurrentIcon className={`w-5 h-5 text-${currentConfig.color}-600`} />
          </div>
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white">
              Status: {currentConfig.label}
            </h3>
            <div className="flex items-center space-x-2 mt-1">
              <span className={`px-2 py-1 text-xs rounded-full bg-${currentPriority.color}-100 text-${currentPriority.color}-800`}>
                {currentPriority.label} Priority
              </span>
              {incident.assigned_to && (
                <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800 flex items-center">
                  <User className="w-3 h-3 mr-1" />
                  {incident.assigned_to}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Status Workflow Actions */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Available Actions:
        </h4>
        <div className="flex flex-wrap gap-2">
          {currentConfig.nextStates.map((nextStatus) => {
            const nextConfig = statusConfig[nextStatus];
            const NextIcon = nextConfig.icon;

            return (
              <button
                key={nextStatus}
                onClick={() => handleStatusChange(nextStatus)}
                disabled={isUpdating}
                className={`flex items-center px-3 py-2 text-sm rounded-lg border transition-colors
                  border-${nextConfig.color}-200 text-${nextConfig.color}-700 hover:bg-${nextConfig.color}-50
                  disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <ArrowRight className="w-4 h-4 mr-2" />
                Move to {nextConfig.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Time Tracking */}
      {incident.estimated_resolution_time && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">
              Estimated Resolution: {incident.estimated_resolution_time} minutes
            </span>
            <span className="text-gray-600 dark:text-gray-400">
              Age: {Math.floor((Date.now() - incident.created_at.getTime()) / (1000 * 60))} minutes
            </span>
          </div>
        </div>
      )}

      {/* Status Change Modal */}
      {showReasonModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96 max-w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">
              Change Status to {statusConfig[selectedStatus].label}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Reason for change (optional):
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  rows={3}
                  placeholder="Describe what was done or why this change is being made..."
                />
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={confirmStatusChange}
                  disabled={isUpdating}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUpdating ? 'Updating...' : 'Confirm Change'}
                </button>
                <button
                  onClick={() => {
                    setShowReasonModal(false);
                    setReason('');
                  }}
                  disabled={isUpdating}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IncidentStatusWorkflow;
```

**Validation**: Status workflow shows current state and available transitions

## Task 2.3: Create Incident Priority and Assignment Components
**Effort: 3 hours**
**Files: 2 new**
**Dependencies: Task 2.2**

### New File: `/src/renderer/components/incidents/IncidentPriorityBadge.tsx`
```typescript
import React from 'react';
import { AlertTriangle, AlertCircle, Info, Minus } from 'lucide-react';

interface IncidentPriorityBadgeProps {
  priority: 'critical' | 'high' | 'medium' | 'low';
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

const IncidentPriorityBadge: React.FC<IncidentPriorityBadgeProps> = ({
  priority,
  size = 'md',
  showIcon = true
}) => {
  const priorityConfig = {
    critical: {
      color: 'red',
      bgColor: 'bg-red-100',
      textColor: 'text-red-800',
      borderColor: 'border-red-200',
      icon: AlertTriangle,
      label: 'Critical'
    },
    high: {
      color: 'orange',
      bgColor: 'bg-orange-100',
      textColor: 'text-orange-800',
      borderColor: 'border-orange-200',
      icon: AlertCircle,
      label: 'High'
    },
    medium: {
      color: 'yellow',
      bgColor: 'bg-yellow-100',
      textColor: 'text-yellow-800',
      borderColor: 'border-yellow-200',
      icon: Info,
      label: 'Medium'
    },
    low: {
      color: 'blue',
      bgColor: 'bg-blue-100',
      textColor: 'text-blue-800',
      borderColor: 'border-blue-200',
      icon: Minus,
      label: 'Low'
    }
  };

  const sizeConfig = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-2 text-base'
  };

  const iconSizeConfig = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  const config = priorityConfig[priority];
  const Icon = config.icon;

  return (
    <span className={`
      inline-flex items-center rounded-full font-medium border
      ${config.bgColor} ${config.textColor} ${config.borderColor}
      ${sizeConfig[size]}
    `}>
      {showIcon && <Icon className={`${iconSizeConfig[size]} mr-1`} />}
      {config.label}
    </span>
  );
};

export default IncidentPriorityBadge;
```

### New File: `/src/renderer/components/incidents/IncidentAssignment.tsx`
```typescript
import React, { useState, useCallback } from 'react';
import { User, Users, UserPlus, X } from 'lucide-react';

interface IncidentAssignmentProps {
  incidentId: string;
  currentAssignee?: string;
  availableAssignees: string[];
  onAssignmentChange: (incidentId: string, assignedTo: string | null) => Promise<void>;
}

const IncidentAssignment: React.FC<IncidentAssignmentProps> = ({
  incidentId,
  currentAssignee,
  availableAssignees,
  onAssignmentChange
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleAssignmentChange = useCallback(async (assignedTo: string | null) => {
    setIsUpdating(true);
    try {
      await onAssignmentChange(incidentId, assignedTo);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update assignment:', error);
    } finally {
      setIsUpdating(false);
    }
  }, [incidentId, onAssignmentChange]);

  if (isEditing) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border p-3">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white flex items-center">
            <UserPlus className="w-4 h-4 mr-2" />
            Assign Incident
          </h4>
          <button
            onClick={() => setIsEditing(false)}
            disabled={isUpdating}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2">
          {/* Unassign option */}
          <button
            onClick={() => handleAssignmentChange(null)}
            disabled={isUpdating}
            className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            <span className="text-gray-600 dark:text-gray-400">Unassigned</span>
          </button>

          {/* Available assignees */}
          {availableAssignees.map((assignee) => (
            <button
              key={assignee}
              onClick={() => handleAssignmentChange(assignee)}
              disabled={isUpdating}
              className={`w-full text-left px-3 py-2 text-sm rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 ${
                assignee === currentAssignee ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200' : ''
              }`}
            >
              <div className="flex items-center">
                <User className="w-4 h-4 mr-2 text-gray-400" />
                <span className="text-gray-900 dark:text-white">{assignee}</span>
                {assignee === currentAssignee && (
                  <span className="ml-auto text-xs text-blue-600 dark:text-blue-400">Current</span>
                )}
              </div>
            </button>
          ))}
        </div>

        {isUpdating && (
          <div className="mt-3 text-center">
            <div className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400">
              <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full mr-2"></div>
              Updating assignment...
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Users className="w-4 h-4 mr-2 text-gray-400" />
          <span className="text-sm text-gray-600 dark:text-gray-400">Assigned to:</span>
        </div>
        <button
          onClick={() => setIsEditing(true)}
          className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
        >
          Change
        </button>
      </div>

      <div className="mt-2">
        {currentAssignee ? (
          <div className="flex items-center px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-md">
            <User className="w-4 h-4 mr-2 text-gray-400" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {currentAssignee}
            </span>
          </div>
        ) : (
          <div className="flex items-center px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-md">
            <span className="text-sm text-gray-600 dark:text-gray-400 italic">
              Unassigned
            </span>
            <button
              onClick={() => setIsEditing(true)}
              className="ml-auto text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800"
            >
              Assign
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default IncidentAssignment;
```

**Validation**: Priority badges display correctly and assignment component works

---

# PHASE 3: ADVANCED FEATURES (5-7 Days)
*Analytics, relationships, and advanced incident management*

## Task 3.1: Create Incident Analytics Dashboard
**Effort: 6 hours**
**Files: 1 new**
**Dependencies: Phase 2 Complete**

### New File: `/src/renderer/components/incidents/IncidentAnalyticsDashboard.tsx`
```typescript
import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle,
  Users,
  Calendar,
  Target
} from 'lucide-react';

interface IncidentMetrics {
  totalIncidents: number;
  openIncidents: number;
  resolvedIncidents: number;
  averageResolutionTime: number; // in minutes
  mttr: number; // Mean Time To Resolution
  mtbf: number; // Mean Time Between Failures
  byPriority: Record<string, number>;
  byCategory: Record<string, number>;
  byAssignee: Record<string, number>;
  resolutionTrend: Array<{ date: string; resolved: number; created: number }>;
}

interface IncidentAnalyticsDashboardProps {
  timeframe: '24h' | '7d' | '30d' | '90d';
  onTimeframeChange: (timeframe: '24h' | '7d' | '30d' | '90d') => void;
}

const IncidentAnalyticsDashboard: React.FC<IncidentAnalyticsDashboardProps> = ({
  timeframe,
  onTimeframeChange
}) => {
  const [metrics, setMetrics] = useState<IncidentMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  // Mock data generation (in real implementation, this would come from the database)
  const generateMockMetrics = useMemo(() => {
    const now = new Date();
    const total = 150;
    const resolved = 120;
    const open = total - resolved;

    return {
      totalIncidents: total,
      openIncidents: open,
      resolvedIncidents: resolved,
      averageResolutionTime: 180, // 3 hours
      mttr: 165, // 2.75 hours
      mtbf: 2400, // 40 hours
      byPriority: {
        critical: 15,
        high: 35,
        medium: 75,
        low: 25
      },
      byCategory: {
        'System': 45,
        'Network': 25,
        'Database': 30,
        'Application': 50
      },
      byAssignee: {
        'John Smith': 35,
        'Sarah Johnson': 28,
        'Mike Chen': 32,
        'Unassigned': 55
      },
      resolutionTrend: Array.from({ length: 7 }, (_, i) => ({
        date: new Date(now.getTime() - (6 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        resolved: Math.floor(Math.random() * 20) + 5,
        created: Math.floor(Math.random() * 25) + 8
      }))
    };
  }, [timeframe]);

  useEffect(() => {
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      setMetrics(generateMockMetrics);
      setLoading(false);
    }, 500);
  }, [timeframe, generateMockMetrics]);

  if (loading || !metrics) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const resolutionRate = Math.round((metrics.resolvedIncidents / metrics.totalIncidents) * 100);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
          <BarChart3 className="w-7 h-7 mr-3 text-blue-600" />
          Incident Analytics
        </h2>

        {/* Timeframe Selector */}
        <div className="flex space-x-2">
          {(['24h', '7d', '30d', '90d'] as const).map((period) => (
            <button
              key={period}
              onClick={() => onTimeframeChange(period)}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                timeframe === period
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {period === '24h' ? 'Last 24h' :
               period === '7d' ? 'Last 7 days' :
               period === '30d' ? 'Last 30 days' : 'Last 90 days'}
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Incidents"
          value={metrics.totalIncidents.toString()}
          icon={AlertTriangle}
          color="blue"
          subtitle={`${metrics.openIncidents} open, ${metrics.resolvedIncidents} resolved`}
        />

        <MetricCard
          title="Resolution Rate"
          value={`${resolutionRate}%`}
          icon={CheckCircle}
          color="green"
          subtitle={`${metrics.resolvedIncidents} of ${metrics.totalIncidents} resolved`}
        />

        <MetricCard
          title="Avg Resolution Time"
          value={`${Math.floor(metrics.averageResolutionTime / 60)}h ${metrics.averageResolutionTime % 60}m`}
          icon={Clock}
          color="orange"
          subtitle="MTTR across all incidents"
        />

        <MetricCard
          title="MTBF"
          value={`${Math.floor(metrics.mtbf / 60)}h`}
          icon={Target}
          color="purple"
          subtitle="Mean time between failures"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Priority Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Incidents by Priority
          </h3>
          <div className="space-y-3">
            {Object.entries(metrics.byPriority).map(([priority, count]) => {
              const percentage = Math.round((count / metrics.totalIncidents) * 100);
              const colorMap = {
                critical: 'bg-red-500',
                high: 'bg-orange-500',
                medium: 'bg-yellow-500',
                low: 'bg-blue-500'
              };

              return (
                <div key={priority} className="flex items-center">
                  <div className="w-20 text-sm text-gray-600 dark:text-gray-400 capitalize">
                    {priority}
                  </div>
                  <div className="flex-1 mx-3">
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${colorMap[priority as keyof typeof colorMap]}`}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className="w-16 text-sm text-gray-900 dark:text-white text-right">
                    {count} ({percentage}%)
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Category Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Incidents by Category
          </h3>
          <div className="space-y-3">
            {Object.entries(metrics.byCategory).map(([category, count]) => {
              const percentage = Math.round((count / metrics.totalIncidents) * 100);

              return (
                <div key={category} className="flex items-center">
                  <div className="w-20 text-sm text-gray-600 dark:text-gray-400">
                    {category}
                  </div>
                  <div className="flex-1 mx-3">
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-blue-500"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className="w-16 text-sm text-gray-900 dark:text-white text-right">
                    {count} ({percentage}%)
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Assignment Workload */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
          <Users className="w-5 h-5 mr-2" />
          Assignment Workload
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(metrics.byAssignee).map(([assignee, count]) => (
            <div key={assignee} className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{count}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{assignee}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Resolution Trend */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
          <TrendingUp className="w-5 h-5 mr-2" />
          Resolution Trend (Last 7 Days)
        </h3>
        <div className="space-y-2">
          {metrics.resolutionTrend.map((day, index) => (
            <div key={day.date} className="flex items-center">
              <div className="w-20 text-sm text-gray-600 dark:text-gray-400">
                {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </div>
              <div className="flex-1 mx-3 flex items-center space-x-2">
                <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-green-500"
                    style={{ width: `${(day.resolved / Math.max(...metrics.resolutionTrend.map(d => d.resolved))) * 100}%` }}
                  ></div>
                </div>
                <span className="text-xs text-green-600 dark:text-green-400 w-8">+{day.resolved}</span>
              </div>
              <div className="w-16 text-sm text-gray-900 dark:text-white text-right">
                {day.created} new
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Reusable metric card component
const MetricCard: React.FC<{
  title: string;
  value: string;
  icon: React.ComponentType<any>;
  color: string;
  subtitle?: string;
}> = ({ title, value, icon: Icon, color, subtitle }) => {
  const colorMap = {
    blue: 'text-blue-600 bg-blue-100',
    green: 'text-green-600 bg-green-100',
    orange: 'text-orange-600 bg-orange-100',
    purple: 'text-purple-600 bg-purple-100',
    red: 'text-red-600 bg-red-100'
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex items-center">
        <div className={`p-2 rounded-full ${colorMap[color as keyof typeof colorMap]}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-500 dark:text-gray-500">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default IncidentAnalyticsDashboard;
```

**Validation**: Analytics dashboard shows metrics, charts, and trends

## Task 3.2: Create Incident Relationships Component
**Effort: 4 hours**
**Files: 1 new**
**Dependencies: Task 3.1**

### New File: `/src/renderer/components/incidents/IncidentRelationships.tsx`
```typescript
import React, { useState, useCallback } from 'react';
import {
  Link,
  Plus,
  X,
  ArrowRight,
  Copy,
  AlertTriangle,
  Search,
  ExternalLink
} from 'lucide-react';

interface RelatedIncident {
  id: string;
  title: string;
  status: 'open' | 'investigating' | 'in-progress' | 'resolved' | 'closed';
  priority: 'critical' | 'high' | 'medium' | 'low';
  relationship: 'related' | 'duplicate' | 'superseded' | 'prerequisite' | 'caused-by' | 'blocks';
  created_at: Date;
}

interface IncidentRelationshipsProps {
  incidentId: string;
  relationships: RelatedIncident[];
  onAddRelationship: (incidentId: string, relatedId: string, type: string) => Promise<void>;
  onRemoveRelationship: (incidentId: string, relatedId: string) => Promise<void>;
  onSearchIncidents: (query: string) => Promise<RelatedIncident[]>;
}

const IncidentRelationships: React.FC<IncidentRelationshipsProps> = ({
  incidentId,
  relationships,
  onAddRelationship,
  onRemoveRelationship,
  onSearchIncidents
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<RelatedIncident[]>([]);
  const [selectedType, setSelectedType] = useState<string>('related');
  const [isSearching, setIsSearching] = useState(false);

  const relationshipTypes = [
    { value: 'related', label: 'Related to', description: 'General relationship' },
    { value: 'duplicate', label: 'Duplicate of', description: 'Same issue, different report' },
    { value: 'superseded', label: 'Superseded by', description: 'Replaced by newer incident' },
    { value: 'prerequisite', label: 'Prerequisite for', description: 'Must be resolved first' },
    { value: 'caused-by', label: 'Caused by', description: 'Root cause relationship' },
    { value: 'blocks', label: 'Blocks', description: 'Prevents resolution of other incident' }
  ];

  const relationshipConfig = {
    related: { color: 'blue', icon: Link },
    duplicate: { color: 'yellow', icon: Copy },
    superseded: { color: 'purple', icon: ArrowRight },
    prerequisite: { color: 'orange', icon: AlertTriangle },
    'caused-by': { color: 'red', icon: ArrowRight },
    blocks: { color: 'red', icon: X }
  };

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await onSearchIncidents(query);
      // Filter out current incident and already related incidents
      const filtered = results.filter(
        result =>
          result.id !== incidentId &&
          !relationships.some(rel => rel.id === result.id)
      );
      setSearchResults(filtered);
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [incidentId, relationships, onSearchIncidents]);

  const handleAddRelationship = useCallback(async (relatedId: string) => {
    try {
      await onAddRelationship(incidentId, relatedId, selectedType);
      setIsAdding(false);
      setSearchQuery('');
      setSearchResults([]);
    } catch (error) {
      console.error('Failed to add relationship:', error);
    }
  }, [incidentId, selectedType, onAddRelationship]);

  const handleRemoveRelationship = useCallback(async (relatedId: string) => {
    try {
      await onRemoveRelationship(incidentId, relatedId);
    } catch (error) {
      console.error('Failed to remove relationship:', error);
    }
  }, [incidentId, onRemoveRelationship]);

  const getStatusColor = (status: string) => {
    const statusColors = {
      open: 'text-red-600 bg-red-100',
      investigating: 'text-yellow-600 bg-yellow-100',
      'in-progress': 'text-blue-600 bg-blue-100',
      resolved: 'text-green-600 bg-green-100',
      closed: 'text-gray-600 bg-gray-100'
    };
    return statusColors[status as keyof typeof statusColors] || 'text-gray-600 bg-gray-100';
  };

  const getPriorityColor = (priority: string) => {
    const priorityColors = {
      critical: 'text-red-600 bg-red-100',
      high: 'text-orange-600 bg-orange-100',
      medium: 'text-yellow-600 bg-yellow-100',
      low: 'text-blue-600 bg-blue-100'
    };
    return priorityColors[priority as keyof typeof priorityColors] || 'text-gray-600 bg-gray-100';
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <Link className="w-5 h-5 mr-2" />
            Related Incidents ({relationships.length})
          </h3>
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="flex items-center px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Relationship
          </button>
        </div>
      </div>

      {/* Add Relationship Form */}
      {isAdding && (
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="space-y-4">
            {/* Relationship Type Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Relationship Type:
              </label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {relationshipTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label} - {type.description}
                  </option>
                ))}
              </select>
            </div>

            {/* Search for Incidents */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Search for Incident:
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    handleSearch(e.target.value);
                  }}
                  placeholder="Search by incident title or ID..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                {isSearching && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                  </div>
                )}
              </div>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-md">
                {searchResults.map((incident) => (
                  <div
                    key={incident.id}
                    className="flex items-center justify-between p-3 hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-600 last:border-b-0"
                  >
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                        {incident.title}
                      </h4>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(incident.status)}`}>
                          {incident.status}
                        </span>
                        <span className={`px-2 py-1 text-xs rounded-full ${getPriorityColor(incident.priority)}`}>
                          {incident.priority}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAddRelationship(incident.id)}
                      className="ml-3 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Link
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Cancel Button */}
            <div className="flex justify-end">
              <button
                onClick={() => {
                  setIsAdding(false);
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                className="px-4 py-2 text-sm border border-gray-300 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Relationships List */}
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {relationships.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
            <Link className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No related incidents found</p>
            <p className="text-sm">Click "Add Relationship" to link this incident to others</p>
          </div>
        ) : (
          relationships.map((related) => {
            const config = relationshipConfig[related.relationship as keyof typeof relationshipConfig];
            const RelationIcon = config?.icon || Link;

            return (
              <div key={related.id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <div className={`p-1 rounded-full bg-${config?.color || 'blue'}-100`}>
                        <RelationIcon className={`w-4 h-4 text-${config?.color || 'blue'}-600`} />
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                          {related.title}
                        </h4>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                            {relationshipTypes.find(t => t.value === related.relationship)?.label || related.relationship}
                          </span>
                          <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(related.status)}`}>
                            {related.status}
                          </span>
                          <span className={`px-2 py-1 text-xs rounded-full ${getPriorityColor(related.priority)}`}>
                            {related.priority}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      className="p-1 text-gray-400 hover:text-blue-600"
                      title="View incident"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleRemoveRelationship(related.id)}
                      className="p-1 text-gray-400 hover:text-red-600"
                      title="Remove relationship"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default IncidentRelationships;
```

**Validation**: Can link incidents with different relationship types

---

# IMPLEMENTATION TIMELINE

## Phase 1: Semantic Reframing (Days 1-3)
- **Day 1**: Tasks 1.1-1.2 (Navigation + Incidents View)
- **Day 2**: Task 1.3-1.4 (Integration + Terminology)
- **Day 3**: Testing and refinement

## Phase 2: UX Enhancement (Days 4-8)
- **Day 4**: Task 2.1 (Database Extensions)
- **Day 5**: Task 2.2 (Status Workflow)
- **Day 6-7**: Task 2.3 (Priority + Assignment)
- **Day 8**: Integration testing

## Phase 3: Advanced Features (Days 9-15)
- **Day 9-11**: Task 3.1 (Analytics Dashboard)
- **Day 12-14**: Task 3.2 (Relationships)
- **Day 15**: Final testing and optimization

## COMPONENT REUSE STRATEGY

### ✅ Reusing Existing Components (80%)
- **Search Interface**: Reuse LocalSearchTab/AISearchTab with incident terminology
- **Forms**: Reuse existing form components for incident CRUD
- **Modals**: Reuse AddEntryModal/EditEntryModal pattern
- **Data Display**: Reuse card layouts and list components
- **Navigation**: Extend existing tab system
- **Database**: Extend existing schema with new fields

### 🆕 New Components (20%)
- **IncidentStatusWorkflow**: Status transition management
- **IncidentPriorityBadge**: Priority visualization
- **IncidentAssignment**: Assignment management
- **IncidentAnalyticsDashboard**: Metrics and reporting
- **IncidentRelationships**: Incident linking

## CRITICAL SUCCESS FACTORS

1. **Minimal Code Changes**: 80% reuse minimizes risk and development time
2. **Semantic Clarity**: Clear distinction between Knowledge Base and Incidents
3. **Progressive Enhancement**: Each phase builds on the previous
4. **Database Compatibility**: Extensions don't break existing functionality
5. **UI Consistency**: New components follow existing design patterns

## VALIDATION CHECKPOINTS

- **Phase 1**: Navigation works, terminology is clear
- **Phase 2**: Status workflow functions, priority/assignment work
- **Phase 3**: Analytics show real data, relationships link properly

This atomic breakdown provides exact file changes, preserves existing functionality, and delivers a complete incident management system with minimal risk and maximum reuse.