# Custom Handlers Example

Dynamic REST API endpoints with custom logic.

## Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
// import mockApi from '@ndriadev/vite-plugin-universal-api' //Default export
import { universalApi } from '@ndriadev/vite-plugin-universal-api' // Named export

// In-memory database
const db = {
  users: [
    { id: 1, name: 'Alice', email: 'alice@example.com' },
    { id: 2, name: 'Bob', email: 'bob@example.com' }
  ],
  nextId: 3
}

export default defineConfig({
  plugins: [
    universalApi({
      endpointPrefix: '/api',

      handlers: [
        // GET all users
        {
          pattern: '/users',
          method: 'GET',
          handle: async (req, res) => {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(db.users))
          }
        },

        // GET single user
        {
          pattern: '/users/{id}',
          method: 'GET',
          handle: async (req, res) => {
            const user = db.users.find(u => u.id === parseInt(req.params.id))

            if (!user) {
              res.writeHead(404, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: 'User not found' }))
              return
            }

            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(user))
          }
        },

        // POST create user
        {
          pattern: '/users',
          method: 'POST',
          handle: async (req, res) => {
            const newUser = {
              id: db.nextId++,
              ...req.body
            }

            db.users.push(newUser)

            res.writeHead(201, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(newUser))
          }
        },

        // DELETE user
        {
          pattern: '/users/{id}',
          method: 'DELETE',
          handle: async (req, res) => {
            const index = db.users.findIndex(u => u.id === parseInt(req.params.id))

            if (index === -1) {
              res.writeHead(404)
              res.end()
              return
            }

            db.users.splice(index, 1)
            res.writeHead(204)
            res.end()
          }
        }
      ]
    })
  ]
})
```

Full CRUD operations with in-memory storage!
