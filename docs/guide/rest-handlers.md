# REST Handlers

REST Handlers let you define custom programmatic endpoints with full control over request processing and response generation.

## Overview

While File-System API serves static files, REST Handlers let you:

- ✅ Add custom business logic
- ✅ Validate requests
- ✅ Generate dynamic responses
- ✅ Simulate errors and edge cases
- ✅ Interact with databases or external APIs
- ✅ Transform data on the fly

## Basic Handler

```typescript
import { defineConfig } from 'vite'
import mockApi from '@ndriadev/vite-plugin-universal-api'

export default defineConfig({
  plugins: [
    mockApi({
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
interface UniversalApiRequest {
  method: string
  url: string
  headers: Record<string, string>
  params: Record<string, string>      // From URL pattern
  query: Record<string, string>       // Query parameters
  body: any                            // Parsed request body
  files: UploadedFile[] | null        // Uploaded files
}
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
{
  pattern: '/users',
  method: 'POST',
  handle: async (req, res) => {
    // Validation
    if (!req.body.email || !req.body.name) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        error: 'Validation failed',
        details: { email: 'required', name: 'required' }
      }))
      return
    }

    // Create user
    const newUser = {
      id: generateId(),
      ...req.body,
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
    const index = database.users.findIndex(u => u.id === req.params.id)

    if (index === -1) {
      res.writeHead(404)
      res.end()
      return
    }

    database.users[index] = {
      id: req.params.id,
      ...req.body,
      updatedAt: new Date().toISOString()
    }

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
    const index = database.users.findIndex(u => u.id === req.params.id)

    if (index === -1) {
      res.writeHead(404)
      res.end()
      return
    }

    database.users.splice(index, 1)

    res.writeHead(204)  // No Content
    res.end()
  }
}
```

## Advanced Features

### Custom Delay per Handler

```typescript
{
  pattern: '/slow-endpoint',
  method: 'GET',
  delay: 3000,  // 3 seconds delay
  handle: async (req, res) => {
    res.writeHead(200)
    res.end('Slow response')
  }
}
```

### File Upload Handling

```typescript
{
  pattern: '/upload',
  method: 'POST',
  handle: async (req, res) => {
    if (!req.files || req.files.length === 0) {
      res.writeHead(400)
      res.end('No file uploaded')
      return
    }

    const file = req.files[0]

    // Process file
    console.log('Uploaded:', file.filename, file.contentType)

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      filename: file.filename,
      size: file.content.length
    }))
  }
}
```

### Query Parameters

```typescript
{
  pattern: '/search',
  method: 'GET',
  handle: async (req, res) => {
    const { q, limit = '10', offset = '0' } = req.query

    const results = database.users
      .filter(u => u.name.toLowerCase().includes(q.toLowerCase()))
      .slice(parseInt(offset), parseInt(offset) + parseInt(limit))

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      results,
      total: results.length,
      query: q
    }))
  }
}
```

## Middleware

Global middleware runs before all handlers:

```typescript
mockApi({
  handlerMiddlewares: [
    // Logger
    async (req, res, next) => {
      console.log(`${req.method} ${req.url}`)
      next()
    },

    // Authentication
    async (req, res, next) => {
      const token = req.headers.authorization

      if (!token) {
        res.writeHead(401, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Unauthorized' }))
        return
      }

      try {
        req.user = await verifyToken(token)
        next()
      } catch (err) {
        res.writeHead(401)
        res.end(JSON.stringify({ error: 'Invalid token' }))
      }
    }
  ],

  handlers: [
    {
      pattern: '/protected/data',
      method: 'GET',
      handle: async (req, res) => {
        // req.user is available from middleware
        res.writeHead(200)
        res.end(JSON.stringify({ data: 'Protected data' }))
      }
    }
  ]
})
```

## Error Handling

```typescript
mockApi({
  errorMiddlewares: [
    (err, req, res, next) => {
      console.error('API Error:', err)

      if (err.name === 'ValidationError') {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: err.message }))
      } else {
        next(err)  // Pass to next error handler
      }
    },

    // Generic error handler
    (err, req, res, next) => {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Internal server error' }))
    }
  ]
})
```

## Combining with File-System API

You can use both approaches together:

```typescript
mockApi({
  endpointPrefix: '/api',
  fsDir: 'mock',  // File-system for static data

  handlers: [
    // Custom handler for search
    {
      pattern: '/search',
      method: 'POST',
      handle: async (req, res) => {
        const results = await complexSearch(req.body)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(results))
      }
    }
  ]
})
```

Precedence:
1. Custom handlers are checked first
2. File-system fallback if no handler matches

## Best Practices

### 1. Return Proper HTTP Status Codes

```typescript
// 200 - OK (successful GET, PUT, PATCH)
res.writeHead(200)

// 201 - Created (successful POST)
res.writeHead(201, { 'Location': '/api/users/123' })

// 204 - No Content (successful DELETE)
res.writeHead(204)

// 400 - Bad Request (validation error)
res.writeHead(400)

// 401 - Unauthorized (authentication required)
res.writeHead(401)

// 404 - Not Found (resource doesn't exist)
res.writeHead(404)

// 500 - Internal Server Error
res.writeHead(500)
```

### 2. Always Set Content-Type

```typescript
res.writeHead(200, { 'Content-Type': 'application/json' })
res.end(JSON.stringify(data))
```

### 3. Validate Input

```typescript
if (!req.body.email || !isValidEmail(req.body.email)) {
  res.writeHead(400)
  res.end(JSON.stringify({ error: 'Invalid email' }))
  return
}
```

### 4. Use TypeScript Types

```typescript
import type { UniversalApiRequest } from '@ndriadev/vite-plugin-universal-api'

handle: async (req: UniversalApiRequest, res) => {
  // Full autocomplete!
}
```

### 5. Simulate Realistic Scenarios

```typescript
// Random errors
{
  pattern: '/flaky-endpoint',
  method: 'GET',
  handle: async (req, res) => {
    if (Math.random() < 0.3) {  // 30% failure rate
      res.writeHead(500)
      res.end('Server Error')
      return
    }

    res.writeHead(200)
    res.end('Success')
  }
}
```

## Next Steps

- [WebSocket](/guide/websocket) - Real-time communication
- [Middleware](/guide/middleware) - Advanced middleware patterns
- [Examples](/examples/custom-handlers) - More handler examples
