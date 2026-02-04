# WebSocket Handlers API Reference

Complete API reference for WebSocket handler configuration.

## Handler Configuration

```typescript
interface WebSocketHandler {
  pattern: string
  authenticate?: AuthenticateFunction
  heartbeat?: number
  compression?: CompressionConfig
  onConnect?: (conn: IWebSocketConnection) => void
  onMessage?: (conn: IWebSocketConnection, data: any) => void
  onClose?: (conn: IWebSocketConnection, code: number, reason: string) => void
  onError?: (conn: IWebSocketConnection, error: Error) => void
}
```

### pattern

URL pattern for WebSocket endpoint.

```typescript
pattern: '/ws/chat'
```

### authenticate

Optional authentication function.

```typescript
authenticate: async (req: IncomingMessage) => {
  return { success: true, data: { user: 'john' } }
}
```

### heartbeat

Heartbeat interval in milliseconds.

```typescript
heartbeat: 30000  // 30 seconds
```

### compression

Message compression configuration.

```typescript
compression: {
  enabled: true,
  threshold: 1024
}
```

### Event Handlers

```typescript
onConnect: (conn) => {
  conn.send({ type: 'connected' })
}

onMessage: (conn, data) => {
  conn.broadcast(data)
}

onClose: (conn, code, reason) => {
  console.log('Closed:', code, reason)
}

onError: (conn, error) => {
  console.error('Error:', error)
}
```

For more details, see [WebSocket Guide](/guide/websocket).
