# WebSocket

Real-time bidirectional communication between client and server using WebSocket protocol (RFC 6455).

## Overview

WebSocket support includes:

- ✅ Rooms and broadcasting
- ✅ Authentication
- ✅ Heartbeat/ping-pong
- ✅ Message compression
- ✅ Event handlers (connect, message, close, error)
- ✅ Full RFC 6455 compliance

## Basic Setup

```typescript
import { defineConfig } from 'vite'
import mockApi from '@ndriadev/vite-plugin-universal-api'

export default defineConfig({
  plugins: [
    mockApi({
      endpointPrefix: '/api',
      enableWs: true,  // Enable WebSocket

      wsHandlers: [
        {
          pattern: '/ws/chat',

          onConnect: (conn) => {
            console.log('Client connected:', conn.id)
            conn.send({ type: 'welcome', message: 'Welcome!' })
          },

          onMessage: (conn, data) => {
            console.log('Received:', data)
            conn.broadcast(data, { includeSelf: true })
          },

          onClose: (conn, code, reason) => {
            console.log('Client disconnected:', conn.id)
          }
        }
      ]
    })
  ]
})
```

## Client Connection

```typescript
const ws = new WebSocket('ws://localhost:5173/api/ws/chat')

ws.onopen = () => {
  console.log('Connected!')
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
  console.log('Disconnected')
}
```

## Event Handlers

### onConnect

Called when a client connects:

```typescript
{
  pattern: '/ws/chat',

  onConnect: (conn) => {
    // Send welcome message
    conn.send({
      type: 'connected',
      id: conn.id,
      timestamp: Date.now()
    })

    // Access connection info
    console.log('New connection:', {
      id: conn.id,
      rooms: conn.rooms,
      ip: conn.req.socket.remoteAddress
    })
  }
}
```

### onMessage

Called when a message is received:

```typescript
{
  pattern: '/ws/chat',

  onMessage: (conn, data) => {
    // data is automatically parsed JSON

    switch (data.type) {
      case 'chat':
        conn.broadcast({
          type: 'message',
          from: data.username,
          text: data.text,
          timestamp: Date.now()
        }, { includeSelf: true })
        break

      case 'typing':
        conn.broadcast({
          type: 'typing',
          username: data.username
        }, { includeSelf: false })
        break
    }
  }
}
```

### onClose

Called when connection closes:

```typescript
{
  pattern: '/ws/chat',

  onClose: (conn, code, reason) => {
    console.log(`Connection ${conn.id} closed:`, code, reason)

    // Notify other users
    conn.broadcast({
      type: 'user-left',
      userId: conn.id
    })
  }
}
```

### onError

Called on errors:

```typescript
{
  pattern: '/ws/chat',

  onError: (conn, error) => {
    console.error('WebSocket error:', error)

    // Handle specific errors
    if (error.message.includes('timeout')) {
      conn.close(1000, 'Timeout')
    }
  }
}
```

## Rooms

Group connections into rooms for targeted broadcasting:

```typescript
{
  pattern: '/ws/chat',

  onMessage: (conn, data) => {
    switch (data.type) {
      case 'join-room':
        // Join a room
        conn.joinRoom(data.room)

        // Notify room members
        conn.broadcast({
          type: 'user-joined',
          username: data.username,
          room: data.room
        }, {
          rooms: [data.room],
          includeSelf: false
        })
        break

      case 'leave-room':
        // Leave a room
        conn.leaveRoom(data.room)
        break

      case 'message':
        // Broadcast to specific room
        conn.broadcast({
          type: 'chat-message',
          from: data.username,
          text: data.text
        }, {
          rooms: [data.room],
          includeSelf: true
        })
        break
    }
  }
}
```

Client usage:

```typescript
// Join room
ws.send(JSON.stringify({
  type: 'join-room',
  room: 'general',
  username: 'Alice'
}))

// Send to room
ws.send(JSON.stringify({
  type: 'message',
  room: 'general',
  username: 'Alice',
  text: 'Hello everyone!'
}))
```

## Authentication

Authenticate connections before accepting:

```typescript
{
  pattern: '/ws/private',

  authenticate: async (req) => {
    // Get token from query params
    const url = new URL(req.url!, 'ws://localhost')
    const token = url.searchParams.get('token')

    if (!token) {
      return {
        success: false,
        code: 4001,
        reason: 'No token provided'
      }
    }

    try {
      const user = await verifyToken(token)
      return {
        success: true,
        data: { user }  // Stored in conn.authData
      }
    } catch (err) {
      return {
        success: false,
        code: 4002,
        reason: 'Invalid token'
      }
    }
  },

  onConnect: (conn) => {
    // Access authenticated user data
    const user = conn.authData.user
    conn.send({
      type: 'authenticated',
      user
    })
  }
}
```

Client with authentication:

```typescript
const token = 'your-jwt-token'
const ws = new WebSocket(`ws://localhost:5173/api/ws/private?token=${token}`)
```

## Heartbeat

Keep connections alive with automatic ping/pong:

```typescript
{
  pattern: '/ws/chat',
  heartbeat: 30000,  // 30 seconds

  onConnect: (conn) => {
    // Heartbeat automatically starts
    console.log('Heartbeat interval:', 30000)
  }
}
```

## Compression

Enable per-message compression:

```typescript
{
  pattern: '/ws/chat',
  compression: {
    enabled: true,
    threshold: 1024  // Only compress messages > 1KB
  }
}
```

## Broadcasting

### Broadcast to All

```typescript
conn.broadcast({ type: 'announcement', text: 'Server restart in 5 minutes' })
```

### Broadcast to Rooms

```typescript
conn.broadcast(
  { type: 'room-message', text: 'Hello room!' },
  { rooms: ['general', 'dev'] }
)
```

### Include/Exclude Self

```typescript
// Include sender
conn.broadcast(data, { includeSelf: true })

// Exclude sender (default)
conn.broadcast(data, { includeSelf: false })
```

## Examples

### Chat Application

```typescript
{
  pattern: '/ws/chat',

  onConnect: (conn) => {
    conn.send({ type: 'connected', id: conn.id })
  },

  onMessage: (conn, data) => {
    switch (data.type) {
      case 'join':
        conn.joinRoom('chat')
        conn.broadcast({
          type: 'user-joined',
          username: data.username
        }, { rooms: ['chat'] })
        break

      case 'message':
        conn.broadcast({
          type: 'chat-message',
          username: data.username,
          message: data.message,
          timestamp: Date.now()
        }, { rooms: ['chat'], includeSelf: true })
        break
    }
  }
}
```

### Game Server

```typescript
{
  pattern: '/ws/game',
  heartbeat: 10000,

  onConnect: (conn) => {
    conn.joinRoom('lobby')
    conn.send({ type: 'joined-lobby' })
  },

  onMessage: (conn, data) => {
    switch (data.type) {
      case 'create-game':
        const gameId = generateGameId()
        conn.joinRoom(gameId)
        conn.send({ type: 'game-created', gameId })
        break

      case 'join-game':
        conn.joinRoom(data.gameId)
        conn.broadcast({
          type: 'player-joined',
          playerId: conn.id
        }, { rooms: [data.gameId] })
        break

      case 'game-action':
        conn.broadcast({
          type: 'game-update',
          action: data.action,
          playerId: conn.id
        }, { rooms: [data.gameId], includeSelf: true })
        break
    }
  }
}
```

## Connection Object API

```typescript
interface IWebSocketConnection {
  id: string                    // Unique connection ID
  rooms: Set<string>            // Joined rooms
  authData: any                 // From authenticate()
  req: IncomingMessage          // Original HTTP request

  send(data: any): void         // Send to this connection

  broadcast(                    // Broadcast to others
    data: any,
    options?: {
      rooms?: string[]
      includeSelf?: boolean
    }
  ): void

  joinRoom(room: string): void  // Join a room
  leaveRoom(room: string): void // Leave a room

  ping(): void                  // Send ping
  pong(): void                  // Send pong

  close(code?: number, reason?: string): void  // Close connection
}
```

## Close Codes

Standard WebSocket close codes:

| Code | Name | Description |
|------|------|-------------|
| 1000 | Normal Closure | Successful operation |
| 1001 | Going Away | Server/client going down |
| 1002 | Protocol Error | Protocol error |
| 1003 | Unsupported Data | Received unsupported data type |
| 1007 | Invalid Payload | Received invalid data (e.g., non-UTF-8) |
| 1008 | Policy Violation | Received message violating policy |
| 1009 | Message Too Big | Message too large |
| 1011 | Internal Error | Server encountered unexpected condition |
| 4000-4999 | Custom | Application-specific codes |

## Best Practices

### 1. Always Parse Messages

```typescript
onMessage: (conn, data) => {
  // data is already parsed JSON
  // No need to JSON.parse()
}
```

### 2. Handle Errors Gracefully

```typescript
onError: (conn, error) => {
  console.error('WebSocket error:', error)
  // Don't crash the server
}
```

### 3. Clean Up on Close

```typescript
onClose: (conn, code, reason) => {
  // Clean up resources
  removeUserFromActiveList(conn.id)

  // Notify others
  conn.broadcast({ type: 'user-left', userId: conn.id })
}
```

### 4. Use Rooms for Organization

```typescript
// Instead of tracking users manually
const users = new Map()

// Use rooms
conn.joinRoom('lobby')
conn.joinRoom('game-123')
```

## Next Steps

- [Examples](/examples/websocket-chat) - Chat example
- [Examples](/examples/websocket-game) - Game server example
- [API Reference](/api/websocket-handlers) - Complete API
