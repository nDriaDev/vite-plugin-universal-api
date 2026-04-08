# Middleware

Middleware functions allow you to intercept and process requests before they reach your handlers.

## Overview

Middleware runs in order:
1. **Handler Middlewares** — Run before all REST handlers
2. **Your Handler** — Your custom endpoint logic
3. **Error Middlewares** — Catch and handle errors

## Handler Middlewares

Global middleware that runs before all handlers in the `handlers` array.

### Basic Example

```typescript
import { defineConfig } from 'vite'
// import mockApi from '@ndriadev/vite-plugin-universal-api' //Default export
import { universalApi } from '@ndriadev/vite-plugin-universal-api' // Named export

export default defineConfig({
  plugins: [
    universalApi({
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
type UniversalApiMiddleware<TBody = unknown> = (
  req: UniversalApiRequest<TBody>,
  res: ServerResponse,
  next: Connect.NextFunction
) => void | Promise<void>
```

The generic `TBody` parameter lets you type the request body when you know its shape:

```typescript
import type { UniversalApiMiddleware } from '@ndriadev/vite-plugin-universal-api'

interface AuthenticatedBody {
  currentUser: { id: string; role: string }
}

// Typed middleware — body shape is known
const authMiddleware: UniversalApiMiddleware<AuthenticatedBody> = async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) {
    res.writeHead(401, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Unauthorized' }))
    return
  }
  req.body.currentUser = await verifyToken(token)
  next()
}
```

**Parameters:**
- `req` — Request object with parsed `body`, `params`, `query`, `files`
- `res` — Node.js `ServerResponse`
- `next` — Call to proceed to next middleware/handler

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
      const user = await verifyToken(token)
      // Cast to any to attach a user to the body object
      ;(req.body as any).user = user
      next()
    } catch {
      res.writeHead(401, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Invalid token' }))
    }
  }
]
```

::: tip Typed body after auth
If your handlers always expect an authenticated body, declare a shared body type and use it in both middleware and handler:

```typescript
import type { UniversalApiMiddleware, UniversalApiSimpleHandler } from '@ndriadev/vite-plugin-universal-api'

interface AuthBody { user: { id: string; role: string } }

const authMiddleware: UniversalApiMiddleware<AuthBody> = async (req, res, next) => {
  const user = await verifyToken(req.headers.authorization!)
  req.body.user = user
  next()
}

const usersHandler: UniversalApiSimpleHandler<AuthBody> = async (req, res) => {
  const { user } = req.body  // fully typed ✅
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ requestedBy: user.id }))
}
```
:::

### Request Validation

```typescript
handlerMiddlewares: [
  async (req, res, next) => {
    if (['POST', 'PUT', 'PATCH'].includes(req.method!)) {
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
const rateLimits = new Map<string, number[]>()

handlerMiddlewares: [
  async (req, res, next) => {
    const ip = String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? 'unknown')
    const now = Date.now()
    const windowMs = 60_000 // 1 minute
    const maxRequests = 100

    const requests = (rateLimits.get(ip) ?? []).filter(t => now - t < windowMs)

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
    ;(req.body as any).requestId = requestId
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
    res.end(JSON.stringify({ error: 'Internal server error' }))
  }
]
```

### Error Handler Signature

```typescript
type UniversalApiErrorMiddleware = (
  err: any,
  req: UniversalApiRequest | IncomingMessage,
  res: ServerResponse,
  next: Connect.NextFunction
) => void | Promise<void>
```

Note that `req` may be either a fully parsed `UniversalApiRequest` or a raw `IncomingMessage`, depending on when the error occurred in the pipeline. Guard accordingly:

```typescript
errorMiddlewares: [
  (err, req, res, next) => {
    const body = 'body' in req ? req.body : null
    // ...
  }
]
```

### Multiple Error Handlers

```typescript
errorMiddlewares: [
  // Handle specific error types
  (err, req, res, next) => {
    if (err.name === 'ValidationError') {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Validation failed', details: err.details }))
      return
    }

    if (err.name === 'NotFoundError') {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Resource not found' }))
      return
    }

    next(err)  // Pass to next error handler
  },

  // Generic catch-all
  (err, req, res, next) => {
    console.error('Unhandled error:', err)
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Internal server error' }))
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

(If error occurs anywhere above)
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
import { universalApi } from '@ndriadev/vite-plugin-universal-api'
import type { UniversalApiSimpleHandler } from '@ndriadev/vite-plugin-universal-api'

interface AppBody {
  currentUser?: { id: string; role: string }
  requestId?: string
}

const users = new Map<string, { id: string; role: string }>()

const getUsers: UniversalApiSimpleHandler<AppBody> = async (req, res) => {
  const { currentUser } = req.body  // typed ✅
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ requestedBy: currentUser?.id, users: [...users.values()] }))
}

export default defineConfig({
  plugins: [
    universalApi({
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

        // 3. Request ID
        async (req, res, next) => {
          ;(req.body as AppBody).requestId = crypto.randomUUID()
          next()
        },

        // 4. Authentication
        async (req, res, next) => {
          const publicPaths = ['/api/login', '/api/register']
          if (publicPaths.some(p => req.url!.startsWith(p))) {
            next()
            return
          }

          const token = req.headers.authorization?.replace('Bearer ', '')
          const user = token ? users.get(token) : undefined
          if (!user) {
            res.writeHead(401, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Unauthorized' }))
            return
          }

          ;(req.body as AppBody).currentUser = user
          next()
        }
      ],

      errorMiddlewares: [
        (err, req, res, next) => {
          console.error('Error:', err)
          if (err.name === 'ValidationError') {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: err.message }))
            return
          }
          next(err)
        },

        (err, req, res, next) => {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Internal server error' }))
        }
      ],

      handlers: [
        {
          pattern: '/users',
          method: 'GET',
          handle: getUsers
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
- Pure file-system requests (when no REST handler matches)
- WebSocket connections

### Calling next()

Always call `next()` to continue the chain:

```typescript
// ✅ Good
async (req, res, next) => {
  doSomething()
  next()
}

// ✅ Good — early return on error
async (req, res, next) => {
  if (error) {
    res.writeHead(400)
    res.end('Error')
    return  // Don't call next
  }
  next()
}

// ❌ Bad — request hangs
async (req, res, next) => {
  doSomething()
  // Forgot next()!
}
```

### Typed Body

The `body` field on `UniversalApiRequest` is typed as `TBody = unknown` by default. Inside middleware, use a cast when attaching data that subsequent handlers will consume:

```typescript
;(req.body as MyBodyShape).myField = value
```

Or declare the middleware with an explicit generic:

```typescript
const myMiddleware: UniversalApiMiddleware<MyBodyShape> = async (req, res, next) => {
  req.body.myField = value  // ✅ typed
  next()
}
```

## Best Practices

### 1. Order Matters

Place middleware in logical order:
1. Logging (first)
2. CORS
3. Request ID
4. Authentication
5. Validation / business logic

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

- [REST Handlers](/guide/rest-handlers) — Handler configuration
- [Examples — Authentication](/examples/authentication) — Full auth example
- [API Reference](/api/) — Complete configuration
