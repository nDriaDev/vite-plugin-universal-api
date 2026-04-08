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
        // Login
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

        // Protected endpoint
        {
          pattern: '/protected',
          method: 'GET',
          handle: async (req, res) => {
            try {
              const token = req.headers.authorization?.replace('Bearer ', '')
              const user = verifyToken(token)

              res.writeHead(200)
              res.end(JSON.stringify({ message: 'Protected data', user }))
            } catch (err) {
              res.writeHead(401)
              res.end(JSON.stringify({ error: 'Unauthorized' }))
            }
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

Full authentication with REST and WebSocket!
