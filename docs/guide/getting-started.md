# Getting Started

Welcome to **vite-plugin-universal-api**! This guide will help you get up and running with mock APIs in your Vite project.

## What is vite-plugin-universal-api?

vite-plugin-universal-api is a comprehensive Vite plugin that transforms your development server into a powerful mock backend. It provides three complementary approaches to handle API requests:

1. **📁 File-System Based API** - Automatically serve mock data from your file system
2. **🔄 REST API Handlers** - Define custom programmatic handlers for dynamic responses
3. **⚡ WebSocket Support** - Real-time bidirectional communication with rooms and broadcast capabilities

## Why Use This Plugin?

Building modern web applications often requires mocking backend APIs during development. This plugin provides three complementary approaches:

- **📁 File-System API** - Perfect for static mock data, quick prototyping, and testing
- **🔄 REST Handlers** - Full control for complex logic, validation, and dynamic responses
- **⚡ WebSocket** - Real-time features like chat, notifications, and live updates

All integrated seamlessly into your Vite development server, with hot reload and zero configuration required.

### Perfect for Frontend Developers

- **Develop Without Backend**: Start building your frontend immediately without waiting for backend APIs
- **Work Offline**: No internet or VPN required during development
- **Test Edge Cases**: Easily simulate errors, timeouts, and unusual scenarios
- **Prototype Quickly**: Rapid prototyping and demos without backend infrastructure

### Key Benefits

- ✅ **Zero Configuration** - Point to a directory and start serving files
- ✅ **Full TypeScript Support** - Comprehensive type definitions included
- ✅ **Express Compatible** - Use familiar Express middleware and parsers
- ✅ **Hot Reload** - Changes reflected immediately during development
- ✅ **Production Ready** - Well-tested with comprehensive test coverage

## Requirements

Before you begin, make sure you have:

- **Node.js**: `^16.0.0 || ^18.0.0 || >=20.0.0`
- **Vite**: `^4.0.0 || ^5.0.0 || ^6.0.0 || >=7.0.0`

## Installation

Install the plugin as a development dependency:

::: code-group

```bash [pnpm]
pnpm add -D @ndriadev/vite-plugin-universal-api
```

```bash [npm]
npm install -D @ndriadev/vite-plugin-universal-api
```

```bash [yarn]
yarn add -D @ndriadev/vite-plugin-universal-api
```

:::

## Basic Setup

### 1. Configure Vite

Add the plugin to your `vite.config.ts`:

```typescript
import { defineConfig } from 'vite'
// import mockApi from '@ndriadev/vite-plugin-universal-api' //Default export
import { universalApi } from '@ndriadev/vite-plugin-universal-api' // Named export

export default defineConfig({
  plugins: [
    universalApi({
      endpointPrefix: '/api',
      fsDir: 'mock'
    })
  ]
})
```

### 2. Create Mock Data

Create a directory for your mock files:

```
project/
├── mock/
│   ├── users.json
│   └── posts.json
├── src/
└── vite.config.ts
```

Add some mock data:

```json
// mock/users.json
[
  {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com"
  },
  {
    "id": 2,
    "name": "Jane Smith",
    "email": "jane@example.com"
  }
]
```

### 3. Start Development Server

```bash
npm run dev
```

### 4. Access Your Mock API

Your mock data is now available:

```bash
# Fetch all users
curl http://localhost:5173/api/users

# Returns:
# [
#   {"id": 1, "name": "John Doe", "email": "john@example.com"},
#   {"id": 2, "name": "Jane Smith", "email": "jane@example.com"}
# ]
```

## What's Next?

Now that you have a basic setup running, explore more features:

- [Quick Start](/guide/quick-start) - Learn the three main approaches
- [File-System API](/guide/file-system-api) - Deep dive into file-based mocking
- [REST Handlers](/guide/rest-handlers) - Create custom dynamic handlers
- [WebSocket](/guide/websocket) - Add real-time communication
- [Examples](/examples/) - See real-world examples

## Getting Help

If you run into issues:

1. Check the [Troubleshooting](/guide/troubleshooting) guide
2. Search [GitHub Issues](https://github.com/nDriaDev/vite-plugin-universal-api/issues)
3. Ask in [GitHub Discussions](https://github.com/nDriaDev/vite-plugin-universal-api/discussions)

## Next Steps

::: tip Recommended Path
1. ✅ You are here - Getting Started
2. 📖 [Quick Start](/guide/quick-start) - Try all three approaches
3. 🎯 [File-System API](/guide/file-system-api) - Master file-based mocking
4. 💡 [Examples](/examples/) - See real-world use cases
:::

## Community

- [GitHub Discussions](https://github.com/nDriaDev/vite-plugin-universal-api/discussions)
- [GitHub Issues](https://github.com/nDriaDev/vite-plugin-universal-api/issues)

## License

[MIT](https://github.com/nDriaDev/vite-plugin-universal-api/blob/main/LICENSE) © [nDriaDev](https://github.com/nDriaDev)
