# Authentication Example

JWT-based authentication for REST and WebSocket.

## Setup

```typescript
import { defineConfig } from 'vite'
// import mockApi from '@ndriadev/vite-plugin-universal-api' //Default export
import { universalApi } from '@ndriadev/vite-plugin-universal-api' // Named export

const users = [{ username: 'admin', password: 'admin123' }]
const tokens = new Map()

function generateToken(username) {
  const token = `token-${Date.now()}`
  tokens.set(token, { username, exp: Date.now() + 3600000 })
  return token
}

function verifyToken(token) {
  const data = tokens.get(token)
  if (!data || data.exp < Date.now()) {
    throw new Error('Invalid token')
  }
  return data
}

export default defineConfig({
  plugins: [
    universalApi({
      endpointPrefix: '/api',

      handlers: [
        // Login — public, no authentication required
        {
          pattern: '/login',
          method: 'POST',
          handle: async (req, res) => {
            const body = req.body as { username: string; password: string }
            const user = users.find(
              u => u.username === body.username &&
                   u.password === body.password
            )

            if (!user) {
              res.writeHead(401)
              res.end(JSON.stringify({ error: 'Invalid credentials' }))
              return
            }

            const token = generateToken(user.username)
            res.writeHead(200)
            res.end(JSON.stringify({ token }))
          }
        },

        // Protected endpoint — shorthand: requires Authorization header to be present
        {
          pattern: '/profile',
          method: 'GET',
          authenticate: true,   // 401 if Authorization header is missing or empty
          handle: async (req, res) => {
            const token = req.headers.authorization!.replace('Bearer ', '')
            const user = verifyToken(token)
            res.writeHead(200)
            res.end(JSON.stringify({ message: 'Profile data', user }))
          }
        },

        // Protected endpoint — custom async validation function
        {
          pattern: '/protected',
          method: 'GET',
          authenticate: async (req) => {
            try {
              const token = req.headers.authorization?.replace('Bearer ', '')
              if (!token) return false
              verifyToken(token)
              return true
            } catch {
              return false
            }
          },
          handle: async (req, res) => {
            res.writeHead(200)
            res.end(JSON.stringify({ message: 'Protected data' }))
          }
        },

        // Protected endpoint — require a custom API-key header
        {
          pattern: '/admin/settings',
          method: 'GET',
          authenticate: 'x-api-key',   // 401 if x-api-key header is missing or empty
          handle: async (req, res) => {
            res.writeHead(200)
            res.end(JSON.stringify({ settings: {} }))
          }
        }
      ],

      // Authenticated WebSocket
      enableWs: true,
      wsHandlers: [
        {
          pattern: '/ws/private',

          authenticate: async (req) => {
            const url = new URL(req.url!, 'ws://localhost')
            const token = url.searchParams.get('token')
            if (!token) return false
            try {
              verifyToken(token)
              return true
            } catch {
              return false
            }
          },

          onConnect: (conn, req) => {
            // Store user data in conn.metadata for use in later handlers
            const url = new URL(req.url!, 'ws://localhost')
            const token = url.searchParams.get('token')!
            conn.metadata.user = verifyToken(token)
            conn.send({ type: 'authenticated', user: conn.metadata.user })
          }
        }
      ]
    })
  ]
})
```

## How `authenticate` works

The `authenticate` option is available on **all** REST and WebSocket handlers. It is evaluated before the handler body runs (or before the WebSocket upgrade completes):

| Value | Behaviour |
|-------|-----------|
| `false` | No check — every request passes through. **Default.** |
| `true` | The `authorization` header must be present and non-empty. |
| `string` | The named header (e.g. `'x-api-key'`) must be present and non-empty. |
| `function` | Custom predicate `(req) => boolean \| Promise<boolean>`. Return `true` to allow, `false` to reject. |

A rejected request receives **`401 Unauthorized`**. If the function throws, the response is **`500 Internal Server Error`**.
