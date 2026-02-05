# Troubleshooting

Common issues and solutions when using vite-plugin-universal-api.

## Plugin Not Working

### Issue: Plugin doesn't start or no endpoints are served

**Symptoms:**
- API requests return 404
- No console logs from plugin
- Vite server starts but plugin seems inactive

**Solutions:**

1. **Check `endpointPrefix` configuration**

```typescript
// ❌ Bad - empty or invalid
universalApi({
  endpointPrefix: ''  // Won't work!
})

// ✅ Good
universalApi({
  endpointPrefix: '/api'
})
```

2. **Check `disable` flag**

```typescript
// ❌ Plugin is disabled
universalApi({
  disable: true
})

// ✅ Plugin is enabled
universalApi({
  disable: false  // or omit it
})
```

3. **Verify `fsDir` path**

```typescript
// Check directory exists
universalApi({
  fsDir: 'mock'  // Should point to ./mock directory
})
```

```bash
# Verify directory exists
ls -la mock/
```

## WebSocket Connection Fails

### Issue: Cannot connect to WebSocket endpoint

**Symptoms:**
- WebSocket connection refused
- Client shows connection error
- No `onConnect` handler called

**Solutions:**

1. **Enable WebSocket**

```typescript
universalApi({
  enableWs: true,  // Must be true!
  wsHandlers: [...]
})
```

2. **Check WebSocket URL**

```typescript
// ✅ Correct WebSocket URL
const ws = new WebSocket('ws://localhost:5173/api/ws/chat')
//                         ^^^ ws protocol, not http

// ❌ Wrong - using http
const ws = new WebSocket('http://localhost:5173/api/ws/chat')
```

3. **Verify pattern matches**

```typescript
wsHandlers: [
  {
    pattern: '/ws/chat',  // URL should be /api/ws/chat
    onConnect: (conn) => { ... }
  }
]
```

4. **Check authentication**

```typescript
wsHandlers: [
  {
    pattern: '/ws/private',
    authenticate: async (req) => {
      // If this returns success: false, connection is rejected
      return { success: true }
    }
  }
]
```

## Request Body Undefined

### Issue: `req.body` is null or undefined

**Symptoms:**
- POST/PUT/PATCH requests have no body
- `req.body === null`
- Data not accessible in handler

**Solutions:**

1. **Check `Content-Type` header**

```typescript
// Client must send correct header
fetch('/api/users', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'  // Required!
  },
  body: JSON.stringify({ name: 'John' })
})
```

2. **Verify parser is enabled**

```typescript
universalApi({
  parser: true  // Default, enables JSON parsing
})
```

3. **Check for valid JSON**

```typescript
// ❌ Invalid JSON
body: "{ name: 'John' }"  // Missing quotes

// ✅ Valid JSON
body: JSON.stringify({ name: 'John' })
```

4. **Custom parser configuration**

```typescript
import express from 'express'

universalApi({
  parser: {
    parser: [
      express.json(),
      express.urlencoded({ extended: true })
    ],
    transform: (req: any) => ({
      body: req.body,
      query: new URLSearchParams(req.url.split('?')[1])
    })
  }
})
```

## File Not Found (404)

### Issue: File-based endpoint returns 404

**Symptoms:**
- GET request to file returns 404
- File exists but not found
- Directory not recognized

**Solutions:**

1. **Verify file path**

```bash
# Request: GET /api/users
# Should match: mock/users.json OR mock/users/index.json

ls -la mock/users.json
ls -la mock/users/index.json
```

2. **Check file permissions**

```bash
chmod 644 mock/users.json
```

3. **Verify `fsDir` configuration**

```typescript
universalApi({
  fsDir: 'mock'  // Relative to project root
})
```

```bash
# Directory should exist
ls -la mock/
```

4. **Check file extension**

```typescript
// Plugin looks for files with extensions
mock/users.json  // ✅ Found
mock/users       // ❌ Only if exact file exists
```

## CORS Errors

### Issue: Browser shows CORS errors

**Symptoms:**
- "CORS policy" errors in browser console
- Preflight OPTIONS requests fail
- Cannot read response headers

**Solutions:**

1. **Add CORS middleware**

```typescript
universalApi({
  handlerMiddlewares: [
    async (req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
      res.setHeader('Access-Control-Expose-Headers', 'X-Total-Elements, X-Deleted-Elements')

      if (req.method === 'OPTIONS') {
        res.writeHead(204)
        res.end()
        return
      }

      next()
    }
  ]
})
```

2. **Use Vite proxy (alternative)**

```typescript
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5173',
        changeOrigin: true
      }
    }
  }
})
```

## Pagination Not Working

### Issue: Pagination doesn't filter or sort data

**Symptoms:**
- Always returns all items
- Sorting doesn't work
- Headers missing

**Solutions:**

1. **Ensure file contains JSON array**

```json
// ✅ Works
[
  {"id": 1},
  {"id": 2}
]

// ❌ Doesn't work
{
  "users": [{"id": 1}]
}
```

2. **Check pagination config**

```typescript
pagination: {
  GET: {
    type: 'query-param',
    limit: 'limit',  // Must match query param
    skip: 'skip'
  }
}
```

3. **Verify query param names match**

```bash
# Config uses 'limit', 'skip'
GET /api/users?limit=10&skip=0  # ✅ Works

# Wrong param names
GET /api/users?pageSize=10&offset=0  # ❌ Doesn't work
```

4. **Check file is JSON**

```bash
file mock/users.json
# Should show: JSON data
```

## WebSocket Messages Not Received

### Issue: Messages sent but not received

**Symptoms:**
- Client sends message but server doesn't respond
- `onMessage` not called
- No errors shown

**Solutions:**

1. **Verify message format**

```typescript
// ✅ Send JSON
ws.send(JSON.stringify({ type: 'message', text: 'Hello' }))

// ❌ Send plain string (might not parse)
ws.send('Hello')
```

2. **Check connection state**

```typescript
ws.onopen = () => {
  console.log('Connected')
  // Only send after connection is open
  ws.send(JSON.stringify({ type: 'join' }))
}

// ❌ Don't send immediately
const ws = new WebSocket(url)
ws.send(data)  // Connection not open yet!
```

3. **Verify onMessage handler exists**

```typescript
wsHandlers: [
  {
    pattern: '/ws/chat',
    onMessage: (conn, data) => {  // Make sure this exists!
      console.log('Received:', data)
      conn.send({ type: 'response' })
    }
  }
]
```

4. **Check for errors**

```typescript
// Client
ws.onerror = (error) => {
  console.error('WebSocket error:', error)
}

// Server
wsHandlers: [
  {
    pattern: '/ws/chat',
    onError: (conn, error) => {
      console.error('Server error:', error)
    }
  }
]
```

## Build Errors

### Issue: Build fails or TypeScript errors

**Symptoms:**
- TypeScript compilation errors
- Build command fails
- Type errors in IDE

**Solutions:**

1. **Install type definitions**

```bash
pnpm add -D @types/node
```

2. **Import types**

```typescript
import type { UniversalApiOptions } from '@ndriadev/vite-plugin-universal-api'

const config: UniversalApiOptions = {
  endpointPrefix: '/api'
}
```

3. **Check TypeScript config**

```json
{
  "compilerOptions": {
    "moduleResolution": "node",
    "esModuleInterop": true
  }
}
```

## Getting Help

If none of these solutions work:

1. **Check plugin version**
```bash
npm list @ndriadev/vite-plugin-universal-api
```

2. **Enable debug logging**
```typescript
universalApi({
  logLevel: 'debug'  // See all internal logs
})
```

3. **Check GitHub Issues**
[https://github.com/nDriaDev/vite-plugin-universal-api/issues](https://github.com/nDriaDev/vite-plugin-universal-api/issues)

4. **Ask in Discussions**
[https://github.com/nDriaDev/vite-plugin-universal-api/discussions](https://github.com/nDriaDev/vite-plugin-universal-api/discussions)

## Common Mistakes

### 1. Forgetting await

```typescript
// ❌ Wrong
handle: (req, res) => {
  const data = fetchData()  // Returns Promise!
  res.end(JSON.stringify(data))
}

// ✅ Correct
handle: async (req, res) => {
  const data = await fetchData()
  res.end(JSON.stringify(data))
}
```

### 2. Not calling res.end()

```typescript
// ❌ Wrong - request hangs
handle: (req, res) => {
  res.writeHead(200)
  // Forgot res.end()!
}

// ✅ Correct
handle: (req, res) => {
  res.writeHead(200)
  res.end('OK')
}
```

### 3. Wrong WebSocket protocol

```typescript
// ❌ Wrong
const ws = new WebSocket('http://localhost:5173/api/ws/chat')

// ✅ Correct
const ws = new WebSocket('ws://localhost:5173/api/ws/chat')
```

### 4. Modifying File-System handler

```typescript
// ❌ Can't override FS behavior this way
handlers: [
  {
    pattern: '/users',
    method: 'GET',
    handle: 'FS',  // FS handler
    // Can't add custom logic here
  }
]

// ✅ Use custom handler instead
handlers: [
  {
    pattern: '/users',
    method: 'GET',
    handle: async (req, res) => {
      // Custom logic
      const data = await readFile('mock/users.json')
      res.writeHead(200)
      res.end(data)
    }
  }
]
```

## Quick Checklist

- [ ] Plugin enabled (`disable: false`)
- [ ] `endpointPrefix` configured
- [ ] `fsDir` directory exists (if using FS API)
- [ ] WebSocket enabled if using WS (`enableWs: true`)
- [ ] Content-Type header set for POST/PUT/PATCH
- [ ] JSON is valid
- [ ] File paths match request URLs
- [ ] Parser enabled (`parser: true`)
- [ ] CORS configured if needed
- [ ] WebSocket URL uses `ws://` protocol
- [ ] Messages are JSON.stringify'd before sending
