# Categorization API Reference

## Overview

The Categorization API provides comprehensive endpoints for managing hierarchical categories within the Mainframe Knowledge Base Assistant. This API supports creating, reading, updating, and deleting categories with full hierarchy management.

## Base URL

```
/api/v1/categories
```

## Authentication

All API endpoints require authentication via Bearer token:

```http
Authorization: Bearer <your-api-token>
```

## Category Data Model

### CategoryNode

```typescript
interface CategoryNode {
  id: string;                    // Unique identifier (UUID)
  name: string;                  // Category name (2-50 characters)
  slug: string;                  // URL-friendly identifier
  description?: string;          // Optional description
  parent_id?: string;           // Parent category ID (null for root)
  level: number;                // Hierarchy level (0-5)
  sort_order: number;           // Display order within parent
  icon?: string;                // Display icon (emoji or class)
  color?: string;               // Hex color code
  is_active: boolean;           // Category status
  is_system: boolean;           // System-managed flag
  entry_count?: number;         // Number of associated entries
  child_count?: number;         // Number of child categories
  usage_count?: number;         // Usage frequency
  trending_score?: number;      // Trending indicator (0-100)
  created_at: string;           // ISO 8601 timestamp
  updated_at: string;           // ISO 8601 timestamp
  created_by: string;           // User ID
}
```

### CategoryTree

```typescript
interface CategoryTree extends CategoryNode {
  children: CategoryTree[];     // Child categories
  depth: number;               // Current depth in tree
  path: string[];              // Full path from root
  breadcrumbs: Breadcrumb[];   // Navigation breadcrumbs
  expanded?: boolean;          // UI expansion state
}

interface Breadcrumb {
  id: string;
  name: string;
  slug: string;
}
```

## Endpoints

### GET /categories

Retrieve all categories with optional filtering.

#### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `include_inactive` | boolean | false | Include inactive categories |
| `include_system` | boolean | true | Include system categories |
| `max_depth` | number | 5 | Maximum hierarchy depth |
| `parent_id` | string | null | Filter by parent category |
| `with_stats` | boolean | false | Include usage statistics |
| `page` | number | 1 | Page number (1-based) |
| `limit` | number | 50 | Items per page (1-100) |

#### Request Example

```http
GET /api/v1/categories?include_inactive=false&with_stats=true&limit=20
Accept: application/json
Authorization: Bearer <token>
```

#### Response

```json
{
  "data": [
    {
      "id": "cat-123",
      "name": "JCL",
      "slug": "jcl",
      "description": "Job Control Language procedures and utilities",
      "parent_id": null,
      "level": 0,
      "sort_order": 1,
      "icon": "📋",
      "color": "#3498db",
      "is_active": true,
      "is_system": true,
      "entry_count": 45,
      "child_count": 3,
      "usage_count": 128,
      "trending_score": 75,
      "created_at": "2024-01-15T10:00:00Z",
      "updated_at": "2024-01-15T15:30:00Z",
      "created_by": "system"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 15,
    "pages": 1
  },
  "meta": {
    "query_time": 12,
    "filters_applied": {
      "active_only": true,
      "with_stats": true
    }
  }
}
```

### GET /categories/tree

Retrieve the complete category hierarchy as a tree structure.

#### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `include_inactive` | boolean | false | Include inactive categories |
| `include_system` | boolean | true | Include system categories |
| `max_depth` | number | 5 | Maximum tree depth |
| `expanded_ids` | string[] | [] | Pre-expanded category IDs |
| `with_stats` | boolean | false | Include statistics |

#### Request Example

```http
GET /api/v1/categories/tree?max_depth=3&with_stats=true
Accept: application/json
Authorization: Bearer <token>
```

#### Response

```json
{
  "data": [
    {
      "id": "cat-123",
      "name": "JCL",
      "slug": "jcl",
      "description": "Job Control Language",
      "parent_id": null,
      "level": 0,
      "sort_order": 1,
      "icon": "📋",
      "color": "#3498db",
      "is_active": true,
      "is_system": true,
      "entry_count": 45,
      "child_count": 3,
      "children": [
        {
          "id": "cat-456",
          "name": "Job Submission",
          "slug": "job-submission",
          "parent_id": "cat-123",
          "level": 1,
          "entry_count": 15,
          "children": [],
          "depth": 1,
          "path": ["JCL", "Job Submission"],
          "breadcrumbs": [
            { "id": "cat-123", "name": "JCL", "slug": "jcl" }
          ]
        }
      ],
      "depth": 0,
      "path": ["JCL"],
      "breadcrumbs": []
    }
  ],
  "meta": {
    "total_categories": 15,
    "max_depth": 3,
    "query_time": 8
  }
}
```

### GET /categories/{id}

Retrieve a specific category by ID.

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Category UUID (required) |
| `include_children` | boolean | Include direct children |
| `include_ancestors` | boolean | Include ancestor path |
| `with_stats` | boolean | Include statistics |

#### Request Example

```http
GET /api/v1/categories/cat-123?include_children=true&with_stats=true
Accept: application/json
Authorization: Bearer <token>
```

#### Response

```json
{
  "data": {
    "id": "cat-123",
    "name": "JCL",
    "slug": "jcl",
    "description": "Job Control Language procedures and utilities",
    "parent_id": null,
    "level": 0,
    "sort_order": 1,
    "icon": "📋",
    "color": "#3498db",
    "is_active": true,
    "is_system": true,
    "entry_count": 45,
    "child_count": 3,
    "usage_count": 128,
    "trending_score": 75,
    "created_at": "2024-01-15T10:00:00Z",
    "updated_at": "2024-01-15T15:30:00Z",
    "created_by": "system",
    "children": [
      {
        "id": "cat-456",
        "name": "Job Submission",
        "slug": "job-submission",
        "entry_count": 15
      }
    ],
    "ancestors": []
  }
}
```

### POST /categories

Create a new category.

#### Request Body

```json
{
  "name": "Error Handling",
  "slug": "error-handling",
  "description": "Error handling procedures and solutions",
  "parent_id": "cat-123",
  "icon": "⚠️",
  "color": "#e74c3c",
  "sort_order": 10,
  "is_active": true
}
```

#### Validation Rules

- `name`: Required, 2-50 characters, unique within parent
- `slug`: Auto-generated if not provided, must be unique globally
- `description`: Optional, max 500 characters
- `parent_id`: Must exist and be active
- `sort_order`: Defaults to 0
- `icon`: Optional emoji or icon class
- `color`: Optional hex color code
- Maximum hierarchy depth: 5 levels

#### Response

```json
{
  "data": {
    "id": "cat-789",
    "name": "Error Handling",
    "slug": "error-handling",
    "description": "Error handling procedures and solutions",
    "parent_id": "cat-123",
    "level": 1,
    "sort_order": 10,
    "icon": "⚠️",
    "color": "#e74c3c",
    "is_active": true,
    "is_system": false,
    "entry_count": 0,
    "child_count": 0,
    "usage_count": 0,
    "created_at": "2024-01-15T16:00:00Z",
    "updated_at": "2024-01-15T16:00:00Z",
    "created_by": "user-456"
  }
}
```

### PATCH /categories/{id}

Update an existing category.

#### Request Body

```json
{
  "name": "Updated Error Handling",
  "description": "Updated description",
  "parent_id": "cat-456",
  "icon": "🚨",
  "color": "#ff6b35",
  "sort_order": 5,
  "is_active": false
}
```

#### Business Rules

- System categories (`is_system: true`) have limited update permissions
- Cannot create circular references in hierarchy
- Moving categories updates all descendant levels
- Slug is auto-updated when name changes (if not manually set)

#### Response

```json
{
  "data": {
    "id": "cat-789",
    "name": "Updated Error Handling",
    "slug": "updated-error-handling",
    "description": "Updated description",
    "parent_id": "cat-456",
    "level": 2,
    "sort_order": 5,
    "icon": "🚨",
    "color": "#ff6b35",
    "is_active": false,
    "updated_at": "2024-01-15T16:30:00Z"
  }
}
```

### DELETE /categories/{id}

Delete a category.

#### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `force` | boolean | false | Force delete system categories |

#### Business Rules

- Cannot delete categories with child categories
- Cannot delete categories with associated KB entries
- Cannot delete system categories (unless `force=true`)
- Deletion is permanent (hard delete)

#### Request Example

```http
DELETE /api/v1/categories/cat-789?force=false
Authorization: Bearer <token>
```

#### Response

```json
{
  "message": "Category deleted successfully",
  "deleted_at": "2024-01-15T17:00:00Z"
}
```

### POST /categories/{id}/move

Move a category to a new parent.

#### Request Body

```json
{
  "new_parent_id": "cat-456",
  "new_sort_order": 3
}
```

#### Business Rules

- Cannot move to self or descendant (circular reference prevention)
- Cannot exceed maximum depth (5 levels)
- Updates all descendant category levels
- Recalculates sort orders if needed

#### Response

```json
{
  "data": {
    "id": "cat-789",
    "parent_id": "cat-456",
    "level": 2,
    "sort_order": 3,
    "updated_at": "2024-01-15T17:15:00Z"
  },
  "affected_descendants": 5
}
```

### POST /categories/reorder

Reorder categories within the same parent.

#### Request Body

```json
{
  "parent_id": "cat-123",
  "category_ids": [
    "cat-456",
    "cat-789",
    "cat-101112"
  ]
}
```

#### Response

```json
{
  "message": "Categories reordered successfully",
  "updated_categories": [
    {
      "id": "cat-456",
      "sort_order": 0
    },
    {
      "id": "cat-789",
      "sort_order": 1
    },
    {
      "id": "cat-101112",
      "sort_order": 2
    }
  ]
}
```

### GET /categories/{id}/children

Get direct children of a category.

#### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `include_inactive` | boolean | false | Include inactive categories |
| `with_stats` | boolean | false | Include statistics |
| `sort_by` | string | "sort_order" | Sort field |
| `sort_order` | string | "asc" | Sort direction |

#### Response

```json
{
  "data": [
    {
      "id": "cat-456",
      "name": "Job Submission",
      "slug": "job-submission",
      "parent_id": "cat-123",
      "level": 1,
      "sort_order": 0,
      "entry_count": 15,
      "child_count": 2
    }
  ],
  "parent": {
    "id": "cat-123",
    "name": "JCL",
    "slug": "jcl"
  }
}
```

### GET /categories/{id}/ancestors

Get the ancestor path for a category (breadcrumb trail).

#### Response

```json
{
  "data": [
    {
      "id": "cat-123",
      "name": "JCL",
      "slug": "jcl",
      "level": 0
    },
    {
      "id": "cat-456",
      "name": "Job Submission",
      "slug": "job-submission",
      "level": 1
    }
  ],
  "category": {
    "id": "cat-789",
    "name": "Error Handling",
    "level": 2
  }
}
```

### GET /categories/{id}/descendants

Get all descendants of a category (complete subtree).

#### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `max_depth` | number | 5 | Maximum depth from category |
| `include_inactive` | boolean | false | Include inactive categories |
| `flat` | boolean | false | Return flat list instead of tree |

#### Response (Tree Structure)

```json
{
  "data": {
    "id": "cat-123",
    "name": "JCL",
    "children": [
      {
        "id": "cat-456",
        "name": "Job Submission",
        "children": [
          {
            "id": "cat-789",
            "name": "Error Handling",
            "children": []
          }
        ]
      }
    ]
  },
  "total_descendants": 2,
  "max_depth": 2
}
```

### POST /categories/bulk

Perform bulk operations on multiple categories.

#### Request Body

```json
{
  "operation": "move",
  "categories": [
    {
      "id": "cat-456",
      "target_parent_id": "cat-new-parent"
    },
    {
      "id": "cat-789",
      "target_parent_id": "cat-new-parent"
    }
  ],
  "options": {
    "validate_only": false,
    "continue_on_error": true
  }
}
```

#### Supported Operations

| Operation | Description | Required Fields |
|-----------|-------------|-----------------|
| `create` | Create multiple categories | `data` |
| `update` | Update multiple categories | `id`, `data` |
| `delete` | Delete multiple categories | `id` |
| `move` | Move multiple categories | `id`, `target_parent_id` |
| `reorder` | Reorder multiple categories | `id`, `new_sort_order` |
| `activate` | Activate multiple categories | `id` |
| `deactivate` | Deactivate multiple categories | `id` |

#### Response

```json
{
  "operation": "move",
  "total_items": 2,
  "successful": 2,
  "failed": 0,
  "errors": [],
  "results": [
    {
      "id": "cat-456",
      "status": "success",
      "data": {
        "id": "cat-456",
        "parent_id": "cat-new-parent",
        "level": 1
      }
    }
  ],
  "execution_time": 150,
  "transaction_id": "bulk-456789"
}
```

### GET /categories/{id}/analytics

Get detailed analytics for a category.

#### Response

```json
{
  "data": {
    "category_id": "cat-123",
    "entry_count": 45,
    "view_count": 1250,
    "search_count": 380,
    "success_rate": 0.87,
    "avg_resolution_time": 285,
    "top_tags": [
      {
        "tag_id": "tag-456",
        "tag_name": "jcl-error",
        "count": 12
      }
    ],
    "trending": {
      "period": "7d",
      "growth": 0.15,
      "score": 75
    },
    "usage_by_day": [
      {
        "date": "2024-01-15",
        "views": 45,
        "searches": 12
      }
    ],
    "last_updated": "2024-01-15T18:00:00Z"
  }
}
```

## Error Handling

### Standard Error Response

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Category name already exists",
    "details": {
      "field": "name",
      "value": "JCL",
      "constraint": "unique_within_parent"
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
| `RESOURCE_NOT_FOUND` | 404 | Category not found |
| `PERMISSION_DENIED` | 403 | Insufficient permissions |
| `CONFLICT` | 409 | Resource conflict (e.g., name already exists) |
| `HIERARCHY_ERROR` | 400 | Hierarchy constraint violation |
| `SYSTEM_CATEGORY_ERROR` | 403 | Cannot modify system category |
| `DEPENDENCY_ERROR` | 400 | Cannot delete category with dependencies |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

## Rate Limiting

API endpoints are rate-limited to ensure system stability:

- **Standard endpoints**: 100 requests per minute per user
- **Bulk operations**: 10 requests per minute per user
- **Analytics endpoints**: 20 requests per minute per user

Rate limit headers are included in all responses:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642251600
```

## Caching

Response caching headers are included where appropriate:

```http
Cache-Control: public, max-age=300
ETag: "category-123-v2"
Last-Modified: Wed, 15 Jan 2024 18:00:00 GMT
```

## SDK Examples

### JavaScript/TypeScript

```typescript
import { CategoryAPI } from '@mainframe-kb/api-client';

const categoryApi = new CategoryAPI({
  baseURL: 'https://api.mainframe-kb.com/v1',
  apiKey: 'your-api-key'
});

// Get category tree
const tree = await categoryApi.getTree({
  maxDepth: 3,
  withStats: true
});

// Create category
const newCategory = await categoryApi.create({
  name: 'New Category',
  parentId: 'parent-123',
  description: 'Category description'
});

// Bulk operations
const result = await categoryApi.bulkOperation({
  operation: 'move',
  categories: [
    { id: 'cat-1', targetParentId: 'new-parent' },
    { id: 'cat-2', targetParentId: 'new-parent' }
  ]
});
```

### Python

```python
from mainframe_kb import CategoryAPI

category_api = CategoryAPI(
    base_url='https://api.mainframe-kb.com/v1',
    api_key='your-api-key'
)

# Get category tree
tree = category_api.get_tree(max_depth=3, with_stats=True)

# Create category
new_category = category_api.create({
    'name': 'New Category',
    'parent_id': 'parent-123',
    'description': 'Category description'
})

# Get analytics
analytics = category_api.get_analytics('cat-123')
```

### cURL Examples

```bash
# Get category tree
curl -X GET \
  "https://api.mainframe-kb.com/v1/categories/tree?max_depth=3&with_stats=true" \
  -H "Authorization: Bearer your-api-key" \
  -H "Accept: application/json"

# Create category
curl -X POST \
  "https://api.mainframe-kb.com/v1/categories" \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Category",
    "parent_id": "parent-123",
    "description": "Category description"
  }'

# Bulk move categories
curl -X POST \
  "https://api.mainframe-kb.com/v1/categories/bulk" \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "operation": "move",
    "categories": [
      {
        "id": "cat-456",
        "target_parent_id": "new-parent"
      }
    ]
  }'
```

## Changelog

### v1.2.0 (2024-01-15)
- Added bulk operations endpoint
- Enhanced analytics with trending data
- Added category reordering API
- Improved error handling and validation

### v1.1.0 (2024-01-01)
- Added category analytics endpoint
- Added support for category icons and colors
- Improved hierarchy management
- Added rate limiting

### v1.0.0 (2023-12-01)
- Initial release
- Basic CRUD operations
- Hierarchy management
- Tree structure support