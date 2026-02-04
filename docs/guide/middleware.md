# Middleware

Middleware functions allow you to intercept and process requests before they reach your handlers.

## Overview

Middleware runs in order:
1. **Handler Middlewares** - Run before all REST handlers
2. **Your Handler** - Your custom endpoint logic
3. **Error Middlewares** - Catch and handle errors

## Handler Middlewares

Global middleware that runs before all handlers in the `handlers` array.

### Basic Example

```typescript
import { defineConfig } from 'vite'
import mockApi from '@ndriadev/vite-plugin-ws-rest-fs-api'

export default defineConfig({
  plugins: [
    mockApi({
      endpointPrefix: '/api',
      
      handlerMiddlewares: [
        // Logger middleware
        async (req, res, next) => {
          console.log(`${req.method} ${req.url}`)
          next()
        },
        
        // Timing middleware
        async (req, res, next) => {
          const start = Date.now()
          next()
          console.log(`Request took ${Date.now() - start}ms`)
        }
      ],
      
      handlers: [
        {
          pattern: '/users',
          method: 'GET',
          handle: async (req, res) => {
            // Middleware already ran
            res.writeHead(200)
            res.end('Users')
          }
        }
      ]
    })
  ]
})
```

### Middleware Function Signature

```typescript
type MiddlewareFunction = (
  req: ApiWsRestFsRequest,
  res: ServerResponse,
  next: () => void
) => void | Promise<void>
```

**Parameters:**
- `req` - Request object with parsed body, params, query
- `res` - Node.js ServerResponse object
- `next` - Call to proceed to next middleware/handler

## Common Middleware Patterns

### Authentication

```typescript
handlerMiddlewares: [
  async (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '')
    
    if (!token) {
      res.writeHead(401, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'No token provided' }))
      return  // Don't call next()
    }
    
    try {
      // Verify token and attach user to request
      req.body.user = await verifyToken(token)
      next()  // Proceed to handler
    } catch (err) {
      res.writeHead(401, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Invalid token' }))
      // Don't call next()
    }
  }
]
```

### Request Validation

```typescript
handlerMiddlewares: [
  async (req, res, next) => {
    // Only validate POST/PUT/PATCH
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      if (!req.body || typeof req.body !== 'object') {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Invalid request body' }))
        return
      }
    }
    next()
  }
]
```

### CORS Headers

```typescript
handlerMiddlewares: [
  async (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    
    // Handle preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }
    
    next()
  }
]
```

### Rate Limiting

```typescript
const rateLimits = new Map()

handlerMiddlewares: [
  async (req, res, next) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress
    const now = Date.now()
    const windowMs = 60000 // 1 minute
    const maxRequests = 100
    
    if (!rateLimits.has(ip)) {
      rateLimits.set(ip, [])
    }
    
    const requests = rateLimits.get(ip).filter(time => now - time < windowMs)
    
    if (requests.length >= maxRequests) {
      res.writeHead(429, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Too many requests' }))
      return
    }
    
    requests.push(now)
    rateLimits.set(ip, requests)
    next()
  }
]
```

### Request ID

```typescript
import { randomUUID } from 'crypto'

handlerMiddlewares: [
  async (req, res, next) => {
    const requestId = randomUUID()
    req.body.requestId = requestId
    res.setHeader('X-Request-ID', requestId)
    next()
  }
]
```

## Error Middlewares

Handle errors that occur during request processing.

### Basic Error Handler

```typescript
errorMiddlewares: [
  (err, req, res, next) => {
    console.error('Error:', err)
    
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ 
      error: 'Internal server error',
      requestId: req.body.requestId 
    }))
  }
]
```

### Error Handler Signature

```typescript
type ErrorHandlerFunction = (
  err: Error,
  req: ApiWsRestFsRequest,
  res: ServerResponse,
  next: (err?: Error) => void
) => void
```

### Multiple Error Handlers

```typescript
errorMiddlewares: [
  // Handle specific error types
  (err, req, res, next) => {
    if (err.name === 'ValidationError') {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ 
        error: 'Validation failed',
        details: err.details 
      }))
      return
    }
    
    if (err.name === 'NotFoundError') {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Resource not found' }))
      return
    }
    
    next(err)  // Pass to next error handler
  },
  
  // Generic error handler (catch-all)
  (err, req, res, next) => {
    console.error('Unhandled error:', err)
    
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined
    }))
  }
]
```

## Middleware Execution Order

```
Request
  ↓
handlerMiddlewares[0]
  ↓
handlerMiddlewares[1]
  ↓
handlerMiddlewares[n]
  ↓
Handler (if match found)
  ↓
Response
  
(If error occurs)
  ↓
errorMiddlewares[0]
  ↓
errorMiddlewares[1]
  ↓
errorMiddlewares[n]
  ↓
Response
```

## Complete Example

```typescript
import { defineConfig } from 'vite'
import mockApi from '@ndriadev/vite-plugin-ws-rest-fs-api'

const users = new Map()

export default defineConfig({
  plugins: [
    mockApi({
      endpointPrefix: '/api',
      
      handlerMiddlewares: [
        // 1. Logger
        async (req, res, next) => {
          console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`)
          next()
        },
        
        // 2. CORS
        async (req, res, next) => {
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE')
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
          
          if (req.method === 'OPTIONS') {
            res.writeHead(204)
            res.end()
            return
          }
          next()
        },
        
        // 3. Authentication (skip for public endpoints)
        async (req, res, next) => {
          const publicPaths = ['/api/login', '/api/register']
          if (publicPaths.some(path => req.url.startsWith(path))) {
            next()
            return
          }
          
          const token = req.headers.authorization?.replace('Bearer ', '')
          if (!token) {
            res.writeHead(401, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Unauthorized' }))
            return
          }
          
          const user = users.get(token)
          if (!user) {
            res.writeHead(401, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Invalid token' }))
            return
          }
          
          req.body.currentUser = user
          next()
        },
        
        // 4. Request timing
        async (req, res, next) => {
          const start = Date.now()
          
          // Override res.end to log timing
          const originalEnd = res.end.bind(res)
          res.end = function(...args) {
            console.log(`Request took ${Date.now() - start}ms`)
            return originalEnd(...args)
          }
          
          next()
        }
      ],
      
      errorMiddlewares: [
        // Custom error handler
        (err, req, res, next) => {
          console.error('Error:', err)
          
          if (err.name === 'ValidationError') {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: err.message }))
            return
          }
          
          next(err)
        },
        
        // Generic error handler
        (err, req, res, next) => {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Internal server error' }))
        }
      ],
      
      handlers: [
        {
          pattern: '/users',
          method: 'GET',
          handle: async (req, res) => {
            // req.body.currentUser is available from middleware
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ users: Array.from(users.values()) }))
          }
        }
      ]
    })
  ]
})
```

## Important Notes

### Scope

⚠️ **Handler middlewares only run for handlers in the `handlers` array**

They do NOT run for:
- Pure file-system requests (when no handler matches)
- WebSocket connections

### Calling next()

Always call `next()` to continue the chain:

```typescript
// ✅ Good
async (req, res, next) => {
  doSomething()
  next()  // Continue
}

// ✅ Good - early return
async (req, res, next) => {
  if (error) {
    res.writeHead(400)
    res.end('Error')
    return  // Don't call next
  }
  next()  // Continue
}

// ❌ Bad - forgot next()
async (req, res, next) => {
  doSomething()
  // Request hangs!
}
```

### Async Middleware

Can be async or sync:

```typescript
// Async
async (req, res, next) => {
  await doAsyncThing()
  next()
}

// Sync
(req, res, next) => {
  doSyncThing()
  next()
}
```

## Best Practices

### 1. Order Matters

Place middleware in logical order:
1. Logging (first)
2. CORS
3. Authentication
4. Validation
5. Business logic

### 2. Early Returns

Return early for errors to avoid calling `next()`:

```typescript
if (error) {
  res.writeHead(400)
  res.end('Error')
  return  // Don't call next()
}
next()
```

### 3. Don't Modify res After Calling next()

```typescript
// ❌ Bad
next()
res.setHeader('X-Custom', 'value')  // Too late!

// ✅ Good
res.setHeader('X-Custom', 'value')
next()
```

### 4. Use Try-Catch for Async

```typescript
async (req, res, next) => {
  try {
    await riskyOperation()
    next()
  } catch (err) {
    res.writeHead(500)
    res.end('Error')
  }
}
```

## Next Steps

- [REST Handlers](/guide/rest-handlers) - Handler configuration
- [Examples](/examples/authentication) - Authentication example
- [API Reference](/api/) - Complete configuration
