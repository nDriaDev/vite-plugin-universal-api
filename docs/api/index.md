# Configuration Options

Complete reference for all configuration options available in vite-plugin-universal-api.

## Basic Options

### disable

- **Type**: `boolean`
- **Default**: `false`

Disable the entire plugin. Useful for production builds or conditional enabling.

```typescript
universalApi({
  disable: process.env.NODE_ENV === 'production'
})
```

### logLevel

- **Type**: `'debug' | 'info' | 'warn' | 'error' | 'silent'`
- **Default**: `'info'`

Logging verbosity level.

```typescript
universalApi({
  logLevel: 'debug' // Show all debug messages
})
```

**Log levels:**
- `debug`: All messages including detailed debugging info
- `info`: Informational messages about plugin operations
- `warn`: Warnings about potential issues
- `error`: Only error messages
- `silent`: No output

### endpointPrefix

- **Type**: `string | string[]`
- **Default**: `'/api'`

URL prefix(es) for API endpoints. Requests not starting with one of these prefixes are passed through untouched.

```typescript
// Single prefix
universalApi({
  endpointPrefix: '/api'
})

// Multiple prefixes
universalApi({
  endpointPrefix: ['/api', '/mock', '/v1']
})
```

::: warning
If `endpointPrefix` is empty or invalid, the plugin will be automatically disabled.
:::

### fsDir

- **Type**: `string | null`
- **Default**: `undefined`

Directory path for file-based mocking (relative to project root).

```typescript
universalApi({
  fsDir: 'mock' // Points to ./mock/ directory
})

// Disable file-based routing
universalApi({
  fsDir: null
})
```

::: tip
If the directory doesn't exist, file-based routing will be disabled automatically, but the plugin will still work for custom handlers.
:::

### enablePreview

- **Type**: `boolean`
- **Default**: `true`

Control whether the plugin is active during `vite preview` (i.e. when locally serving the production build).

By default the plugin intercepts requests in both `vite dev` and `vite preview`. Set this to `false` to restrict it to development only, so that preview mode behaves like a real production server — without mock interference.

```typescript
// Disable mocks in preview so the real API is hit
universalApi({
  enablePreview: false
})

// Keep mocks active in preview (default behaviour)
universalApi({
  enablePreview: true
})
```

::: tip When to disable preview
Use `enablePreview: false` when you want to verify your application against real API endpoints before deploying, or when your CI/staging pipeline runs `vite preview` and you do not want mock data to be returned.
:::

### enableWs

- **Type**: `boolean`
- **Default**: `false`

Enable WebSocket support. When `true`, `wsHandlers` option becomes required.

```typescript
universalApi({
  enableWs: true,
  wsHandlers: [
    // At least one handler required
  ]
})
```

### delay

- **Type**: `number` (milliseconds)
- **Default**: `0`

Simulated response delay. Useful for testing loading states.

```typescript
universalApi({
  delay: 1000 // All responses delayed by 1 second
})
```

Can also be set per-handler:

```typescript
universalApi({
  delay: 500, // Global delay
  handlers: [
    {
      pattern: '/slow-endpoint',
      method: 'GET',
      delay: 3000, // Override for this handler
      handle: (req, res) => {
        // ...
      }
    }
  ]
})
```

### gatewayTimeout

- **Type**: `number` (milliseconds)
- **Default**: `0` (disabled)

Timeout for long-running handlers. Returns 504 Gateway Timeout if exceeded. Note this does NOT stop handler execution — it only changes the response status.

```typescript
universalApi({
  gatewayTimeout: 5000 // Return 504 after 5 seconds
})
```

### noHandledRestFsRequestsAction

- **Type**: `'404' | 'forward'`
- **Default**: `'404'`

Behavior for requests that match the endpoint prefix but don't match any handler pattern.

```typescript
// Return 404 for unmatched requests
universalApi({
  noHandledRestFsRequestsAction: '404'
})

// Forward to next Vite middleware (e.g., serve static files)
universalApi({
  noHandledRestFsRequestsAction: 'forward'
})
```

::: tip Use Case for 'forward'
Use `'forward'` when you want the plugin to handle only specific API routes and let Vite's default behavior handle everything else (like serving static assets).
:::

## Parser Configuration

### parser

- **Type**: `boolean | ParserConfig`
- **Default**: `true`

Request body parsing configuration.

**Built-in parser (default):**

```typescript
universalApi({
  parser: true // Enables built-in JSON + form data + multipart parser
})
```

**Disable parsing:**

```typescript
universalApi({
  parser: false // No automatic parsing
})
```

**Custom parser:**

```typescript
import express from 'express'

universalApi({
  parser: {
    // Use Express parsers
    parser: [
      express.json(),
      express.urlencoded({ extended: true })
    ],
    // Extract data from request
    transform: (req: any) => ({
      body: req.body,
      query: new URLSearchParams(req.url.split('?')[1])
    })
  }
})
```

::: warning Scope
The parser is executed **only** for REST API requests, not for WebSocket messages.
:::

## Middleware Configuration

### handlerMiddlewares

- **Type**: `UniversalApiMiddleware[]`
- **Default**: `[]`

Global middleware executed before all handlers. Similar to Express middleware.

```typescript
universalApi({
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
        res.writeHead(401)
        res.end('Unauthorized')
        return
      }
      next()
    }
  ]
})
```

::: warning Scope
Middleware is executed **only** for handlers defined in the `handlers` array, **NOT** for pure file-system requests or WebSocket connections.
:::

### errorMiddlewares

- **Type**: `UniversalApiErrorMiddleware[]`
- **Default**: `[]`

Error handling middleware. Called when an error occurs during request processing.

```typescript
universalApi({
  errorMiddlewares: [
    (err, req, res, next) => {
      console.error('API Error:', err)

      if (err.name === 'ValidationError') {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: err.message }))
      } else {
        next(err) // Pass to next error handler
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

## REST Handlers

### handlers

- **Type**: `UniversalApiRestFsHandler[]`
- **Default**: `[]`

REST API handler configurations. See [REST Handlers](/api/rest-handlers) for detailed documentation.

```typescript
universalApi({
  handlers: [
    {
      pattern: '/users/{id}',
      method: 'GET',
      handle: async (req, res) => {
        // Your handler logic
      }
    }
  ]
})
```

## WebSocket Handlers

### wsHandlers

- **Type**: `UniversalApiWsHandler[]`
- **Required when** `enableWs: true`

WebSocket handler configurations. See [WebSocket Handlers](/api/websocket-handlers) for detailed documentation.

```typescript
universalApi({
  enableWs: true,
  wsHandlers: [
    {
      pattern: '/ws/chat',
      onMessage: (conn, msg) => {
        conn.broadcast(msg)
      }
    }
  ]
})
```

## Pagination Configuration

### pagination

- **Type**: `Partial<Record<'ALL' | 'HEAD' | 'GET' | 'POST' | 'DELETE', PaginationConfig>> | null`
- **Default**: `null`

Global pagination configuration for file-based endpoints. Can be configured per HTTP method or for all methods using `ALL`.

```typescript
universalApi({
  pagination: {
    // Apply to all GET requests
    GET: {
      type: 'query-param',
      limit: 'limit',
      skip: 'skip',
      sort: 'sortBy',
      order: 'order'
    },
    // Different config for POST
    POST: {
      type: 'body',
      root: 'pagination',
      limit: 'pageSize',
      skip: 'offset'
    }
  }
})
```

::: warning Requirements
Pagination works **only** with:
- ✅ File-based endpoints returning JSON arrays
- ✅ Methods: GET, POST, HEAD, DELETE
- ❌ Does NOT work with custom handlers (unless explicitly implemented)
:::

## Filter Configuration

### filters

- **Type**: `Partial<Record<'ALL' | 'HEAD' | 'GET' | 'POST' | 'DELETE', FilterConfig>> | null`
- **Default**: `null`

Global filter configuration for file-based endpoints.

```typescript
universalApi({
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
          key: 'age',
          valueType: 'number',
          comparison: 'gte'
        }
      ]
    }
  }
})
```

**Comparison operators:**
- `eq`: equals (==)
- `ne`: not equals (!=)
- `gt`: greater than (>)
- `gte`: greater than or equal (>=)
- `lt`: less than (<)
- `lte`: less than or equal (<=)
- `in`: value in array
- `nin`: value not in array
- `regex`: regular expression match (use `regexFlags` for flags, e.g. `"i"` for case-insensitive)

::: warning Requirements
Filters work **only** with:
- ✅ File-based endpoints returning JSON arrays
- ✅ Methods: GET, POST, HEAD, DELETE
- ❌ Does NOT work with custom handlers (unless explicitly implemented)
:::

## Complete Example

```typescript
import { defineConfig } from 'vite'
// import mockApi from '@ndriadev/vite-plugin-universal-api' //Default export
import { universalApi } from '@ndriadev/vite-plugin-universal-api' // Named export

export default defineConfig({
  plugins: [
    universalApi({
      // Basic options
      disable: false,
      logLevel: 'debug',
      endpointPrefix: '/api',
      fsDir: 'mock',

      // Preview behaviour
      enablePreview: false, // Disable mocks when running vite preview

      // Performance
      delay: 500,
      gatewayTimeout: 5000,

      // Behavior
      noHandledRestFsRequestsAction: '404',

      // Parsing
      parser: true,

      // Middleware
      handlerMiddlewares: [
        async (req, res, next) => {
          console.log(`${req.method} ${req.url}`)
          next()
        }
      ],

      errorMiddlewares: [
        (err, req, res, next) => {
          console.error(err)
          res.writeHead(500)
          res.end('Server Error')
        }
      ],

      // REST handlers
      handlers: [
        {
          pattern: '/users/{id}',
          method: 'GET',
          handle: async (req, res) => {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ id: req.params?.id }))
          }
        }
      ],

      // WebSocket
      enableWs: true,
      wsHandlers: [
        {
          pattern: '/ws/chat',
          heartbeat: 30000,
          onMessage: (conn, msg) => {
            conn.broadcast(msg)
          }
        }
      ],

      // Pagination
      pagination: {
        GET: {
          type: 'query-param',
          limit: 'limit',
          skip: 'skip'
        }
      },

      // Filters
      filters: {
        GET: {
          type: 'query-param',
          filters: [
            { key: 'status', valueType: 'string', comparison: 'eq' }
          ]
        }
      }
    })
  ]
})
```
