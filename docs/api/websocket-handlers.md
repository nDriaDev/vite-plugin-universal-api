# WebSocket Handlers API Reference

Complete API reference for WebSocket handler configuration.

## Handler Configuration

```typescript
interface UniversalApiWsHandler {
  pattern: string
  disabled?: boolean
  delay?: number
  defaultRoom?: string | false
  heartbeat?: number | false
  inactivityTimeout?: number | false
  perMessageDeflate?: PerMessageDeflateExtension
  subprotocols?: string[]
  authenticate?: (req: IncomingMessage) => boolean | Promise<boolean>
  transformRawData?: (data: Buffer) => any | Promise<any>
  responses?: WsResponseEntry[]
  onConnect?: (conn: IWebSocketConnection, req: IncomingMessage) => void | Promise<void>
  onMessage?: (conn: IWebSocketConnection, data: any) => void | Promise<void>
  onClose?: (conn: IWebSocketConnection, code: number, reason: string) => void | Promise<void>
  onError?: (conn: IWebSocketConnection, error: Error) => void | Promise<void>
  onPing?: (conn: IWebSocketConnection, data: Buffer) => void | Promise<void>
  onPong?: (conn: IWebSocketConnection, data: Buffer) => void | Promise<void>
}
```

## Properties

### pattern

URL pattern for the WebSocket endpoint. Supports Ant-style matching.

```typescript
pattern: '/ws/chat'
```

### disabled

- **Type**: `boolean`
- **Default**: `false`

Temporarily disable this handler without removing it.

```typescript
{
  pattern: '/ws/chat',
  disabled: true
}
```

### delay

- **Type**: `number` (milliseconds)

Artificial delay before processing each incoming message. Useful for simulating network latency.

```typescript
{
  pattern: '/ws/chat',
  delay: 100
}
```

### defaultRoom

- **Type**: `string | false`

Room that every connection automatically joins upon connecting.

```typescript
{
  pattern: '/ws/chat',
  defaultRoom: 'lobby'
}
```

### heartbeat

- **Type**: `number | false` (milliseconds)

Interval between automatic ping frames sent to the client. The plugin disconnects the client after 3 consecutive missed pongs. Set to `false` to disable.

```typescript
{
  pattern: '/ws/chat',
  heartbeat: 30000  // Ping every 30 seconds
}
```

### inactivityTimeout

- **Type**: `number | false` (milliseconds)

Close the connection after this period of silence from the client. Resets on every received frame. Set to `false` to disable.

```typescript
{
  pattern: '/ws/chat',
  inactivityTimeout: 300000  // 5 minutes
}
```

### perMessageDeflate

- **Type**: `false | true | PerMessageDeflateConfig`
- **Default**: `false`

Configure per-message compression (RFC 7692). The plugin delegates compression to the `ws` library.

- `false` — compression disabled (default)
- `true` — accept the client's deflate parameters as-is
- Object — negotiate specific deflate parameters

```typescript
// Accept whatever the client negotiates
{
  pattern: '/ws/chat',
  perMessageDeflate: true
}

// Fine-grained control
{
  pattern: '/ws/chat',
  perMessageDeflate: {
    serverNoContextTakeover: true,   // Reset server context each message
    clientNoContextTakeover: false,
    serverMaxWindowBits: 13,         // LZ77 window size (8–15)
    clientMaxWindowBits: 15,
    strict: false  // If true, reject connections that can't match these params
  }
}
```

::: tip
When `strict: true` the plugin rejects WebSocket connections whose negotiated compression parameters do not match your configuration. Use this to enforce consistent compression settings.
:::

### subprotocols

- **Type**: `string[]`

List of WebSocket sub-protocols this handler accepts. The plugin selects the first one the client also supports and includes it in the handshake response.

```typescript
{
  pattern: '/ws/chat',
  subprotocols: ['chat.v1', 'chat.v2']
}
```

### authenticate

- **Type**: `(req: IncomingMessage) => boolean | Promise<boolean>`

Called before completing the WebSocket handshake. Return `false` (or resolve to `false`) to reject the connection with `401 Unauthorized`.

```typescript
{
  pattern: '/ws/private',
  authenticate: async (req) => {
    const url = new URL(req.url!, 'ws://localhost')
    const token = url.searchParams.get('token')
    return token !== null && await isValidToken(token)
  }
}
```

### transformRawData

- **Type**: `(data: Buffer) => any | Promise<any>`

Custom transformation for raw incoming data. When provided, the result replaces the default JSON-parse / binary detection logic.

```typescript
{
  pattern: '/ws/binary',
  transformRawData: (data) => {
    // Parse MessagePack instead of JSON
    return decode(data)
  }
}
```

### responses

- **Type**: `WsResponseEntry[]`

Declarative response rules. Each rule is checked in order and the first matching one is used. If no rule matches, `onMessage` is called instead.

```typescript
{
  pattern: '/ws/chat',
  responses: [
    {
      match: (conn, msg) => msg.type === 'ping',
      response: { type: 'pong' }
    },
    {
      match: (conn, msg) => msg.type === 'echo',
      response: (conn, msg) => ({ type: 'echo', data: msg.data }),
      broadcast: { room: 'lobby', includeSelf: true }
    }
  ]
}
```

## Event Handlers

### onConnect

Called when a client successfully completes the WebSocket handshake.

```typescript
onConnect: (conn, req) => {
  conn.send({ type: 'welcome', id: conn.id })
}
```

### onMessage

Called when a data frame is received. The `data` argument is:
- A parsed JSON object/value when the frame payload is valid JSON
- A plain string for non-JSON text frames
- A `Buffer` for binary frames
- Whatever `transformRawData` returns, if configured

```typescript
onMessage: (conn, data) => {
  switch (data.type) {
    case 'chat':
      conn.broadcast({ type: 'message', text: data.text }, { includeSelf: true })
      break
  }
}
```

### onClose

Called when the connection closes.

```typescript
onClose: (conn, code, reason) => {
  console.log(`Connection ${conn.id} closed: ${code} ${reason}`)
}
```

### onError

Called when a socket error occurs. If not provided, the plugin sends `{ type: 'error', message }` to the client.

```typescript
onError: (conn, error) => {
  console.error('WebSocket error:', error)
}
```

### onPing

Called when a ping frame is received from the client. If not provided, the plugin automatically sends a pong.

```typescript
onPing: (conn, data) => {
  console.log('Ping received')
  conn.pong(data) // Reply manually
}
```

### onPong

Called when a pong frame is received (typically in response to a heartbeat ping).

```typescript
onPong: (conn, data) => {
  console.log('Pong received from', conn.id)
}
```

## Connection Object API

```typescript
interface IWebSocketConnection {
  // Identity
  readonly id: string          // UUID
  readonly path: string        // URL path where connection was opened
  readonly closed: boolean     // Whether the connection is closed
  subprotocol?: string         // Negotiated sub-protocol

  // Storage
  metadata: Record<string, any>  // Attach arbitrary data to this connection
  rooms: Set<string>             // Rooms this connection has joined

  // Sending
  send(data: any): Promise<void>

  // Broadcasting
  broadcast(data: any, options?: { room?: string; includeSelf?: boolean }): void
  broadcastAllRooms(data: any, includeSelf?: boolean): void  //default false

  // Rooms
  joinRoom(room: string): void
  leaveRoom(room: string): void
  isInRoom(room: string): boolean
  getRooms(): string[]

  // Control frames
  ping(payload?: string | Buffer): void
  pong(payload?: string | Buffer): void

  // Lifecycle
  close(code?: number, reason?: string): Promise<void>
  forceClose(): void

  // Heartbeat / inactivity
  startHeartbeat(intervalMs: number): void
  stopHeartbeat(): void
  startInactivityTimeout(timeoutMs: number): void
  resetInactivityTimer(timeoutMs: number): void
  stopInactivityTimeout(): void
  resetMissedPong(): void
}
```

For more details, see [WebSocket Guide](/guide/websocket).
