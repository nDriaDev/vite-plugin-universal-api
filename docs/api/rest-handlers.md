# REST Handlers API Reference

Complete API reference for REST handler configuration.

## Handler Types

REST handlers support two types:

1. **Function Handler** - Custom logic with full control
2. **File-System Handler** - Delegates to file-system with pattern matching and optional pre/post processing

## Handler Configuration

```typescript
interface RestHandler {
  pattern: string
  method: HttpMethod
  handle: HandlerFunction | 'FS'
  delay?: number
  preHandle?: PreHandleConfig      // Only for FS handlers
  postHandle?: PostHandleFunction  // Only for FS handlers
  pagination?: PaginationConfig    // Only for FS without postHandle
  filters?: FilterConfig           // Only for FS without postHandle
}
```

## Properties

### pattern

**Type:** `string`

Ant-style path pattern for matching requests.

[Pattern examples remain the same as before...]

### method

**Type:** `HttpMethod`

[Method documentation remains the same...]

### handle

**Type:** `HandlerFunction | 'FS'`

Request handler - either a custom function or file-system delegation.

#### Function Handler

[Function handler documentation remains the same...]

#### File-System Handler

**Type:** `'FS'`

Delegates to file-system with automatic file lookup.

[FS handler basic documentation remains the same...]

### preHandle

**Type:** `PreHandleConfig` (optional)

**Only available for:** File-System handlers (`handle: 'FS'`)

Pre-processing configuration for URL transformation applied **before** file lookup.

**Type Definition:**

```typescript
interface PreHandleConfig {
  transform:
    | ((url: string) => string)
    | Array<{ searchValue: string; replaceValue: string }>
}
```

**Function Transform:**

```typescript
{
  pattern: '/api/v2/**',
  method: 'GET',
  handle: 'FS',
  preHandle: {
    transform: (url) => url.replace('/v2/', '/v1/')
  }
}

// GET /api/v2/users → Looks for mock/api/v1/users.json
```

**Array Transform (multiple replacements):**

```typescript
{
  pattern: '/api/**',
  method: 'GET',
  handle: 'FS',
  preHandle: {
    transform: [
      { searchValue: '/api/', replaceValue: '/data/' },
      { searchValue: '-', replaceValue: '_' },
      { searchValue: '.json', replaceValue: '' }
    ]
  }
}

// GET /api/user-profile.json
// → Transforms to /data/user_profile
// → Looks for mock/data/user_profile.json
```

**Use Cases:**

- URL versioning (`/v2/` → `/v1/`)
- Path normalization (remove trailing slashes)
- Prefix replacements (`/api/` → `/data/`)
- Character substitutions (`-` → `_`)
- Extension handling

### postHandle

**Type:** `PostHandleFunction` (optional)

**Only available for:** File-System handlers (`handle: 'FS'`)

Post-processing function that receives file content and can modify the response **after** file is loaded.

**Type Definition:**

```typescript
type PostHandleFunction = (
  req: ApiWsRestFsRequest,
  res: ServerResponse,
  data: string | null
) => void | Promise<void>
```

**Parameters:**

- `req` - Request object with params, query, body
- `res` - ServerResponse for sending the response
- `data` - File content as string, or `null` if file not found

**Important:** When using `postHandle`:
- ❌ `pagination` is **NOT available** (must implement manually)
- ❌ `filters` are **NOT available** (must implement manually)
- ✅ You have **full control** over the response

**Example - Response Envelope:**

```typescript
{
  pattern: '/users/{id}',
  method: 'GET',
  handle: 'FS',
  postHandle: async (req, res, data) => {
    if (!data) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'User not found' }))
      return
    }

    const envelope = {
      success: true,
      data: JSON.parse(data),
      timestamp: Date.now(),
      requestId: req.headers['x-request-id']
    }

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(envelope))
  }
}
```

**Example - Data Transformation:**

```typescript
{
  pattern: '/products/{id}',
  method: 'GET',
  handle: 'FS',
  postHandle: async (req, res, data) => {
    if (!data) {
      res.writeHead(404)
      res.end()
      return
    }

    const product = JSON.parse(data)

    // Add computed fields
    product.discountedPrice = product.price * 0.9
    product.inStock = product.stock > 0

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(product))
  }
}
```

**Example - Custom 404:**

```typescript
{
  pattern: '/api/**',
  method: 'GET',
  handle: 'FS',
  postHandle: async (req, res, data) => {
    if (!data) {
      const error = {
        error: {
          code: 'NOT_FOUND',
          message: `Resource '${req.url}' does not exist`,
          timestamp: Date.now()
        }
      }
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(error))
      return
    }

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(data)
  }
}
```

**Use Cases:**

- Wrapping responses in envelopes
- Adding metadata (timestamps, request IDs)
- Data transformation and computed fields
- Custom error responses
- Logging and analytics
- Content-type detection
- Response validation

### delay

[Delay documentation remains the same...]

### pagination

**Type:** `PaginationConfig` (optional)

**Only applies to:**
- ✅ File-System handlers (`handle: 'FS'`)
- ✅ WITHOUT `postHandle` (mutually exclusive)
- ✅ Files containing JSON arrays

⚠️ **Not available when using `postHandle`** - you must implement pagination manually.

[Rest of pagination documentation remains the same...]

### filters

**Type:** `FilterConfig` (optional)

**Only applies to:**
- ✅ File-System handlers (`handle: 'FS'`)
- ✅ WITHOUT `postHandle` (mutually exclusive)
- ✅ Files containing JSON arrays

⚠️ **Not available when using `postHandle`** - you must implement filters manually.

[Rest of filters documentation remains the same...]

## Complete Examples

### Function Handler Example

[Function handler example remains the same...]

### FS Handler with preHandle

```typescript
{
  pattern: '/api/v2/users/{id}',
  method: 'GET',
  handle: 'FS',
  preHandle: {
    transform: (url) => url.replace('/v2/', '/v1/')
  }
}

// Request: GET /api/v2/users/123
// preHandle transforms to: /api/v1/users/123
// Looks for: mock/api/v1/users/123.json
// Response: File content
```

### FS Handler with postHandle

```typescript
{
  pattern: '/users/{id}',
  method: 'GET',
  handle: 'FS',
  postHandle: async (req, res, data) => {
    if (!data) {
      res.writeHead(404)
      res.end(JSON.stringify({ error: 'Not found' }))
      return
    }

    const user = JSON.parse(data)

    // Enhance response
    const response = {
      success: true,
      data: user,
      metadata: {
        cached: false,
        timestamp: Date.now()
      }
    }

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(response))
  }
}
```

### FS Handler with preHandle AND postHandle

```typescript
{
  pattern: '/api/v2/products/{id}',
  method: 'GET',
  handle: 'FS',

  // Transform URL before file lookup
  preHandle: {
    transform: [
      { searchValue: '/v2/', replaceValue: '/v1/' },
      { searchValue: 'products', replaceValue: 'items' }
    ]
  },

  // Process response after file is loaded
  postHandle: async (req, res, data) => {
    if (!data) {
      res.writeHead(404)
      res.end()
      return
    }

    const product = JSON.parse(data)

    // Add v2-specific fields
    product.version = 'v2'
    product.legacy = false
    product.discountAvailable = product.price > 100

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(product))
  }
}

// Request: GET /api/v2/products/42
// preHandle: /api/v2/products/42 → /api/v1/items/42
// File lookup: mock/api/v1/items/42.json
// postHandle: Adds version fields
// Response: Enhanced product object
```

### FS Handler with Pagination (no postHandle)

```typescript
{
  pattern: '/users',
  method: 'GET',
  handle: 'FS',
  pagination: {
    type: 'query-param',
    limit: 'limit',
    skip: 'skip',
    sort: 'sortBy',
    order: 'order'
  }
}

// Note: pagination ONLY works without postHandle
// If you need both, implement pagination manually in postHandle
```

### POST with postHandle

```typescript
{
  pattern: '/users',
  method: 'POST',
  handle: 'FS',
  postHandle: async (req, res, data) => {
    // data = written file content (or null on error)
    if (!data) {
      res.writeHead(500)
      res.end(JSON.stringify({ error: 'Failed to create' }))
      return
    }

    const created = JSON.parse(data)

    res.writeHead(201, {
      'Content-Type': 'application/json',
      'Location': `/api/users/${created.id}`
    })
    res.end(JSON.stringify({
      success: true,
      data: created
    }))
  }
}
```

### DELETE with postHandle

```typescript
{
  pattern: '/users/{id}',
  method: 'DELETE',
  handle: 'FS',
  postHandle: async (req, res, data) => {
    if (data) {
      // File was deleted
      console.log(`Deleted user ${req.params.id}`)
      res.writeHead(204)
      res.end()
    } else {
      // File not found
      res.writeHead(404)
      res.end(JSON.stringify({ error: 'User not found' }))
    }
  }
}
```

## Handler Configuration Matrix

| Feature | Function Handler | FS Handler | FS + preHandle | FS + postHandle | FS + preHandle + postHandle |
|---------|------------------|------------|----------------|-----------------|----------------------------|
| Custom logic | ✅ Full control | ❌ No | ❌ No | ✅ Response only | ✅ Response only |
| Pattern matching | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| URL transformation | ❌ No | ❌ No | ✅ Yes | ❌ No | ✅ Yes |
| Response processing | ✅ Full control | ❌ No | ❌ No | ✅ Yes | ✅ Yes |
| Automatic pagination | ❌ Manual | ✅ Yes | ✅ Yes | ❌ Manual | ❌ Manual |
| Automatic filters | ❌ Manual | ✅ Yes | ✅ Yes | ❌ Manual | ❌ Manual |
| File lookup | ❌ Manual | ✅ Auto | ✅ Auto | ✅ Auto | ✅ Auto |
| Use case | Complex logic | Simple files | URL mapping | Response wrapping | URL mapping + wrapping |

## Best Practices

### 1. Choose the Right Handler Type

```typescript
// ✅ Function Handler - Complex logic
{
  pattern: '/search',
  method: 'POST',
  handle: async (req, res) => {
    const results = await complexSearch(req.body)
    res.end(JSON.stringify(results))
  }
}

// ✅ FS Handler - Simple file serving
{
  pattern: '/users/{id}',
  method: 'GET',
  handle: 'FS'
}

// ✅ FS + preHandle - URL transformation
{
  pattern: '/api/v2/**',
  method: 'GET',
  handle: 'FS',
  preHandle: {
    transform: (url) => url.replace('/v2/', '/v1/')
  }
}

// ✅ FS + postHandle - Response wrapping
{
  pattern: '/users/{id}',
  method: 'GET',
  handle: 'FS',
  postHandle: async (req, res, data) => {
    if (!data) {
      res.writeHead(404)
      res.end()
      return
    }
    const envelope = { success: true, data: JSON.parse(data) }
    res.end(JSON.stringify(envelope))
  }
}
```

### 2. preHandle for URL Transformations Only

Use `preHandle` **only** for transforming URLs before file lookup:

```typescript
// ✅ Good - URL transformation
preHandle: {
  transform: (url) => url.replace('/api/', '/data/')
}

// ❌ Bad - Don't use preHandle for response processing
preHandle: {
  transform: (url) => {
    // Don't do this in preHandle!
    fetchFromDatabase()
    return url
  }
}
```

### 3. postHandle for Response Processing

Use `postHandle` for processing responses:

```typescript
// ✅ Good - Response wrapping/transformation
postHandle: async (req, res, data) => {
  if (!data) {
    res.writeHead(404)
    res.end()
    return
  }

  const enhanced = {
    data: JSON.parse(data),
    timestamp: Date.now()
  }

  res.end(JSON.stringify(enhanced))
}
```

### 4. pagination/filters vs postHandle

You cannot use both - choose based on needs:

```typescript
// ✅ Automatic pagination - simpler
{
  handle: 'FS',
  pagination: { type: 'query-param', ... }
}

// ✅ Manual in postHandle - more control
{
  handle: 'FS',
  postHandle: async (req, res, data) => {
    if (!data) return

    const items = JSON.parse(data)
    const limit = parseInt(req.query.get('limit') || '10')
    const skip = parseInt(req.query.get('skip') || '0')

    const paginated = items.slice(skip, skip + limit)

    res.writeHead(200, { 'X-Total': items.length })
    res.end(JSON.stringify(paginated))
  }
}
```

## TypeScript Types

```typescript
import type {
  ApiWsRestFsRequest,
  RestHandler,
  PreHandleConfig,
  PostHandleFunction,
  PaginationConfig,
  FilterConfig
} from '@ndriadev/vite-plugin-universal-mock-api'

// FS handler with preHandle
const handler1: RestHandler = {
  pattern: '/api/**',
  method: 'GET',
  handle: 'FS',
  preHandle: {
    transform: (url: string) => url.replace('/api/', '/data/')
  }
}

// FS handler with postHandle
const handler2: RestHandler = {
  pattern: '/users/{id}',
  method: 'GET',
  handle: 'FS',
  postHandle: async (
    req: ApiWsRestFsRequest,
    res: ServerResponse,
    data: string | null
  ) => {
    if (!data) {
      res.writeHead(404)
      res.end()
      return
    }

    res.writeHead(200)
    res.end(data)
  }
}
```

## See Also

- [REST Handlers Guide](/guide/rest-handlers) - Detailed usage guide with more examples
- [File-System API](/guide/file-system-api) - File-based routing
- [Pagination & Filters](/guide/pagination-filters) - Data querying
- [Middleware](/guide/middleware) - Request processing
