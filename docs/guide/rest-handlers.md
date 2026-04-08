# REST Handlers

REST Handlers let you define custom programmatic endpoints with full control over request processing and response generation.

## Overview

REST Handlers support two approaches:

1. **Custom Function Handlers** - Full programmatic control with custom logic
2. **File-System Handlers** - Delegate to file-system with pattern matching and optional pre/post processing

While File-System API serves static files, REST Handlers let you:

- ✅ Add custom business logic
- ✅ Validate requests
- ✅ Generate dynamic responses
- ✅ Simulate errors and edge cases
- ✅ Interact with databases or external APIs
- ✅ Transform data on the fly
- ✅ Combine pattern matching with file-system routing
- ✅ Pre-process URLs before file lookup
- ✅ Post-process file content before sending

## Handler Types

### Custom Function Handler

Full control with your own logic:

```typescript
import { defineConfig } from 'vite'
import { universalApi } from '@ndriadev/vite-plugin-universal-api'

export default defineConfig({
  plugins: [
    universalApi({
      endpointPrefix: '/api',
      handlers: [
        {
          pattern: '/users/{id}',
          method: 'GET',
          handle: async (req, res) => {
            const userId = req.params.id

            // Your custom logic
            const user = {
              id: userId,
              name: `User ${userId}`
            }

            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(user))
          }
        }
      ]
    })
  ]
})
```

### File-System Handler

Delegate to file-system with pattern matching:

```typescript
handlers: [
  {
    pattern: '/users/{id}',
    method: 'GET',
    handle: 'FS'  // Delegates to file-system
  }
]
```

**How it works:**

```
Request: GET /api/users/123

Pattern match: /users/{id} → id = "123"

File lookup tries (in order):
1. Exact path:           mock/users/123
2. Directory index:      mock/users/123/index.json
3. File with extension:  mock/users/123.<ext>  (first match in directory)

If found → Serves file
If not found → 404
```

### File-System Handler with preHandle

Transform the URL before file lookup:

```typescript
handlers: [
  {
    pattern: '/api/v2/users/{id}',
    method: 'GET',
    handle: 'FS',
    preHandle: {
      // Transform URL before looking up file
      transform: (url) => url.replace('/v2/', '/v1/')
    }
  }
]
```

**Request flow:**
```
Request:     GET /api/v2/users/123
preHandle:   Transform to /api/v1/users/123
File lookup: mock/api/v1/users/123.json
Response:    File content
```

**Multiple replacements:**

```typescript
preHandle: {
  transform: [
    { searchValue: '/api/', replaceValue: '/data/' },
    { searchValue: '/v2/', replaceValue: '/v1/' }
  ]
}
```

### File-System Handler with postHandle

Intercept the file lookup result and write the response manually:

```typescript
handlers: [
  {
    pattern: '/users/{id}',
    method: 'GET',
    handle: 'FS',
    postHandle: async (req, res, data) => {
      if (!data) {
        // File not found
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'User not found' }))
        return
      }

      // Wrap file content in envelope
      const response = {
        data: JSON.parse(data),
        timestamp: Date.now(),
        path: req.url,
        params: req.params
      }

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(response))
    }
  }
]
```

**Request flow:**
```
Request:      GET /api/users/123
File lookup:  mock/users/123.json
File content: { "id": "123", "name": "Alice" }
postHandle:   Receives file content as `data`, wraps in envelope
Response:     { data: { ... }, timestamp: ..., path: ... }
```

> **Important:** `postHandle` is called with the **current file content on disk** (or `null` if no file was found) regardless of the HTTP method. For `POST`, `PUT`, `PATCH`, and `DELETE`, `data` contains the file content *before* any write or delete operation. When `postHandle` is defined, the plugin skips all automatic processing — you are fully responsible for writing the response.

> **Note:** When using `postHandle`, automatic pagination and filters are **not available** (you must implement them manually if needed).

## Handler Configuration

### Pattern Matching

Supports Ant-style path patterns:

```typescript
{
  // Exact match
  pattern: '/users/profile',

  // Path parameters
  pattern: '/users/{id}',
  pattern: '/posts/{postId}/comments/{commentId}',

  // Wildcard (single segment)
  pattern: '/api/*/data',

  // Double wildcard (multiple segments)
  pattern: '/files/**',
}
```

### HTTP Methods

```typescript
{
  method: 'GET',    // Retrieve data
  method: 'POST',   // Create resource
  method: 'PUT',    // Update/replace resource
  method: 'PATCH',  // Partial update
  method: 'DELETE', // Remove resource
  method: 'HEAD',   // Get headers only
}
```

### Request Object

```typescript
interface UniversalApiRequest<TBody = unknown> {
  method: string
  url: string
  headers: Record<string, string>
  params: Record<string, string> | null  // From URL pattern
  query: URLSearchParams                  // Query parameters
  body: TBody                             // Parsed request body
  files: UploadedFile[] | null            // Uploaded files
}
```

The `body` field is typed via the generic `TBody` parameter (default: `unknown`). Pass a concrete type to get full type safety in your handler:

```typescript
import type { UniversalApiSimpleHandler } from '@ndriadev/vite-plugin-universal-api'

interface CreateUserBody {
  name: string
  email: string
  role?: string
}

// Handler with typed body
const createUser: UniversalApiSimpleHandler<CreateUserBody> = async (req, res) => {
  const { name, email } = req.body  // ✅ fully typed — no cast needed
  // ...
}
```

When using the default (untyped) form, narrow `body` with a cast before use:

```typescript
handle: async (req, res) => {
  const body = req.body as { name: string; email: string }
  // ...
}
```

## preHandle Examples

### URL Versioning

```typescript
{
  pattern: '/api/v2/**',
  method: 'GET',
  handle: 'FS',
  preHandle: {
    // Map v2 requests to v1 files
    transform: (url) => url.replace('/v2/', '/v1/')
  }
}

// GET /api/v2/users → Looks for mock/api/v1/users.json
// GET /api/v2/posts/1 → Looks for mock/api/v1/posts/1.json
```

### Path Normalization

```typescript
{
  pattern: '/api/**',
  method: 'GET',
  handle: 'FS',
  preHandle: {
    transform: (url) => {
      // Remove trailing slashes
      return url.replace(/\/$/, '')
    }
  }
}
```

### Multiple Transformations

```typescript
{
  pattern: '/api/**',
  method: 'GET',
  handle: 'FS',
  preHandle: {
    transform: [
      // Replace API prefix
      { searchValue: '/api/', replaceValue: '/data/' },
      // Remove file extension from URL
      { searchValue: '.json', replaceValue: '' },
      // Replace dashes with underscores
      { searchValue: '-', replaceValue: '_' }
    ]
  }
}

// GET /api/user-profile.json
// → Transform to /data/user_profile
// → Looks for mock/data/user_profile.json
```

### Dynamic Transformations

```typescript
{
  pattern: '/cdn/{region}/files/**',
  method: 'GET',
  handle: 'FS',
  preHandle: {
    transform: (url) => {
      // Extract region from URL and remove it from path
      const match = url.match(/\/cdn\/(\w+)\/files\/(.+)/)
      if (match) {
        const [, region, filepath] = match
        // Map to region-specific directory
        return `/cdn/${region}/${filepath}`
      }
      return url
    }
  }
}

// GET /api/cdn/eu/files/image.png
// → Transform to /cdn/eu/image.png
// → Looks for mock/cdn/eu/image.png
```

## postHandle Examples

### Response Envelope

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

    const envelope = {
      success: true,
      data: JSON.parse(data),
      metadata: {
        timestamp: Date.now(),
        requestId: req.headers['x-request-id'],
        cached: false
      }
    }

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(envelope))
  }
}
```

### Data Transformation

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
    product.url = `/products/${product.id}`

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(product))
  }
}
```

### Content-Type Detection

```typescript
{
  pattern: '/files/**',
  method: 'GET',
  handle: 'FS',
  postHandle: async (req, res, data) => {
    if (!data) {
      res.writeHead(404)
      res.end()
      return
    }

    // Detect content type based on URL
    const url = req.url
    let contentType = 'application/octet-stream'

    if (url.endsWith('.json')) contentType = 'application/json'
    else if (url.endsWith('.xml')) contentType = 'application/xml'
    else if (url.endsWith('.html')) contentType = 'text/html'
    else if (url.endsWith('.jpg') || url.endsWith('.jpeg')) contentType = 'image/jpeg'
    else if (url.endsWith('.png')) contentType = 'image/png'

    res.writeHead(200, { 'Content-Type': contentType })
    res.end(data)
  }
}
```

### Custom Error Responses

```typescript
{
  pattern: '/api/**',
  method: 'GET',
  handle: 'FS',
  postHandle: async (req, res, data) => {
    if (!data) {
      const error = {
        error: {
          code: 'RESOURCE_NOT_FOUND',
          message: `Resource '${req.url}' not found`,
          timestamp: new Date().toISOString(),
          requestId: Math.random().toString(36).substr(2, 9)
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

### POST/PUT/DELETE with postHandle

When `postHandle` is used with mutating methods, `data` contains the **existing file content before any write** (the current state on disk), or `null` if no file was found. The plugin skips its automatic write/delete logic entirely — you are responsible for both the response and any file operations.

```typescript
handlers: [
  // POST with postHandle — data is the pre-existing file content, or null
  {
    pattern: '/users',
    method: 'POST',
    handle: 'FS',
    postHandle: async (req, res, data) => {
      // data = existing file content before the POST would write anything
      // The plugin will NOT write any file; you manage the response entirely.
      const body = req.body as { name: string; email: string }

      if (!body.name || !body.email) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Missing required fields' }))
        return
      }

      const newUser = { id: Date.now().toString(), ...body }

      res.writeHead(201, {
        'Content-Type': 'application/json',
        'Location': `/api/users/${newUser.id}`
      })
      res.end(JSON.stringify({ success: true, data: newUser }))
    }
  },

  // DELETE with postHandle — data is the current file content, or null if not found
  {
    pattern: '/users/{id}',
    method: 'DELETE',
    handle: 'FS',
    postHandle: async (req, res, data) => {
      if (!data) {
        res.writeHead(404)
        res.end(JSON.stringify({ error: 'User not found' }))
        return
      }

      // data contains the current file content
      // The plugin will NOT delete any file; manage it yourself if needed.
      res.writeHead(204)
      res.end()
    }
  }
]
```

## Combining preHandle and postHandle

You can use both together:

```typescript
{
  pattern: '/api/v2/users/{id}',
  method: 'GET',
  handle: 'FS',

  // Transform URL before file lookup
  preHandle: {
    transform: (url) => url.replace('/v2/', '/v1/')
  },

  // Process response after file is loaded
  postHandle: async (req, res, data) => {
    if (!data) {
      res.writeHead(404)
      res.end(JSON.stringify({ error: 'User not found' }))
      return
    }

    const user = JSON.parse(data)

    // Add v2-specific fields
    user.version = 'v2'
    user.enhanced = true
    user.legacyData = false

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(user))
  }
}
```

**Request flow:**
```
Request:      GET /api/v2/users/123
preHandle:    Transform to /api/v1/users/123
File lookup:  mock/api/v1/users/123.json
File content: { "id": "123", "name": "Alice" }
postHandle:   Receives content, adds version fields
Response:     { "id": "123", "name": "Alice", "version": "v2", ... }
```

## Important Notes

### postHandle Limitations

⚠️ When using `postHandle`, these features are **NOT available**:
- ❌ Automatic pagination
- ❌ Automatic filters
- ❌ Automatic file write/delete (for POST, PUT, PATCH, DELETE)

You must implement them manually in your `postHandle` function if needed.

**Why?** Because `postHandle` gives you full control over the response, the plugin delegates all processing to your callback.

### preHandle vs Middleware

**preHandle** transforms URLs for **specific handlers** before file lookup.

**Middleware** runs for **all handlers** and has different purposes.

```typescript
universalApi({
  // Middleware: runs for ALL handlers
  handlerMiddlewares: [
    async (req, res, next) => {
      console.log(`Request: ${req.method} ${req.url}`)
      next()
    }
  ],

  handlers: [
    {
      pattern: '/api/**',
      method: 'GET',
      handle: 'FS',
      // preHandle: runs ONLY for this handler
      preHandle: {
        transform: (url) => url.replace('/api/', '/data/')
      }
    }
  ]
})
```

## Examples

### GET - Retrieve Resource

```typescript
{
  pattern: '/users/{id}',
  method: 'GET',
  handle: async (req, res) => {
    const user = database.users.find(u => u.id === req.params.id)

    if (!user) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'User not found' }))
      return
    }

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(user))
  }
}
```

### POST - Create Resource

```typescript
interface CreateUserBody {
  name: string
  email: string
}

{
  pattern: '/users',
  method: 'POST',
  handle: async (req, res) => {
    const body = req.body as CreateUserBody

    if (!body.email || !body.name) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        error: 'Validation failed',
        details: { email: 'required', name: 'required' }
      }))
      return
    }

    const newUser = {
      id: generateId(),
      ...body,
      createdAt: new Date().toISOString()
    }

    database.users.push(newUser)

    res.writeHead(201, {
      'Content-Type': 'application/json',
      'Location': `/api/users/${newUser.id}`
    })
    res.end(JSON.stringify(newUser))
  }
}
```

### PUT - Update Resource

```typescript
{
  pattern: '/users/{id}',
  method: 'PUT',
  handle: async (req, res) => {
    const userId = req.params.id
    const body = req.body as { name: string; email: string }

    const index = database.users.findIndex(u => u.id === userId)

    if (index === -1) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'User not found' }))
      return
    }

    database.users[index] = { id: userId, ...body }

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(database.users[index]))
  }
}
```

### DELETE - Remove Resource

```typescript
{
  pattern: '/users/{id}',
  method: 'DELETE',
  handle: async (req, res) => {
    const userId = req.params.id
    const index = database.users.findIndex(u => u.id === userId)

    if (index === -1) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'User not found' }))
      return
    }

    database.users.splice(index, 1)

    res.writeHead(204)
    res.end()
  }
}
```

### Simulating Errors

```typescript
{
  pattern: '/unstable',
  method: 'GET',
  handle: async (req, res) => {
    if (Math.random() < 0.3) {
      res.writeHead(503, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Service temporarily unavailable' }))
      return
    }

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok' }))
  }
}
```

### Disabling a Handler

Use `disabled: true` to temporarily turn off a handler without removing it:

```typescript
{
  pattern: '/users/{id}',
  method: 'GET',
  disabled: true,
  handle: async (req, res) => {
    // This handler is skipped; the request falls through to the next match
  }
}
```

## Next Steps

- [WebSocket](/guide/websocket) - Real-time communication
- [Middleware](/guide/middleware) - Advanced middleware patterns
- [File-System API](/guide/file-system-api) - File-based routing
- [Examples](/examples/custom-handlers) - More handler examples
