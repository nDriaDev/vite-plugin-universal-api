# WebSocket

Real-time bidirectional communication between client and server using the WebSocket protocol (RFC 6455).

## Overview

WebSocket support includes:

- ✅ Rooms and broadcasting
- ✅ Authentication
- ✅ Heartbeat / ping-pong
- ✅ Per-message compression (`permessage-deflate`)
- ✅ Sub-protocol negotiation
- ✅ Inactivity timeout
- ✅ Declarative response matching
- ✅ Full RFC 6455 compliance (via the `ws` library)

## Basic Setup

```typescript
import { defineConfig } from 'vite'
// import mockApi from '@ndriadev/vite-plugin-universal-api' //Default export
import { universalApi } from '@ndriadev/vite-plugin-universal-api' // Named export

export default defineConfig({
  plugins: [
    universalApi({
      endpointPrefix: '/api',
      enableWs: true,  // Enable WebSocket support

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

Called when a client successfully completes the WebSocket handshake. Receives the connection object and the original HTTP upgrade request.

```typescript
{
  pattern: '/ws/chat',

  onConnect: (conn, req) => {
    // Send welcome message
    conn.send({
      type: 'connected',
      id: conn.id,
      timestamp: Date.now()
    })

    // Store user info for later
    const url = new URL(req.url!, 'ws://localhost')
    conn.metadata.username = url.searchParams.get('username') ?? 'Anonymous'
  }
}
```

### onMessage

Called when a data frame is received. `data` is:
- A parsed JSON object/value when the payload is valid JSON
- A plain string for non-JSON text frames
- A `Buffer` for binary frames
- Whatever `transformRawData` returns, if configured

```typescript
{
  pattern: '/ws/chat',

  onMessage: (conn, data) => {
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

Called when the connection closes.

```typescript
{
  pattern: '/ws/chat',

  onClose: (conn, code, reason, initiatedByClient) => {
    console.log(`Connection ${conn.id} closed: ${code} ${reason}`)

    // Notify other users
    conn.broadcast({
      type: 'user-left',
      userId: conn.id,
      username: conn.metadata.username
    })
  }
}
```

### onError

Called on socket errors. If not provided, the plugin sends `{ type: 'error', message }` to the client automatically.

```typescript
{
  pattern: '/ws/chat',

  onError: (conn, error) => {
    console.error('WebSocket error:', error)
  }
}
```

### onPing / onPong

Override the default ping/pong behaviour. If `onPing` is not provided, the plugin replies with a pong automatically.

```typescript
{
  pattern: '/ws/chat',
  onPing: (conn, data) => {
    console.log('Ping from', conn.id)
    conn.pong(data)  // Respond manually
  },
  onPong: (conn, data) => {
    console.log('Pong received from', conn.id)
  }
}
```

## Rooms

Group connections into rooms for targeted broadcasting.

```typescript
{
  pattern: '/ws/chat',

  onMessage: (conn, data) => {
    switch (data.type) {
      case 'join-room':
        conn.joinRoom(data.room)
        conn.broadcast(
          { type: 'user-joined', username: data.username, room: data.room },
          { room: data.room, includeSelf: false }
        )
        break

      case 'leave-room':
        conn.leaveRoom(data.room)
        break

      case 'message':
        conn.broadcast(
          { type: 'chat-message', from: data.username, text: data.text },
          { room: data.room, includeSelf: true }
        )
        break
    }
  }
}
```

### Default Room

Automatically join every new connection to a room:

```typescript
{
  pattern: '/ws/lobby',
  defaultRoom: 'lobby'
}
```

## Authentication

Authenticate connections before completing the handshake. Return `false` (or a rejected Promise) to reject with `401 Unauthorized`.

```typescript
{
  pattern: '/ws/private',

  authenticate: async (req) => {
    const url = new URL(req.url!, 'ws://localhost')
    const token = url.searchParams.get('token')

    if (!token) return false

    try {
      await verifyToken(token)
      return true
    } catch {
      return false
    }
  },

  onConnect: (conn, req) => {
    const url = new URL(req.url!, 'ws://localhost')
    conn.metadata.token = url.searchParams.get('token')
    conn.send({ type: 'authenticated' })
  }
}
```

Client with authentication:

```typescript
const token = 'your-jwt-token'
const ws = new WebSocket(`ws://localhost:5173/api/ws/private?token=${token}`)
```

## Heartbeat

Keep connections alive and detect silent disconnections:

```typescript
{
  pattern: '/ws/chat',
  heartbeat: 30000  // Ping every 30 seconds

  // The plugin disconnects the client after 3 consecutive missed pongs
}
```

## Inactivity Timeout

Close connections that stop sending data:

```typescript
{
  pattern: '/ws/chat',
  inactivityTimeout: 300000  // Close after 5 minutes of silence
}
```

## Compression

Enable per-message compression for bandwidth-intensive connections:

```typescript
// Accept whatever compression parameters the client negotiates
{
  pattern: '/ws/chat',
  perMessageDeflate: true
}

// Fine-grained control
{
  pattern: '/ws/chat',
  perMessageDeflate: {
    serverNoContextTakeover: true,  // Reset context each message (lower memory)
    clientNoContextTakeover: false,
    serverMaxWindowBits: 13,        // Window size (8–15)
    clientMaxWindowBits: 15,
    strict: false  // Reject connections that cannot match these params
  }
}
```

::: tip
Compression is handled by the `ws` library — no additional dependencies or configuration required on the server side beyond the handler option above.
:::

## Sub-Protocol Negotiation

```typescript
{
  pattern: '/ws/chat',
  subprotocols: ['chat.v2', 'chat.v1']  // Preference order
}
```

The plugin selects the first protocol that both the client and server agree on and includes it in the handshake response (`Sec-WebSocket-Protocol`).

## Declarative Responses

Define response rules declaratively instead of using `onMessage`:

```typescript
{
  pattern: '/ws/echo',
  responses: [
    {
      // Match by message type
      match: (conn, msg) => msg.type === 'ping',
      response: { type: 'pong' }
    },
    {
      // Dynamic response via function
      match: (conn, msg) => msg.type === 'echo',
      response: (conn, msg) => ({ type: 'echo', data: msg.data })
    },
    {
      // Broadcast to a room
      match: (conn, msg) => msg.type === 'announce',
      response: (conn, msg) => ({ type: 'announcement', text: msg.text }),
      broadcast: { room: 'lobby', includeSelf: true }
    }
  ]
}
```

If no rule matches, `onMessage` is called as a fallback.

## Broadcasting

### Send to Sender Only

```typescript
conn.send({ type: 'ack', id: msg.id })
```

### Broadcast to All (Excluding Sender)

```typescript
conn.broadcast({ type: 'announcement', text: 'Server restart in 5 minutes' })
```

### Broadcast to a Room

```typescript
conn.broadcast(
  { type: 'room-message', text: 'Hello room!' },
  { room: 'general' }
)
```

### Broadcast Including Sender

```typescript
conn.broadcast(data, { includeSelf: true })
```

### Broadcast to All Rooms This Connection Belongs To

```typescript
conn.broadcastAllRooms({ type: 'global-update' }, false) // includeSelf is required
```

## Connection Metadata

Attach arbitrary data to a connection and access it in any event handler:

```typescript
{
  pattern: '/ws/chat',

  onConnect: (conn, req) => {
    const url = new URL(req.url!, 'ws://localhost')
    conn.metadata.username = url.searchParams.get('username') ?? 'Guest'
    conn.metadata.joinedAt = Date.now()
  },

  onMessage: (conn, data) => {
    // Access metadata set during onConnect
    conn.broadcast({
      type: 'message',
      from: conn.metadata.username,
      text: data.text
    })
  }
}
```

## Examples

### Chat Application

```typescript
{
  pattern: '/ws/chat',
  defaultRoom: 'general',
  heartbeat: 30000,

  onConnect: (conn, req) => {
    const url = new URL(req.url!, 'ws://localhost')
    conn.metadata.username = url.searchParams.get('username') ?? 'Guest'
    conn.send({ type: 'connected', id: conn.id })

    conn.broadcast(
      { type: 'user-joined', username: conn.metadata.username },
      { room: 'general', includeSelf: false }
    )
  },

  onMessage: (conn, data) => {
    switch (data.type) {
      case 'chat':
        conn.broadcast(
          { type: 'chat-message', from: conn.metadata.username, text: data.text, ts: Date.now() },
          { room: 'general', includeSelf: true }
        )
        break
    }
  },

  onClose: (conn) => {
    conn.broadcast(
      { type: 'user-left', username: conn.metadata.username },
      { room: 'general' }
    )
  }
}
```

### Game Server

```typescript
{
  pattern: '/ws/game',
  defaultRoom: 'lobby',
  heartbeat: 10000,

  onConnect: (conn) => {
    conn.send({ type: 'joined-lobby' })
  },

  onMessage: (conn, data) => {
    switch (data.type) {
      case 'create-game':
        const gameId = crypto.randomUUID()
        conn.leaveRoom('lobby')
        conn.joinRoom(gameId)
        conn.metadata.gameId = gameId
        conn.send({ type: 'game-created', gameId })
        break

      case 'join-game':
        conn.leaveRoom('lobby')
        conn.joinRoom(data.gameId)
        conn.metadata.gameId = data.gameId
        conn.broadcast(
          { type: 'player-joined', playerId: conn.id },
          { room: data.gameId }
        )
        break

      case 'game-action':
        conn.broadcast(
          { type: 'game-update', action: data.action, playerId: conn.id },
          { room: conn.metadata.gameId, includeSelf: true }
        )
        break
    }
  }
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
| 4000–4999 | Custom | Application-specific codes |

## Best Practices

### 1. Use metadata for per-connection state

```typescript
// ✅ Good — attach state to the connection
onConnect: (conn, req) => {
  conn.metadata.userId = req.headers['x-user-id']
}

onMessage: (conn, data) => {
  console.log('Message from user:', conn.metadata.userId)
}
```

### 2. Always handle errors

```typescript
onError: (conn, error) => {
  console.error('WebSocket error:', error)
  // Don't let errors crash the server
}
```

### 3. Clean up on close

```typescript
onClose: (conn) => {
  // Notify others
  conn.broadcast({ type: 'user-left', userId: conn.id })
}
```

### 4. Use rooms instead of manual tracking

```typescript
// ✅ Good — use rooms
conn.joinRoom('lobby')
conn.broadcast(data, { room: 'lobby' })

// ❌ Avoid — manual connection tracking is error-prone
const users = new Map()
users.set(conn.id, conn)
```

### 5. Messages are already parsed

```typescript
onMessage: (conn, data) => {
  // data is already a parsed object (or string/Buffer for non-JSON)
  // No need for JSON.parse()
  console.log(data.type)
}
```

## Next Steps

- [Examples — Chat](/examples/websocket-chat)
- [Examples — Game](/examples/websocket-game)
- [API Reference](/api/websocket-handlers)
