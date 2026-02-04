# Quick Start

Get up and running with vite-plugin-ws-rest-fs-api in minutes. This guide covers all three approaches: File-System API, REST Handlers, and WebSocket.

## Three Approaches in One Plugin

This plugin offers three complementary ways to mock APIs:

1. **📁 File-System API** - Zero-config file serving
2. **🔄 REST Handlers** - Custom programmatic handlers  
3. **⚡ WebSocket** - Real-time bidirectional communication

You can use one, two, or all three approaches together!

## Approach 1: File-System API

Perfect for static mock data and quick prototyping.

### Step 1: Configure Plugin

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import mockApi from '@ndriadev/vite-plugin-ws-rest-fs-api'

export default defineConfig({
  plugins: [
    mockApi({
      endpointPrefix: '/api',
      fsDir: 'mock'
    })
  ]
})
```

### Step 2: Create Mock Files

```
project/
├── mock/
│   ├── users.json          → /api/users
│   ├── users/
│   │   └── 123.json        → /api/users/123
│   └── posts/
│       └── index.json      → /api/posts
└── vite.config.ts
```

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

### Step 3: Use in Your App

```typescript
// In your React/Vue/Svelte app
async function fetchUsers() {
  const response = await fetch('/api/users')
  const users = await response.json()
  console.log(users)
}
```

### With Pagination & Filters

Add pagination and filtering configuration:

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
  },
  filters: {
    GET: {
      type: 'query-param',
      filters: [
        { key: 'status', valueType: 'string', comparison: 'eq' }
      ]
    }
  }
})
```

Now you can use query parameters:

```typescript
// Paginated request
fetch('/api/users?limit=10&skip=0&sortBy=name&order=asc')

// Filtered request
fetch('/api/users?status=active')

// Combined
fetch('/api/users?status=active&limit=5&sortBy=name')
```

## Approach 2: REST Handlers

For dynamic responses and custom logic.

### Basic Handler

```typescript
mockApi({
  endpointPrefix: '/api',
  handlers: [
    {
      pattern: '/users/{id}',
      method: 'GET',
      handle: async (req, res) => {
        const userId = req.params.id
        
        // Your custom logic
        const user = await findUserInDatabase(userId)
        
        if (!user) {
          res.writeHead(404, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'User not found' }))
          return
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(user))
      }
    }
  ]
})
```

### Multiple HTTP Methods

```typescript
mockApi({
  handlers: [
    // GET: Fetch user
    {
      pattern: '/users/{id}',
      method: 'GET',
      handle: async (req, res) => {
        const user = users.find(u => u.id === req.params.id)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(user))
      }
    },
    
    // POST: Create user
    {
      pattern: '/users',
      method: 'POST',
      handle: async (req, res) => {
        const newUser = {
          id: generateId(),
          ...req.body
        }
        users.push(newUser)
        
        res.writeHead(201, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(newUser))
      }
    },
    
    // PUT: Update user
    {
      pattern: '/users/{id}',
      method: 'PUT',
      handle: async (req, res) => {
        const index = users.findIndex(u => u.id === req.params.id)
        if (index === -1) {
          res.writeHead(404)
          res.end()
          return
        }
        
        users[index] = { id: req.params.id, ...req.body }
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(users[index]))
      }
    },
    
    // DELETE: Remove user
    {
      pattern: '/users/{id}',
      method: 'DELETE',
      handle: async (req, res) => {
        const index = users.findIndex(u => u.id === req.params.id)
        if (index === -1) {
          res.writeHead(404)
          res.end()
          return
        }
        
        users.splice(index, 1)
        res.writeHead(204)
        res.end()
      }
    }
  ]
})
```

### With Middleware

```typescript
// In-memory database
const db = {
  users: []
}

mockApi({
  // Global middleware runs before all handlers
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
        req.body.user = await verifyToken(token)
        next()
      } catch (err) {
        res.writeHead(401, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Invalid token' }))
      }
    }
  ],
  
  handlers: [
    {
      pattern: '/protected/data',
      method: 'GET',
      handle: async (req, res) => {
        // req.body.user is available from middleware
        const data = getDataForUser(req.body.user)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(data))
      }
    }
  ]
})
```

## Approach 3: WebSocket

For real-time features like chat, notifications, live updates.

### Basic WebSocket Server

```typescript
mockApi({
  endpointPrefix: '/api',
  enableWs: true,
  wsHandlers: [
    {
      pattern: '/ws/chat',
      onConnect: (conn) => {
        console.log('Client connected:', conn.id)
        conn.send({ type: 'welcome', message: 'Connected to chat!' })
      },
      
      onMessage: (conn, data) => {
        console.log('Message received:', data)
        
        // Broadcast to all clients
        conn.broadcast(data, { includeSelf: true })
      },
      
      onClose: (conn, code, reason) => {
        console.log('Client disconnected:', conn.id, code, reason)
      }
    }
  ]
})
```

### Client-Side Connection

```typescript
// In your app
const ws = new WebSocket('ws://localhost:5173/api/ws/chat')

ws.onopen = () => {
  console.log('Connected to WebSocket')
  ws.send(JSON.stringify({ type: 'join', username: 'Alice' }))
}

ws.onmessage = (event) => {
  const data = JSON.parse(event.data)
  console.log('Received:', data)
}

ws.onerror = (error) => {
  console.error('WebSocket error:', error)
}

ws.onclose = () => {
  console.log('Disconnected from WebSocket')
}
```

### Chat Room Example

```typescript
const chatRooms = new Map()

mockApi({
  enableWs: true,
  wsHandlers: [
    {
      pattern: '/ws/chat',
      
      onConnect: (conn) => {
        conn.send({ type: 'connected', id: conn.id })
      },
      
      onMessage: (conn, data) => {
        switch (data.type) {
          case 'join':
            const room = data.room || 'general'
            conn.joinRoom(room)
            
            conn.broadcast(
              { type: 'user-joined', username: data.username },
              { rooms: [room], includeSelf: false }
            )
            break
            
          case 'message':
            conn.broadcast(
              {
                type: 'chat-message',
                username: data.username,
                message: data.message,
                timestamp: Date.now()
              },
              { rooms: [data.room], includeSelf: true }
            )
            break
            
          case 'leave':
            conn.leaveRoom(data.room)
            conn.broadcast(
              { type: 'user-left', username: data.username },
              { rooms: [data.room] }
            )
            break
        }
      }
    }
  ]
})
```

### With Authentication

```typescript
mockApi({
  enableWs: true,
  wsHandlers: [
    {
      pattern: '/ws/private',
      
      // Authenticate on connection
      authenticate: async (req) => {
        const token = new URL(req.url!, 'ws://localhost').searchParams.get('token')
        
        if (!token) {
          return { 
            success: false, 
            code: 4001, 
            reason: 'No token provided' 
          }
        }
        
        try {
          const user = await verifyToken(token)
          return { success: true, data: { user } }
        } catch (err) {
          return { 
            success: false, 
            code: 4002, 
            reason: 'Invalid token' 
          }
        }
      },
      
      onConnect: (conn) => {
        // conn.authData contains the user from authenticate
        conn.send({ 
          type: 'authenticated', 
          user: conn.authData.user 
        })
      },
      
      onMessage: (conn, data) => {
        // Use conn.authData.user for authorization
        if (hasPermission(conn.authData.user, data.action)) {
          processMessage(data)
        } else {
          conn.send({ type: 'error', message: 'Permission denied' })
        }
      }
    }
  ]
})
```

Client with token:

```typescript
const token = 'your-jwt-token'
const ws = new WebSocket(`ws://localhost:5173/api/ws/private?token=${token}`)
```

## Combining All Three Approaches

You can use all three approaches together:

```typescript
mockApi({
  endpointPrefix: '/api',
  fsDir: 'mock',  // File-based API
  
  // REST handlers for dynamic endpoints
  handlers: [
    {
      pattern: '/users/search',
      method: 'POST',
      handle: async (req, res) => {
        const results = await searchUsers(req.body.query)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(results))
      }
    }
  ],
  
  // WebSocket for real-time features
  enableWs: true,
  wsHandlers: [
    {
      pattern: '/ws/notifications',
      onConnect: (conn) => {
        conn.send({ type: 'connected' })
      },
      onMessage: (conn, data) => {
        // Handle real-time notifications
      }
    }
  ]
})
```

Now your app has:
- 📁 **File-based endpoints**: `/api/users`, `/api/posts`, etc.
- 🔄 **Dynamic REST API**: `/api/users/search`
- ⚡ **Real-time updates**: `ws://localhost:5173/api/ws/notifications`

## Development Features

### Simulate Network Delay

```typescript
mockApi({
  delay: 1000, // All requests delayed by 1 second
  handlers: [
    {
      pattern: '/slow-endpoint',
      method: 'GET',
      delay: 3000, // Override: 3 seconds for this endpoint
      handle: async (req, res) => {
        res.writeHead(200)
        res.end('Slow response')
      }
    }
  ]
})
```

### Debug Logging

```typescript
mockApi({
  logLevel: 'debug', // See all requests and responses
  endpointPrefix: '/api',
  fsDir: 'mock'
})
```

## Next Steps

Now that you understand the basics:

- 📖 [File-System API Guide](/guide/file-system-api) - Deep dive into file-based mocking
- 🎯 [REST Handlers Guide](/guide/rest-handlers) - Master custom handlers
- ⚡ [WebSocket Guide](/guide/websocket) - Build real-time features
- 💡 [Examples](/examples/) - Real-world use cases
- 📚 [API Reference](/api/) - Complete API documentation

## Common Patterns

### CRUD Operations

```typescript
const db = { users: [] }

mockApi({
  handlers: [
    // Create
    { pattern: '/users', method: 'POST', handle: (req, res) => {
      const user = { id: Date.now(), ...req.body }
      db.users.push(user)
      res.writeHead(201, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(user))
    }},
    
    // Read (all)
    { pattern: '/users', method: 'GET', handle: (req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(db.users))
    }},
    
    // Read (one)
    { pattern: '/users/{id}', method: 'GET', handle: (req, res) => {
      const user = db.users.find(u => u.id == req.params.id)
      res.writeHead(user ? 200 : 404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(user || { error: 'Not found' }))
    }},
    
    // Update
    { pattern: '/users/{id}', method: 'PUT', handle: (req, res) => {
      const index = db.users.findIndex(u => u.id == req.params.id)
      if (index === -1) {
        res.writeHead(404)
        res.end()
        return
      }
      db.users[index] = { id: req.params.id, ...req.body }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(db.users[index]))
    }},
    
    // Delete
    { pattern: '/users/{id}', method: 'DELETE', handle: (req, res) => {
      const index = db.users.findIndex(u => u.id == req.params.id)
      if (index === -1) {
        res.writeHead(404)
        res.end()
        return
      }
      db.users.splice(index, 1)
      res.writeHead(204)
      res.end()
    }}
  ]
})
```

### Error Handling

```typescript
mockApi({
  errorMiddlewares: [
    (err, req, res, next) => {
      console.error('Error:', err)
      
      // Custom error types
      if (err.name === 'ValidationError') {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ 
          error: 'Validation failed',
          details: err.errors 
        }))
      } else if (err.name === 'NotFoundError') {
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Resource not found' }))
      } else {
        // Generic error
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Internal server error' }))
      }
    }
  ]
})
```

## Tips

::: tip File Organization
Structure your mock files to match your API:
```
mock/
├── v1/
│   ├── users.json
│   └── posts.json
└── v2/
    ├── users.json
    └── posts.json
```
:::

::: tip Hot Reload
Changes to mock files are automatically detected - just edit and save!
:::

::: tip TypeScript
The plugin is fully typed. Import types for better IDE support:
```typescript
import type { 
  ApiWsRestFsRequest, 
  IWebSocketConnection 
} from '@ndriadev/vite-plugin-ws-rest-fs-api'
```
:::
