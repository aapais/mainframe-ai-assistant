# Tagging API Reference

## Overview

The Tagging API provides comprehensive endpoints for managing intelligent tags within the Mainframe Knowledge Base Assistant. This API supports tag lifecycle management, intelligent suggestions, associations with knowledge base entries, and advanced analytics.

## Base URL

```
/api/v1/tags
```

## Authentication

All API endpoints require authentication via Bearer token:

```http
Authorization: Bearer <your-api-token>
```

## Tag Data Model

### Tag

```typescript
interface Tag {
  id: string;                    // Unique identifier (UUID)
  name: string;                  // Tag name (normalized, lowercase)
  display_name?: string;         // User-friendly display name
  description?: string;          // Optional description
  category_id?: string;          // Associated category ID
  color?: string;               // Hex color code for display
  is_system: boolean;           // System-managed tag flag
  is_suggested: boolean;        // Suggested by AI/system
  usage_count: number;          // Number of associations
  trending_score?: number;      // Trending indicator (0-100)
  created_at: string;           // ISO 8601 timestamp
  updated_at: string;           // ISO 8601 timestamp
  created_by: string;           // User ID
}
```

### TagAssociation

```typescript
interface TagAssociation {
  id: string;                   // Association ID
  entry_id: string;             // Knowledge base entry ID
  tag_id: string;               // Tag ID
  relevance_score?: number;     // Relevance score (0.0-1.0)
  assigned_by: 'user' | 'system' | 'ai';  // Assignment source
  confidence?: number;          // AI confidence (0.0-1.0)
  created_at: string;           // ISO 8601 timestamp
  created_by: string;           // User ID
}
```

### TagSuggestion

```typescript
interface TagSuggestion {
  tag: Tag;                     // Suggested tag
  score: number;                // Suggestion score (0-100)
  source: 'existing' | 'category' | 'pattern' | 'ai';  // Suggestion source
  reasoning?: string;           // AI reasoning for suggestion
  confidence?: number;          // Confidence level
}
```

## Endpoints

### GET /tags

Retrieve tags with optional filtering and pagination.

#### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `q` | string | - | Search query |
| `category_id` | string | - | Filter by category |
| `include_system` | boolean | true | Include system tags |
| `include_unused` | boolean | true | Include tags with no associations |
| `sort_by` | string | "usage_count" | Sort field |
| `sort_order` | string | "desc" | Sort direction |
| `page` | number | 1 | Page number (1-based) |
| `limit` | number | 50 | Items per page (1-100) |

#### Request Example

```http
GET /api/v1/tags?q=error&category_id=system&sort_by=usage_count&limit=20
Accept: application/json
Authorization: Bearer <token>
```

#### Response

```json
{
  "data": [
    {
      "id": "tag-123",
      "name": "error-handling",
      "display_name": "Error Handling",
      "description": "Tags related to error handling procedures",
      "category_id": "cat-system",
      "color": "#e74c3c",
      "is_system": false,
      "is_suggested": true,
      "usage_count": 45,
      "trending_score": 85,
      "created_at": "2024-01-15T10:00:00Z",
      "updated_at": "2024-01-15T15:30:00Z",
      "created_by": "user-456"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8
  },
  "meta": {
    "query_time": 15,
    "filters_applied": {
      "search_query": "error",
      "category_filter": "system"
    }
  }
}
```

### GET /tags/search

Advanced tag search with fuzzy matching and semantic search.

#### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `q` | string | - | Search query (required) |
| `category_id` | string | - | Filter by category |
| `exclude_ids` | string[] | [] | Exclude specific tag IDs |
| `fuzzy` | boolean | true | Enable fuzzy matching |
| `semantic` | boolean | true | Enable AI semantic search |
| `limit` | number | 20 | Maximum results |

#### Request Example

```http
GET /api/v1/tags/search?q=mem&fuzzy=true&semantic=true&limit=10
Accept: application/json
Authorization: Bearer <token>
```

#### Response

```json
{
  "data": [
    {
      "id": "tag-456",
      "name": "memory-error",
      "display_name": "Memory Error",
      "usage_count": 25,
      "match_type": "exact",
      "relevance_score": 1.0,
      "highlighted_name": "<mark>mem</mark>ory-error"
    },
    {
      "id": "tag-789",
      "name": "memory-allocation",
      "display_name": "Memory Allocation",
      "usage_count": 15,
      "match_type": "fuzzy",
      "relevance_score": 0.85,
      "highlighted_name": "<mark>mem</mark>ory-allocation"
    }
  ],
  "query": "mem",
  "total_results": 8,
  "search_time": 12,
  "sources_used": ["exact", "fuzzy", "semantic"]
}
```

### GET /tags/suggestions

Get intelligent tag suggestions for a given query.

#### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `q` | string | - | Query text (required) |
| `category_id` | string | - | Prefer tags from category |
| `context_entry_id` | string | - | Context KB entry for better suggestions |
| `limit` | number | 10 | Maximum suggestions |
| `include_ai` | boolean | true | Include AI-generated suggestions |
| `min_score` | number | 50 | Minimum suggestion score |

#### Request Example

```http
GET /api/v1/tags/suggestions?q=vsam%20file%20error&context_entry_id=entry-123&limit=5
Accept: application/json
Authorization: Bearer <token>
```

#### Response

```json
{
  "data": [
    {
      "tag": {
        "id": "tag-vsam1",
        "name": "vsam-error",
        "display_name": "VSAM Error",
        "category_id": "cat-vsam",
        "usage_count": 35
      },
      "score": 95,
      "source": "existing",
      "reasoning": "Exact match for frequently used tag"
    },
    {
      "tag": {
        "id": "tag-file1",
        "name": "file-not-found",
        "display_name": "File Not Found",
        "category_id": "cat-system",
        "usage_count": 28
      },
      "score": 87,
      "source": "semantic",
      "reasoning": "Semantically related to file access errors"
    },
    {
      "tag": {
        "id": "suggested-123",
        "name": "vsam-status-35",
        "display_name": "VSAM Status 35",
        "category_id": "cat-vsam",
        "is_suggested": true
      },
      "score": 82,
      "source": "ai",
      "reasoning": "AI generated based on VSAM error pattern analysis"
    }
  ],
  "query": "vsam file error",
  "suggestion_time": 25,
  "context_used": true
}
```

### GET /tags/{id}

Retrieve a specific tag by ID.

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Tag UUID (required) |
| `include_associations` | boolean | Include entry associations |
| `include_analytics` | boolean | Include usage analytics |

#### Request Example

```http
GET /api/v1/tags/tag-123?include_associations=true&include_analytics=true
Accept: application/json
Authorization: Bearer <token>
```

#### Response

```json
{
  "data": {
    "id": "tag-123",
    "name": "error-handling",
    "display_name": "Error Handling",
    "description": "Tags related to error handling procedures",
    "category_id": "cat-system",
    "color": "#e74c3c",
    "is_system": false,
    "is_suggested": false,
    "usage_count": 45,
    "trending_score": 85,
    "created_at": "2024-01-15T10:00:00Z",
    "updated_at": "2024-01-15T15:30:00Z",
    "created_by": "user-456",
    "associations": [
      {
        "entry_id": "entry-456",
        "entry_title": "VSAM Error Recovery",
        "relevance_score": 0.9,
        "assigned_by": "user"
      }
    ],
    "analytics": {
      "usage_trend": "increasing",
      "recent_growth": 0.15,
      "avg_relevance": 0.87,
      "co_occurrence": [
        {
          "tag_name": "vsam",
          "correlation": 0.75
        }
      ]
    }
  }
}
```

### POST /tags

Create a new tag.

#### Request Body

```json
{
  "name": "custom-error",
  "display_name": "Custom Error",
  "description": "Custom application error handling",
  "category_id": "cat-system",
  "color": "#ff6b35",
  "is_suggested": false
}
```

#### Validation Rules

- `name`: Required, 2-30 characters, lowercase with hyphens/underscores
- `display_name`: Auto-generated if not provided
- `description`: Optional, max 500 characters
- `category_id`: Must exist and be active
- `color`: Optional hex color code
- Name must be unique globally (case-insensitive)

#### Response

```json
{
  "data": {
    "id": "tag-new123",
    "name": "custom-error",
    "display_name": "Custom Error",
    "description": "Custom application error handling",
    "category_id": "cat-system",
    "color": "#ff6b35",
    "is_system": false,
    "is_suggested": false,
    "usage_count": 0,
    "trending_score": 0,
    "created_at": "2024-01-15T16:00:00Z",
    "updated_at": "2024-01-15T16:00:00Z",
    "created_by": "user-456"
  }
}
```

### PATCH /tags/{id}

Update an existing tag.

#### Request Body

```json
{
  "display_name": "Updated Custom Error",
  "description": "Updated description for custom error handling",
  "color": "#e67e22",
  "is_suggested": true
}
```

#### Business Rules

- System tags (`is_system: true`) cannot be modified
- Tag name changes require validation for uniqueness
- Cannot change `is_system` flag after creation

#### Response

```json
{
  "data": {
    "id": "tag-new123",
    "name": "custom-error",
    "display_name": "Updated Custom Error",
    "description": "Updated description for custom error handling",
    "color": "#e67e22",
    "is_suggested": true,
    "updated_at": "2024-01-15T16:30:00Z"
  }
}
```

### DELETE /tags/{id}

Delete a tag.

#### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `force` | boolean | false | Force delete tag with associations |

#### Business Rules

- Cannot delete system tags (unless `force=true`)
- Cannot delete tags with associations (unless `force=true`)
- Deletion removes all tag associations
- Deletion is permanent (hard delete)

#### Request Example

```http
DELETE /api/v1/tags/tag-new123?force=false
Authorization: Bearer <token>
```

#### Response

```json
{
  "message": "Tag deleted successfully",
  "deleted_at": "2024-01-15T17:00:00Z",
  "associations_removed": 0
}
```

### POST /tags/{tag_id}/associate

Associate a tag with a knowledge base entry.

#### Request Body

```json
{
  "entry_id": "entry-456",
  "relevance_score": 0.9,
  "assigned_by": "user",
  "confidence": 0.85
}
```

#### Response

```json
{
  "data": {
    "id": "assoc-123",
    "tag_id": "tag-123",
    "entry_id": "entry-456",
    "relevance_score": 0.9,
    "assigned_by": "user",
    "confidence": 0.85,
    "created_at": "2024-01-15T17:30:00Z",
    "created_by": "user-456"
  }
}
```

### DELETE /tags/{tag_id}/associate/{entry_id}

Remove tag association from a knowledge base entry.

#### Response

```json
{
  "message": "Tag association removed successfully",
  "removed_at": "2024-01-15T17:45:00Z"
}
```

### GET /tags/{tag_id}/entries

Get all knowledge base entries associated with a tag.

#### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `sort_by` | string | "relevance_score" | Sort field |
| `sort_order` | string | "desc" | Sort direction |
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page |

#### Response

```json
{
  "data": [
    {
      "id": "entry-456",
      "title": "VSAM Error Recovery Procedures",
      "snippet": "When encountering VSAM status codes...",
      "category": {
        "id": "cat-vsam",
        "name": "VSAM"
      },
      "association": {
        "relevance_score": 0.9,
        "assigned_by": "user",
        "created_at": "2024-01-15T12:00:00Z"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "pages": 3
  },
  "tag": {
    "id": "tag-123",
    "name": "error-handling",
    "display_name": "Error Handling"
  }
}
```

### POST /tags/bulk

Perform bulk operations on multiple tags.

#### Request Body

```json
{
  "operation": "assign",
  "tags": [
    {
      "id": "tag-123",
      "entry_ids": ["entry-1", "entry-2", "entry-3"],
      "options": {
        "relevance_score": 0.8,
        "assigned_by": "user"
      }
    },
    {
      "id": "tag-456",
      "entry_ids": ["entry-2", "entry-4"]
    }
  ],
  "global_options": {
    "continue_on_error": true,
    "validate_only": false
  }
}
```

#### Supported Operations

| Operation | Description | Required Fields |
|-----------|-------------|-----------------|
| `create` | Create multiple tags | `data` |
| `update` | Update multiple tags | `id`, `data` |
| `delete` | Delete multiple tags | `id` |
| `assign` | Assign tags to entries | `id`, `entry_ids` |
| `unassign` | Remove tag assignments | `id`, `entry_ids` |
| `merge` | Merge tags together | `id`, `merge_into_id` |

#### Response

```json
{
  "operation": "assign",
  "total_items": 2,
  "successful": 2,
  "failed": 0,
  "errors": [],
  "results": [
    {
      "tag_id": "tag-123",
      "status": "success",
      "associations_created": 3,
      "execution_time": 25
    },
    {
      "tag_id": "tag-456",
      "status": "success",
      "associations_created": 2,
      "execution_time": 18
    }
  ],
  "total_execution_time": 43,
  "transaction_id": "bulk-789456"
}
```

### GET /tags/trending

Get trending tags based on recent usage patterns.

#### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `period` | string | "7d" | Time period (1d, 7d, 30d) |
| `category_id` | string | - | Filter by category |
| `min_usage` | number | 5 | Minimum usage count |
| `limit` | number | 20 | Maximum results |

#### Request Example

```http
GET /api/v1/tags/trending?period=7d&limit=10
Accept: application/json
Authorization: Bearer <token>
```

#### Response

```json
{
  "data": [
    {
      "id": "tag-trending1",
      "name": "s0c7-error",
      "display_name": "S0C7 Error",
      "category_id": "cat-batch",
      "recent_usage": 25,
      "growth_rate": 0.67,
      "trending_score": 92,
      "trend_direction": "increasing"
    },
    {
      "id": "tag-trending2",
      "name": "vsam-status-35",
      "display_name": "VSAM Status 35",
      "category_id": "cat-vsam",
      "recent_usage": 18,
      "growth_rate": 0.45,
      "trending_score": 78,
      "trend_direction": "increasing"
    }
  ],
  "period": "7d",
  "total_trending": 15,
  "generated_at": "2024-01-15T18:00:00Z"
}
```

### GET /tags/analytics

Get comprehensive tag analytics and insights.

#### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `period` | string | "30d" | Analysis period |
| `category_id` | string | - | Filter by category |
| `include_correlations` | boolean | true | Include tag correlations |
| `include_trends` | boolean | true | Include trend analysis |

#### Response

```json
{
  "data": {
    "summary": {
      "total_tags": 1250,
      "active_tags": 987,
      "system_tags": 45,
      "suggested_tags": 156,
      "avg_usage_per_tag": 12.5,
      "total_associations": 15500
    },
    "top_tags": [
      {
        "id": "tag-popular1",
        "name": "error",
        "usage_count": 345,
        "association_count": 890
      }
    ],
    "category_distribution": [
      {
        "category_id": "cat-system",
        "category_name": "System",
        "tag_count": 125,
        "usage_percentage": 0.28
      }
    ],
    "growth_trends": [
      {
        "period": "2024-01-08",
        "new_tags": 5,
        "total_usage": 1250
      }
    ],
    "correlation_matrix": [
      {
        "tag1": "error",
        "tag2": "abend",
        "correlation": 0.75,
        "co_occurrence": 145
      }
    ],
    "unused_tags": [
      {
        "id": "tag-unused1",
        "name": "obsolete-tag",
        "days_since_use": 90
      }
    ],
    "generated_at": "2024-01-15T18:00:00Z",
    "analysis_period": "30d"
  }
}
```

### GET /tags/{id}/analytics

Get detailed analytics for a specific tag.

#### Response

```json
{
  "data": {
    "tag_id": "tag-123",
    "usage_count": 45,
    "entry_count": 38,
    "avg_relevance": 0.87,
    "success_rate": 0.92,
    "categories": [
      {
        "category_id": "cat-vsam",
        "category_name": "VSAM",
        "count": 25,
        "percentage": 0.66
      }
    ],
    "co_occurrence": [
      {
        "tag_id": "tag-related1",
        "tag_name": "vsam-error",
        "count": 15,
        "correlation": 0.68
      }
    ],
    "usage_timeline": [
      {
        "date": "2024-01-15",
        "usage_count": 5,
        "new_associations": 3
      }
    ],
    "trending": {
      "score": 85,
      "direction": "increasing",
      "growth_rate": 0.23
    },
    "last_updated": "2024-01-15T18:00:00Z"
  }
}
```

### POST /tags/normalize

Normalize and clean up tag data across the system.

#### Request Body

```json
{
  "operations": [
    "remove_duplicates",
    "normalize_names",
    "merge_similar",
    "remove_unused"
  ],
  "options": {
    "similarity_threshold": 0.9,
    "unused_days_threshold": 90,
    "dry_run": false
  }
}
```

#### Response

```json
{
  "operations_performed": [
    {
      "operation": "remove_duplicates",
      "items_processed": 15,
      "items_merged": 3
    },
    {
      "operation": "normalize_names",
      "items_processed": 1250,
      "items_updated": 45
    }
  ],
  "summary": {
    "total_tags_before": 1250,
    "total_tags_after": 1205,
    "tags_merged": 45,
    "tags_deleted": 12,
    "tags_updated": 67
  },
  "execution_time": 2500,
  "completed_at": "2024-01-15T19:00:00Z"
}
```

## Error Handling

### Standard Error Response

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Tag name already exists",
    "details": {
      "field": "name",
      "value": "existing-tag",
      "constraint": "unique"
    },
    "timestamp": "2024-01-15T18:00:00Z",
    "request_id": "req-123456"
  }
}
```

### Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `RESOURCE_NOT_FOUND` | 404 | Tag not found |
| `PERMISSION_DENIED` | 403 | Insufficient permissions |
| `CONFLICT` | 409 | Resource conflict (e.g., name already exists) |
| `ASSOCIATION_ERROR` | 400 | Tag association error |
| `SYSTEM_TAG_ERROR` | 403 | Cannot modify system tag |
| `BULK_OPERATION_ERROR` | 400 | Bulk operation validation failed |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `AI_SERVICE_ERROR` | 503 | AI suggestion service unavailable |
| `INTERNAL_ERROR` | 500 | Server error |

## Rate Limiting

API endpoints are rate-limited:

- **Standard endpoints**: 200 requests per minute per user
- **Search/suggestions**: 100 requests per minute per user
- **Bulk operations**: 10 requests per minute per user
- **Analytics**: 20 requests per minute per user

## SDK Examples

### JavaScript/TypeScript

```typescript
import { TagAPI } from '@mainframe-kb/api-client';

const tagApi = new TagAPI({
  baseURL: 'https://api.mainframe-kb.com/v1',
  apiKey: 'your-api-key'
});

// Search tags
const tags = await tagApi.search({
  query: 'error',
  fuzzy: true,
  limit: 10
});

// Get suggestions
const suggestions = await tagApi.getSuggestions({
  query: 'vsam file problem',
  contextEntryId: 'entry-123',
  limit: 5
});

// Create tag
const newTag = await tagApi.create({
  name: 'custom-error',
  displayName: 'Custom Error',
  categoryId: 'cat-system'
});

// Bulk assign tags
const result = await tagApi.bulkOperation({
  operation: 'assign',
  tags: [
    {
      id: 'tag-123',
      entryIds: ['entry-1', 'entry-2'],
      options: { relevanceScore: 0.8 }
    }
  ]
});

// Get analytics
const analytics = await tagApi.getAnalytics('tag-123');
```

### Python

```python
from mainframe_kb import TagAPI

tag_api = TagAPI(
    base_url='https://api.mainframe-kb.com/v1',
    api_key='your-api-key'
)

# Search tags
tags = tag_api.search(query='error', fuzzy=True, limit=10)

# Get suggestions
suggestions = tag_api.get_suggestions(
    query='vsam file problem',
    context_entry_id='entry-123',
    limit=5
)

# Create tag
new_tag = tag_api.create({
    'name': 'custom-error',
    'display_name': 'Custom Error',
    'category_id': 'cat-system'
})

# Associate tag with entry
tag_api.associate('tag-123', 'entry-456', relevance_score=0.9)
```

### cURL Examples

```bash
# Search tags
curl -X GET \
  "https://api.mainframe-kb.com/v1/tags/search?q=error&fuzzy=true&limit=10" \
  -H "Authorization: Bearer your-api-key" \
  -H "Accept: application/json"

# Get tag suggestions
curl -X GET \
  "https://api.mainframe-kb.com/v1/tags/suggestions?q=vsam%20file%20error&limit=5" \
  -H "Authorization: Bearer your-api-key" \
  -H "Accept: application/json"

# Create tag
curl -X POST \
  "https://api.mainframe-kb.com/v1/tags" \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "custom-error",
    "display_name": "Custom Error",
    "category_id": "cat-system"
  }'

# Bulk tag assignment
curl -X POST \
  "https://api.mainframe-kb.com/v1/tags/bulk" \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "operation": "assign",
    "tags": [
      {
        "id": "tag-123",
        "entry_ids": ["entry-1", "entry-2"]
      }
    ]
  }'
```

## Advanced Features

### AI-Powered Suggestions

The Tag API integrates with AI services to provide intelligent suggestions:

```typescript
// Enable AI suggestions with context
const suggestions = await tagApi.getSuggestions({
  query: 'VSAM file access error with status 35',
  contextEntryId: 'entry-vsam-issues',
  includeAI: true,
  minScore: 70
});

// Suggestions will include:
// - Existing tags with semantic similarity
// - AI-generated tags based on patterns
// - Context-aware recommendations
// - Confidence scores and reasoning
```

### Smart Tag Normalization

Automatic tag cleanup and normalization:

```typescript
// Normalize tags across the system
const result = await tagApi.normalize({
  operations: ['remove_duplicates', 'normalize_names', 'merge_similar'],
  options: {
    similarity_threshold: 0.85,
    unused_days_threshold: 60,
    dry_run: false
  }
});

// Results include detailed changes made
console.log(`Processed ${result.summary.total_tags_before} tags`);
console.log(`Merged ${result.summary.tags_merged} duplicates`);
```

### Real-time Analytics

Get real-time insights into tag usage:

```typescript
// Stream tag analytics
const analyticsStream = tagApi.streamAnalytics({
  period: '1h',
  categories: ['system', 'vsam'],
  metrics: ['usage_count', 'trending_score']
});

analyticsStream.on('data', (analytics) => {
  console.log('Current trending tags:', analytics.trending);
  console.log('Usage spikes detected:', analytics.spikes);
});
```

## Changelog

### v1.3.0 (2024-01-15)
- Added AI-powered tag suggestions
- Enhanced analytics with correlation analysis
- Added tag normalization endpoints
- Improved bulk operations performance

### v1.2.0 (2024-01-01)
- Added trending tags endpoint
- Enhanced search with semantic matching
- Added tag association management
- Improved error handling

### v1.1.0 (2023-12-15)
- Added bulk operations support
- Enhanced analytics endpoints
- Added fuzzy search capabilities
- Improved pagination

### v1.0.0 (2023-12-01)
- Initial release
- Basic CRUD operations
- Tag search and suggestions
- Entry associations