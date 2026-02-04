# Examples

Practical, real-world examples showing how to use vite-plugin-ws-rest-fs-api in different scenarios.

## Overview

Browse through these examples to learn common patterns and best practices:

### File-Based Mocking
- [Simple File-Based API](/examples/file-based) - Basic JSON file serving
- Static mock data for rapid prototyping

### REST API Examples
- [Custom Handlers](/examples/custom-handlers) - Dynamic REST endpoints
- [Stateful Server](/examples/stateful-server) - In-memory database
- [Authentication](/examples/authentication) - JWT-based auth

### WebSocket Examples
- [WebSocket Chat](/examples/websocket-chat) - Real-time chat with rooms
- [WebSocket Game](/examples/websocket-game) - Multiplayer game server

## Quick Examples

### 1. File-Based API

Serve JSON files directly:

```typescript
// vite.config.ts
import mockApi from '@ndriadev/vite-plugin-ws-rest-fs-api'

export default {
  plugins: [
    mockApi({
      endpointPrefix: '/api',
      fsDir: 'mock'
    })
  ]
}
```

```json
// mock/users.json → GET /api/users
[
  {"id": 1, "name": "Alice"},
  {"id": 2, "name": "Bob"}
]
```

### 2. REST Handler

Custom endpoint with logic:

```typescript
mockApi({
  handlers: [
    {
      pattern: '/users/{id}',
      method: 'GET',
      handle: async (req, res) => {
        const user = await db.findUser(req.params.id)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(user))
      }
    }
  ]
})
```

### 3. WebSocket Chat

Real-time messaging:

```typescript
mockApi({
  enableWs: true,
  wsHandlers: [
    {
      pattern: '/ws/chat',
      onMessage: (conn, msg) => {
        conn.broadcast(msg, { includeSelf: true })
      }
    }
  ]
})
```

## Browse All Examples

Click on any example below to see the complete implementation:

<div class="examples-grid">

### 📁 File-Based
- [Basic File Serving](/examples/file-based)
- Pagination & Filtering
- Directory Structure

### 🔄 REST APIs
- [Custom Handlers](/examples/custom-handlers)
- [CRUD Operations](/examples/stateful-server)
- [Authentication](/examples/authentication)

### ⚡ WebSocket
- [Chat Application](/examples/websocket-chat)
- [Game Server](/examples/websocket-game)
- Rooms & Broadcasting

</div>

## Example Project Structure

Typical project layout using all three approaches:

```
my-app/
├── mock/                       # File-based API
│   ├── users.json             # GET /api/users
│   ├── posts/
│   │   └── index.json         # GET /api/posts
│   └── products/
│       ├── 1.json             # GET /api/products/1
│       └── 2.json             # GET /api/products/2
│
├── src/
│   ├── main.ts
│   └── api/
│       ├── users.ts           # Fetch from /api/users
│       └── websocket.ts       # Connect to WebSocket
│
└── vite.config.ts             # Plugin configuration
```

## Common Use Cases

### Development Workflow

```typescript
mockApi({
  endpointPrefix: '/api',
  fsDir: 'mock',
  logLevel: 'debug',           // See all requests
  delay: 500,                   // Simulate network latency
  
  handlers: [
    // Override specific endpoints
    {
      pattern: '/users/me',
      method: 'GET',
      handle: (req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ 
          id: 1, 
          name: 'Dev User',
          role: 'admin' 
        }))
      }
    }
  ]
})
```

### Testing Edge Cases

```typescript
mockApi({
  handlers: [
    // Simulate errors
    {
      pattern: '/api/error',
      method: 'GET',
      handle: (req, res) => {
        res.writeHead(500)
        res.end('Internal Server Error')
      }
    },
    
    // Simulate slow responses
    {
      pattern: '/api/slow',
      method: 'GET',
      delay: 5000,
      handle: (req, res) => {
        res.writeHead(200)
        res.end('Finally!')
      }
    },
    
    // Simulate timeout
    {
      pattern: '/api/timeout',
      method: 'GET',
      delay: 35000,  // Exceeds gatewayTimeout
      handle: (req, res) => {
        // Will timeout before this executes
      }
    }
  ]
})
```

### Prototyping New Features

```typescript
mockApi({
  fsDir: 'mock',
  
  handlers: [
    // New feature being developed
    {
      pattern: '/beta/feature',
      method: 'POST',
      handle: async (req, res) => {
        // Test new endpoint before backend is ready
        const result = await processNewFeature(req.body)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(result))
      }
    }
  ],
  
  // Real-time updates for new feature
  enableWs: true,
  wsHandlers: [
    {
      pattern: '/ws/beta',
      onMessage: (conn, data) => {
        conn.broadcast({ type: 'beta-update', data })
      }
    }
  ]
})
```

## Integration Examples

### With React

```tsx
// src/hooks/useWebSocket.ts
import { useEffect, useState } from 'react'

export function useWebSocket(url: string) {
  const [ws, setWs] = useState<WebSocket | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  
  useEffect(() => {
    const socket = new WebSocket(url)
    
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data)
      setMessages(prev => [...prev, data])
    }
    
    setWs(socket)
    
    return () => socket.close()
  }, [url])
  
  const send = (data: any) => {
    ws?.send(JSON.stringify(data))
  }
  
  return { messages, send }
}

// In component
function ChatComponent() {
  const { messages, send } = useWebSocket('ws://localhost:5173/api/ws/chat')
  
  return (
    <div>
      {messages.map((msg, i) => (
        <div key={i}>{msg.text}</div>
      ))}
      <button onClick={() => send({ text: 'Hello!' })}>
        Send
      </button>
    </div>
  )
}
```

### With Vue

```vue
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const messages = ref<any[]>([])
let ws: WebSocket | null = null

onMounted(() => {
  ws = new WebSocket('ws://localhost:5173/api/ws/chat')
  
  ws.onmessage = (event) => {
    messages.value.push(JSON.parse(event.data))
  }
})

onUnmounted(() => {
  ws?.close()
})

function sendMessage(text: string) {
  ws?.send(JSON.stringify({ text }))
}
</script>

<template>
  <div>
    <div v-for="(msg, i) in messages" :key="i">
      {{ msg.text }}
    </div>
    <button @click="sendMessage('Hello!')">Send</button>
  </div>
</template>
```

## Next Steps

Ready to build? Pick an example that matches your use case:

- **Starting simple?** → [File-Based API](/examples/file-based)
- **Need custom logic?** → [Custom Handlers](/examples/custom-handlers)
- **Building chat/notifications?** → [WebSocket Chat](/examples/websocket-chat)
- **Need authentication?** → [Authentication](/examples/authentication)
- **Want full CRUD?** → [Stateful Server](/examples/stateful-server)

<style>
.examples-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-top: 2rem;
}

.examples-grid > div {
  padding: 1.5rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
}

.examples-grid h3 {
  margin-top: 0;
  border-bottom: 2px solid var(--vp-c-brand);
  padding-bottom: 0.5rem;
}

.examples-grid ul {
  list-style: none;
  padding-left: 0;
}

.examples-grid li {
  padding: 0.25rem 0;
}
</style>
