# File-System API

The File-System API is the simplest way to serve mock data. Just point to a directory and VitePress automatically serves files as API endpoints.

## Overview

With File-System API, your directory structure becomes your API:

```
mock/
├── users.json          → GET /api/users
├── posts/
│   └── index.json      → GET /api/posts
└── products/
    ├── 1.json          → GET /api/products/1
    └── 2.json          → GET /api/products/2
```

## Basic Setup

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import mockApi from '@ndriadev/vite-plugin-universal-api'

export default defineConfig({
  plugins: [
    mockApi({
      endpointPrefix: '/api',
      fsDir: 'mock'  // Points to ./mock directory
    })
  ]
})
```

## File Lookup Strategy

When a request comes in, the plugin tries multiple strategies to find the file:

### 1. Exact File Match

```
Request: GET /api/users
Looks for: mock/users (exact match)
```

### 2. Directory with index.json

```
Request: GET /api/posts
Looks for: mock/posts/index.json
```

### 3. File with Extension

```
Request: GET /api/data
Looks for:
  - mock/data.json
  - mock/data.xml
  - mock/data.txt
  (any extension)
```

## Supported HTTP Methods

### GET - Retrieve Data

```bash
GET /api/users
```

Returns the entire file content.

**With Pagination:**
```bash
GET /api/users?limit=10&skip=0&sortBy=name&order=asc
```

**With Filters:**
```bash
GET /api/users?status=active&minAge=18
```

### POST - Create or Query

**Create new resource (file doesn't exist):**
```bash
POST /api/users/123
Content-Type: application/json

{"name": "John", "email": "john@example.com"}
```

Creates `mock/users/123.json`

**Query existing data (file exists + pagination/filters):**
```bash
POST /api/users?status=active&limit=10
```

Returns filtered data without modifying the file.

### PUT - Create or Replace

```bash
PUT /api/users/123
Content-Type: application/json

{"name": "John Updated"}
```

- Creates file if doesn't exist (201)
- Replaces entire file if exists (200)

### PATCH - Partial Update

Only works with JSON files.

**Merge Patch:**
```bash
PATCH /api/users/123
Content-Type: application/json

{"email": "newemail@example.com"}
```

**JSON Patch (RFC 6902):**
```bash
PATCH /api/users/123
Content-Type: application/json-patch+json

[
  {"op": "replace", "path": "/email", "value": "new@example.com"},
  {"op": "add", "path": "/phone", "value": "555-1234"}
]
```

### DELETE - Remove Data

**Delete entire file:**
```bash
DELETE /api/users/123
```

**Partial delete (with filters on JSON arrays):**
```bash
DELETE /api/users?status=inactive
```

Removes matching items from array.

## Pagination

Enable pagination in configuration:

```typescript
mockApi({
  endpointPrefix: '/api',
  fsDir: 'mock',
  pagination: {
    GET: {
      type: 'query-param',
      limit: 'limit',
      skip: 'skip',
      sort: 'sortBy',
      order: 'order'
    }
  }
})
```

**Usage:**
```bash
GET /api/users?limit=10&skip=20&sortBy=name&order=desc
```

**Requirements:**
- ✅ File must contain JSON array
- ✅ Method must be GET, POST, HEAD, or DELETE
- ❌ Does NOT work with JSON objects or non-JSON files

## Filters

Enable filtering in configuration:

```typescript
mockApi({
  filters: {
    GET: {
      type: 'query-param',
      filters: [
        {
          key: 'status',
          valueType: 'string',
          comparison: 'eq'
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
})
```

**Usage:**
```bash
GET /api/users?status=active&minAge=18
```

**Comparison Operators:**
- `eq` - equals
- `neq` - not equals
- `gt` - greater than
- `gte` - greater than or equal
- `lt` - less than
- `lte` - less than or equal
- `in` - value in array
- `nin` - value not in array
- `contains` - string contains (case-insensitive)

## File Upload

**Single file upload:**
```bash
POST /api/documents/report
Content-Type: multipart/form-data

(file data)
```

**⚠️ Important:** Only the FIRST file is written. Multiple files are not supported.

## Examples

### Simple JSON Data

```json
// mock/users.json
[
  {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "status": "active"
  },
  {
    "id": 2,
    "name": "Jane Smith",
    "email": "jane@example.com",
    "status": "active"
  }
]
```

```bash
# Get all users
GET /api/users

# Get paginated users
GET /api/users?limit=10&skip=0

# Get active users only
GET /api/users?status=active
```

### Nested Resources

```
mock/
├── users/
│   ├── 1.json
│   ├── 2.json
│   └── 3.json
└── posts/
    └── user-1/
        ├── 1.json
        └── 2.json
```

```bash
GET /api/users/1           → mock/users/1.json
GET /api/posts/user-1/1    → mock/posts/user-1/1.json
```

### Binary Files

```
mock/
├── images/
│   └── logo.png
└── documents/
    └── report.pdf
```

```bash
GET /api/images/logo       → Returns logo.png
GET /api/documents/report  → Returns report.pdf
```

## Best Practices

### 1. Organize by Resource

```
mock/
├── users/
├── posts/
├── products/
└── orders/
```

### 2. Use index.json for Collections

```
mock/
└── users/
    └── index.json    # List of all users
```

### 3. Individual Resources

```
mock/
└── users/
    ├── index.json    # All users
    ├── 1.json        # User 1
    ├── 2.json        # User 2
    └── 3.json        # User 3
```

### 4. Realistic Data

Use tools like [Faker.js](https://fakerjs.dev/) to generate realistic mock data:

```javascript
import { faker } from '@faker-js/faker'

const users = Array.from({ length: 100 }, (_, i) => ({
  id: i + 1,
  name: faker.person.fullName(),
  email: faker.internet.email(),
  avatar: faker.image.avatar(),
  status: faker.helpers.arrayElement(['active', 'inactive'])
}))

// Save to mock/users.json
```

## Limitations

- ❌ POST with multiple files not supported (only first file is written)
- ❌ Pagination/filters only work with JSON arrays
- ❌ PATCH only works with JSON files
- ❌ OPTIONS method not supported in FS mode
- ✅ All other HTTP methods fully supported

## Next Steps

- [REST Handlers](/guide/rest-handlers) - Add custom logic
- [Pagination & Filters](/guide/pagination-filters) - Detailed configuration
- [HTTP Methods](/api/http-methods) - Complete reference
