# Authentication Example

JWT-based authentication for REST and WebSocket.

## Setup

```typescript
import { defineConfig } from 'vite'
import mockApi from '@ndriadev/vite-plugin-universal-api'

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
    mockApi({
      endpointPrefix: '/api',

      handlers: [
        // Login
        {
          pattern: '/login',
          method: 'POST',
          handle: async (req, res) => {
            const user = users.find(
              u => u.username === req.body.username &&
                   u.password === req.body.password
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
            const url = new URL(req.url, 'ws://localhost')
            const token = url.searchParams.get('token')

            try {
              const user = verifyToken(token)
              return { success: true, data: { user } }
            } catch (err) {
              return { success: false, code: 4001, reason: 'Invalid token' }
            }
          },

          onConnect: (conn) => {
            conn.send({ type: 'authenticated', user: conn.authData.user })
          }
        }
      ]
    })
  ]
})
```

Full authentication with REST and WebSocket!
