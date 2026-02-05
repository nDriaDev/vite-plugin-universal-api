# Stateful Server Example

In-memory database with full CRUD operations.

## Configuration

```typescript
import { defineConfig } from 'vite'
import mockApi from '@ndriadev/vite-plugin-universal-api'

// In-memory database
class Database {
  users = []
  nextId = 1

  findAll() {
    return this.users
  }

  findById(id) {
    return this.users.find(u => u.id === parseInt(id))
  }

  create(data) {
    const user = { id: this.nextId++, ...data, createdAt: new Date() }
    this.users.push(user)
    return user
  }

  update(id, data) {
    const index = this.users.findIndex(u => u.id === parseInt(id))
    if (index === -1) return null

    this.users[index] = { ...this.users[index], ...data, updatedAt: new Date() }
    return this.users[index]
  }

  delete(id) {
    const index = this.users.findIndex(u => u.id === parseInt(id))
    if (index === -1) return false

    this.users.splice(index, 1)
    return true
  }
}

const db = new Database()

export default defineConfig({
  plugins: [
    mockApi({
      endpointPrefix: '/api',

      handlers: [
        // GET all
        {
          pattern: '/users',
          method: 'GET',
          handle: async (req, res) => {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(db.findAll()))
          }
        },

        // GET one
        {
          pattern: '/users/{id}',
          method: 'GET',
          handle: async (req, res) => {
            const user = db.findById(req.params.id)
            if (!user) {
              res.writeHead(404)
              res.end()
              return
            }
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(user))
          }
        },

        // POST create
        {
          pattern: '/users',
          method: 'POST',
          handle: async (req, res) => {
            const user = db.create(req.body)
            res.writeHead(201, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(user))
          }
        },

        // PUT update
        {
          pattern: '/users/{id}',
          method: 'PUT',
          handle: async (req, res) => {
            const user = db.update(req.params.id, req.body)
            if (!user) {
              res.writeHead(404)
              res.end()
              return
            }
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(user))
          }
        },

        // DELETE
        {
          pattern: '/users/{id}',
          method: 'DELETE',
          handle: async (req, res) => {
            const deleted = db.delete(req.params.id)
            res.writeHead(deleted ? 204 : 404)
            res.end()
          }
        }
      ]
    })
  ]
})
```

Full CRUD with persistent state during development!
