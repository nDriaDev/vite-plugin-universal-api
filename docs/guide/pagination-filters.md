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
// import mockApi from '@ndriadev/vite-plugin-universal-api' //Default export
import { universalApi } from '@ndriadev/vite-plugin-universal-api' // Named export

export default defineConfig({
  plugins: [
    universalApi({
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
X-Total-Count: 150
Content-Length: 1234

[
  {"id": 21, "name": "User 21"},
  {"id": 22, "name": "User 22"},
  ...
]
```

**Headers:**
- `X-Total-Count`: Total count before pagination
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
        valueType: 'string',    // Data type
        comparison: 'eq'        // Comparison operator
      },
      {
        key: 'minAge',
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
| `ne` | Not equals | `status=inactive` → status != 'inactive' |
| `gt` | Greater than | `age=18` → age > 18 |
| `gte` | Greater than or equal | `age=18` → age >= 18 |
| `lt` | Less than | `age=65` → age < 65 |
| `lte` | Less than or equal | `age=65` → age <= 65 |
| `in` | Value in array | `id=1,2,3` → id in [1,2,3] |
| `nin` | Value not in array | `id=4,5` → id not in [4,5] |
| `regex` | Regular expression match | `name=^John` → name matches /^John/ (use `regexFlags` for flags) |

### Value Types

Specify data type for proper comparison:

```typescript
valueType: 'string'   // String comparison
valueType: 'number'   // Numeric comparison
valueType: 'boolean'  // Boolean comparison
valueType: 'date'   // Date comparison
valueType: 'string[]'   // String array comparison
valueType: 'number[]'   // Numeric array comparison
valueType: 'boolean[]'  // Boolean array comparison
valueType: 'date[]'   // Date array comparison
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

::: warning key maps to both the query param AND the JSON field
The `key` value is used for two purposes simultaneously: it is the name of the query parameter (or body field) read from the request, **and** the name of the field looked up on each item in the JSON array. This means the parameter name must match the field name in your data.

```typescript
// ✅ Correct: query param 'age' → filters on item.age in JSON
{ key: 'age', valueType: 'number', comparison: 'gte' }
// Request: GET /api/users?age=18
// Data:    [{ "id": 1, "age": 30 }, { "id": 2, "age": 15 }]
// Result:  [{ "id": 1, "age": 30 }]

// ❌ Wrong: query param 'minAge' would look for item.minAge in JSON, not item.age
{ key: 'minAge', valueType: 'number', comparison: 'gte' }
// Request: GET /api/users?minAge=18
// Data:    [{ "id": 1, "age": 30 }]
// Result:  [] — no item has a 'minAge' field
```
:::

```typescript
filters: [
  {
    key: 'age',           // query param: ?age=18  →  filters on item.age
    valueType: 'number',
    comparison: 'gte'
  },
  {
    key: 'age',           // query param: ?age=65  →  filters on item.age
    valueType: 'number',
    comparison: 'lte'
  }
]
```

```bash
GET /api/users?age=18   # items where age >= 18
# To combine gte + lte on the same field, define two filter entries with the same key
# but different comparison operators (not supported directly — use a custom handler instead)
```

#### Array Filters

```typescript
filters: [
  {
    key: 'ids',
    valueType: 'number',
    comparison: 'in'
  }
]
```

```bash
GET /api/users?ids=1,2,3,5,8
# Returns users where id in [1,2,3,5,8]
```

## Combining Pagination & Filters

```typescript
universalApi({
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
        { key: 'minAge', valueType: 'number', comparison: 'gte' }
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
4. Return data with `X-Total-Count` header

## Per-Handler Configuration

Override global config for specific handlers:

```typescript
universalApi({
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
      { key: 'q', valueType: 'string', comparison: 'eq' }
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

::: warning Same field, two filters
To filter a range on a single numeric field (e.g. `price`), define two separate filter entries with the same `key` (matching the JSON field name) and different comparison operators. The query parameter name must match the JSON field name.
:::

```typescript
filters: {
  GET: {
    type: 'query-param',
    filters: [
      { key: 'price', valueType: 'number', comparison: 'gte' },
      { key: 'price', valueType: 'number', comparison: 'lte' }
    ]
  }
}
```

```bash
# This only works if you pass the same param twice, which is not standard.
# For independent min/max query params, use a custom handler instead.
GET /api/products?price=10   # items where price >= 10 (only gte applied)
```

::: tip For true range filters (minPrice / maxPrice), use a custom handler
```typescript
{
  pattern: '/products',
  method: 'GET',
  handle: async (req, res) => {
    const data = JSON.parse(await fs.readFile('mock/products.json', 'utf-8'))
    const min = Number(req.query.get('minPrice') ?? 0)
    const max = Number(req.query.get('maxPrice') ?? Infinity)
    const result = data.filter((p: any) => p.price >= min && p.price <= max)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(result))
  }
}
```
:::

## Limitations

- ❌ Only works with file-based endpoints
- ❌ Only works with JSON arrays (not objects)
- ❌ Does NOT work with custom handlers (must implement manually)
- ❌ No OR logic between filters (only AND)
- ✅ Nested field filtering is supported via dot-notation (e.g., `key: 'address.city'` filters on `item.address.city`)

## Next Steps

- [File-System API](/guide/file-system-api) - Complete FS guide
- [HTTP Methods](/api/http-methods) - Method behavior reference
- [Examples](/examples/file-based) - Practical examples
