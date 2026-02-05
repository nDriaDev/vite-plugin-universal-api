# File-Based Mocking Example

Complete example of using File-System API for mock data.

## Project Structure

```
my-app/
├── mock/
│   ├── users.json
│   ├── users/
│   │   ├── 1.json
│   │   ├── 2.json
│   │   └── 3.json
│   ├── posts/
│   │   └── index.json
│   └── products.json
├── src/
│   └── App.tsx
└── vite.config.ts
```

## Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import mockApi from '@ndriadev/vite-plugin-universal-api'

export default defineConfig({
  plugins: [
    react(),
    mockApi({
      endpointPrefix: '/api',
      fsDir: 'mock',

      // Enable pagination
      pagination: {
        GET: {
          type: 'query-param',
          limit: 'limit',
          skip: 'skip',
          sort: 'sortBy',
          order: 'order'
        }
      },

      // Enable filters
      filters: {
        GET: {
          type: 'query-param',
          filters: [
            { key: 'status', valueType: 'string', comparison: 'eq' },
            { key: 'role', valueType: 'string', comparison: 'eq' }
          ]
        }
      }
    })
  ]
})
```

## Mock Data Files

```json
// mock/users.json
[
  {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "status": "active",
    "role": "admin"
  },
  {
    "id": 2,
    "name": "Jane Smith",
    "email": "jane@example.com",
    "status": "active",
    "role": "user"
  },
  {
    "id": 3,
    "name": "Bob Johnson",
    "email": "bob@example.com",
    "status": "inactive",
    "role": "user"
  }
]
```

```json
// mock/users/1.json
{
  "id": 1,
  "name": "John Doe",
  "email": "john@example.com",
  "bio": "Software developer",
  "status": "active",
  "role": "admin",
  "createdAt": "2024-01-15T10:00:00Z"
}
```

```json
// mock/products.json
[
  {
    "id": "prod-1",
    "name": "Laptop",
    "price": 1299.99,
    "inStock": true
  },
  {
    "id": "prod-2",
    "name": "Mouse",
    "price": 29.99,
    "inStock": true
  }
]
```

## React Component

```tsx
// src/App.tsx
import { useState, useEffect } from 'react'

function App() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Fetch all users
    fetch('/api/users')
      .then(res => res.json())
      .then(data => {
        setUsers(data)
        setLoading(false)
      })
  }, [])

  if (loading) return <div>Loading...</div>

  return (
    <div>
      <h1>Users</h1>
      {users.map(user => (
        <div key={user.id}>
          {user.name} - {user.email}
        </div>
      ))}
    </div>
  )
}
```

## Usage Examples

```typescript
// Get all users
fetch('/api/users')

// Get single user
fetch('/api/users/1')

// Get paginated users
fetch('/api/users?limit=10&skip=0&sortBy=name&order=asc')

// Get filtered users
fetch('/api/users?status=active&role=admin')

// Get products
fetch('/api/products')
```

This is the simplest way to start mocking APIs!
