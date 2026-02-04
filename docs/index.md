---
layout: home

hero:
  name: "vite-plugin-ws-rest-fs-api"
  text: "Mock APIs for Vite"
  tagline: Seamless WebSocket, REST and File-based mock APIs integrated in your Vite development server
  image:
    src: /logo_hd.png
    alt: vite-plugin-ws-rest-fs-api
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/nDriaDev/vite-plugin-ws-rest-fs-api
    - theme: alt
      text: API Reference
      link: /api/

features:
  - icon: 📁
    title: File-System Based API
    details: Automatically serve mock data from your file system with zero configuration. Just point to a directory and start serving files.

  - icon: 🔄
    title: REST API Handlers
    details: Define custom programmatic handlers for dynamic responses. Full support for GET, POST, PUT, PATCH, DELETE with Express-like middleware.

  - icon: ⚡
    title: WebSocket Support
    details: Real-time bidirectional communication with rooms, broadcast, compression, and full RFC 6455 compliance.

  - icon: 🎯
    title: Smart Pattern Matching
    details: Ant-style path patterns (e.g., /users/**, /items/{id}) for flexible routing and parameter extraction.

  - icon: 📊
    title: Pagination & Filtering
    details: Built-in pagination and filtering for JSON arrays via query params or request body, with sorting support.

  - icon: 🛠️
    title: Development Tools
    details: Simulate network latency, timeouts, detailed logging, and hot reload during development.

  - icon: 🔌
    title: Express Compatible
    details: Use Express middleware and body parsers. Familiar API for easy integration and migration.

  - icon: 🔒
    title: TypeScript First
    details: Full TypeScript support with comprehensive type definitions included out of the box.

  - icon: 🚀
    title: Zero Dependencies
    details: Minimal footprint with no runtime dependencies. Works with Node 16+, Vite 4+.
---

## Quick Example

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import mockApi from '@ndriadev/vite-plugin-ws-rest-fs-api'

export default defineConfig({
  plugins: [
    mockApi({
      endpointPrefix: '/api',
      fsDir: 'mock',
      enableWs: true,
      handlers: [
        {
          pattern: '/users/{id}',
          method: 'GET',
          handle: async (req, res) => {
            const user = await db.findUser(req.params.id)
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(user))
          }
        }
      ],
      wsHandlers: [
        {
          pattern: '/ws/chat',
          onMessage: (conn, msg) => {
            conn.broadcast(msg, { includeSelf: true })
          }
        }
      ]
    })
  ]
})
```

## Installation

::: code-group

```bash [pnpm]
pnpm add -D @ndriadev/vite-plugin-ws-rest-fs-api
```

```bash [npm]
npm install -D @ndriadev/vite-plugin-ws-rest-fs-api
```

```bash [yarn]
yarn add -D @ndriadev/vite-plugin-ws-rest-fs-api
```

:::

## Why This Plugin?

Building modern web applications often requires mocking backend APIs during development. This plugin provides three complementary approaches:

- **📁 File-System API** - Perfect for static mock data, quick prototyping, and testing
- **🔄 REST Handlers** - Full control for complex logic, validation, and dynamic responses
- **⚡ WebSocket** - Real-time features like chat, notifications, and live updates

All integrated seamlessly into your Vite development server, with hot reload and zero configuration required.

## Community

- [GitHub Discussions](https://github.com/nDriaDev/vite-plugin-ws-rest-fs-api/discussions)
- [GitHub Issues](https://github.com/nDriaDev/vite-plugin-ws-rest-fs-api/issues)

## License

[MIT](https://github.com/nDriaDev/vite-plugin-ws-rest-fs-api/blob/main/LICENSE) © [nDriaDev](https://github.com/nDriaDev)
