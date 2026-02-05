# Pagination & Filters

Advanced data querying for file-based endpoints returning JSON arrays.

## Overview

Pagination and filtering work **only** with:
- ✅ File-based endpoints
- ✅ Files containing JSON arrays
- ✅ Methods: GET, POST, HEAD, DELETE
- ❌ Custom handlers (unless manually implemented)
- ❌ JSON objects (not arrays)
- ❌ Non-JSON files

## Pagination

### Configuration

```typescript
import { defineConfig } from 'vite'
import mockApi from '@ndriadev/vite-plugin-universal-api'

export default defineConfig({
  plugins: [
    mockApi({
      endpointPrefix: '/api',
      fsDir: 'mock',

      pagination: {
        GET: {
          type: 'query-param',  // or 'body'
          limit: 'limit',       // Query param name
          skip: 'skip',         // Query param name
          sort: 'sortBy',       // Query param name
          order: 'order'        // Query param name
        }
      }
    })
  ]
})
```

### Query Param Type

Send pagination parameters in URL query string:

```bash
GET /api/users?limit=10&skip=20&sortBy=name&order=asc
```

**Configuration:**
```typescript
pagination: {
  GET: {
    type: 'query-param',
    limit: 'limit',
    skip: 'skip',
    sort: 'sortBy',
    order: 'order'
  }
}
```

### Body Type

Send pagination parameters in request body:

```bash
POST /api/users
Content-Type: application/json

{
  "pagination": {
    "limit": 10,
    "skip": 20,
    "sortBy": "name",
    "order": "asc"
  }
}
```

**Configuration:**
```typescript
pagination: {
  POST: {
    type: 'body',
    root: 'pagination',  // Root key in body
    limit: 'limit',
    skip: 'skip',
    sort: 'sortBy',
    order: 'order'
  }
}
```

### Pagination Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `limit` | number | Max items to return | `10` |
| `skip` | number | Items to skip | `20` |
| `sort` | string | Field to sort by | `name` |
| `order` | string | Sort order | `asc` or `desc` |

### Response Format

The response includes pagination metadata in headers:

```
HTTP/1.1 200 OK
Content-Type: application/json
X-Total-Elements: 150
Content-Length: 1234

[
  {"id": 21, "name": "User 21"},
  {"id": 22, "name": "User 22"},
  ...
]
```

**Headers:**
- `X-Total-Elements`: Total count before pagination
- `Content-Length`: Response body size

### Examples

#### Basic Pagination

```bash
# Get first 10 users
GET /api/users?limit=10&skip=0

# Get next 10 users
GET /api/users?limit=10&skip=10

# Get users 21-30
GET /api/users?limit=10&skip=20
```

#### With Sorting

```bash
# Sort by name ascending
GET /api/users?limit=10&skip=0&sortBy=name&order=asc

# Sort by age descending
GET /api/users?limit=10&skip=0&sortBy=age&order=desc

# Sort by createdAt descending (most recent first)
GET /api/users?sortBy=createdAt&order=desc
```

#### Default Values

If not provided, defaults apply:
- `limit`: All items (no limit)
- `skip`: 0
- `sort`: No sorting (original order)
- `order`: `asc`

## Filters

### Configuration

```typescript
filters: {
  GET: {
    type: 'query-param',
    filters: [
      {
        key: 'status',          // Query param name
        field: 'status',        // Field in data (optional, defaults to key)
        valueType: 'string',    // Data type
        comparison: 'eq'        // Comparison operator
      },
      {
        key: 'minAge',
        field: 'age',
        valueType: 'number',
        comparison: 'gte'
      }
    ]
  }
}
```

### Query Param Type

```bash
GET /api/users?status=active&minAge=18
```

### Body Type

```bash
POST /api/users
Content-Type: application/json

{
  "filters": {
    "status": "active",
    "minAge": 18
  }
}
```

**Configuration:**
```typescript
filters: {
  POST: {
    type: 'body',
    root: 'filters',  // Root key in body
    filters: [...]
  }
}
```

### Comparison Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `eq` | Equals | `status=active` → status == 'active' |
| `neq` | Not equals | `status=inactive` → status != 'inactive' |
| `gt` | Greater than | `age=18` → age > 18 |
| `gte` | Greater than or equal | `age=18` → age >= 18 |
| `lt` | Less than | `age=65` → age < 65 |
| `lte` | Less than or equal | `age=65` → age <= 65 |
| `in` | Value in array | `id=1,2,3` → id in [1,2,3] |
| `nin` | Value not in array | `id=4,5` → id not in [4,5] |
| `contains` | String contains (case-insensitive) | `name=john` → name includes 'john' |

### Value Types

Specify data type for proper comparison:

```typescript
valueType: 'string'   // String comparison
valueType: 'number'   // Numeric comparison
valueType: 'boolean'  // Boolean comparison
```

### Filter Examples

#### String Filters

```typescript
filters: [
  {
    key: 'status',
    valueType: 'string',
    comparison: 'eq'
  }
]
```

```bash
GET /api/users?status=active
# Returns users where status === 'active'
```

#### Numeric Filters

```typescript
filters: [
  {
    key: 'minAge',
    field: 'age',
    valueType: 'number',
    comparison: 'gte'
  },
  {
    key: 'maxAge',
    field: 'age',
    valueType: 'number',
    comparison: 'lte'
  }
]
```

```bash
GET /api/users?minAge=18&maxAge=65
# Returns users where age >= 18 AND age <= 65
```

#### Array Filters

```typescript
filters: [
  {
    key: 'ids',
    field: 'id',
    valueType: 'number',
    comparison: 'in'
  }
]
```

```bash
GET /api/users?ids=1,2,3,5,8
# Returns users where id in [1,2,3,5,8]
```

#### Contains Filter

```typescript
filters: [
  {
    key: 'search',
    field: 'name',
    valueType: 'string',
    comparison: 'contains'
  }
]
```

```bash
GET /api/users?search=john
# Returns users where name contains 'john' (case-insensitive)
```

## Combining Pagination & Filters

```typescript
mockApi({
  pagination: {
    GET: {
      type: 'query-param',
      limit: 'limit',
      skip: 'skip',
      sort: 'sortBy',
      order: 'order'
    }
  },

  filters: {
    GET: {
      type: 'query-param',
      filters: [
        { key: 'status', valueType: 'string', comparison: 'eq' },
        { key: 'minAge', field: 'age', valueType: 'number', comparison: 'gte' }
      ]
    }
  }
})
```

**Usage:**
```bash
GET /api/users?status=active&minAge=18&limit=10&skip=0&sortBy=name&order=asc
```

**Processing order:**
1. Apply filters → Get matching items
2. Sort results
3. Apply pagination → Return subset
4. Return data with `X-Total-Elements` header

## Per-Handler Configuration

Override global config for specific handlers:

```typescript
mockApi({
  // Global config
  pagination: {
    GET: {
      type: 'query-param',
      limit: 'limit',
      skip: 'skip'
    }
  },

  handlers: [
    {
      pattern: '/users',
      method: 'GET',
      handle: 'FS',

      // Override for this handler
      pagination: {
        type: 'query-param',
        limit: 'pageSize',    // Different param name
        skip: 'offset',       // Different param name
        sort: 'orderBy',
        order: 'direction'
      },

      filters: {
        type: 'query-param',
        filters: [
          { key: 'role', valueType: 'string', comparison: 'eq' }
        ]
      }
    }
  ]
})
```

**Usage:**
```bash
GET /api/users?role=admin&pageSize=20&offset=0&orderBy=createdAt&direction=desc
```

## Data Requirements

### JSON Array Required

```json
// ✅ Works - JSON array
[
  {"id": 1, "name": "John"},
  {"id": 2, "name": "Jane"}
]

// ❌ Does NOT work - JSON object
{
  "users": [
    {"id": 1, "name": "John"}
  ]
}
```

### Field Existence

Filter fields must exist in data:

```json
// Data
[
  {"id": 1, "name": "John", "age": 30},
  {"id": 2, "name": "Jane"}  // Missing 'age'
]
```

```bash
GET /api/users?minAge=25
# Returns: [{"id": 1, "name": "John", "age": 30}]
# Jane is excluded (age field missing)
```

## Advanced Examples

### Search with Pagination

```typescript
filters: {
  GET: {
    type: 'query-param',
    filters: [
      { key: 'q', field: 'name', valueType: 'string', comparison: 'contains' }
    ]
  }
},
pagination: {
  GET: {
    type: 'query-param',
    limit: 'limit',
    skip: 'skip'
  }
}
```

```bash
GET /api/users?q=john&limit=10&skip=0
# Search for 'john', return first 10 results
```

### Multiple Filters

```typescript
filters: {
  GET: {
    type: 'query-param',
    filters: [
      { key: 'status', valueType: 'string', comparison: 'eq' },
      { key: 'role', valueType: 'string', comparison: 'eq' },
      { key: 'verified', valueType: 'boolean', comparison: 'eq' }
    ]
  }
}
```

```bash
GET /api/users?status=active&role=admin&verified=true
# All filters must match (AND logic)
```

### Range Queries

```typescript
filters: {
  GET: {
    type: 'query-param',
    filters: [
      { key: 'minPrice', field: 'price', valueType: 'number', comparison: 'gte' },
      { key: 'maxPrice', field: 'price', valueType: 'number', comparison: 'lte' }
    ]
  }
}
```

```bash
GET /api/products?minPrice=10&maxPrice=100
# Returns products where 10 <= price <= 100
```

## Limitations

- ❌ Only works with file-based endpoints
- ❌ Only works with JSON arrays (not objects)
- ❌ Does NOT work with custom handlers (must implement manually)
- ❌ No OR logic between filters (only AND)
- ❌ No nested field filtering (e.g., `user.address.city`)

## Next Steps

- [File-System API](/guide/file-system-api) - Complete FS guide
- [HTTP Methods](/api/http-methods) - Method behavior reference
- [Examples](/examples/file-based) - Practical examples
