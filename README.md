<div align="center">
<a href="https://vite-plugin-universal-api.ndria.dev/">
    <img src="https://raw.githubusercontent.com/nDriaDev/vite-plugin-universal-api/main/resources/img/logo.png" alt="Go to web site">
</a>
<br>

# vite-plugin-universal-api

### Seamless Mock APIs, Accelerate Your Development Journey

[![npm version](https://img.shields.io/npm/v/%40ndriadev/vite-plugin-universal-api?color=orange&style=for-the-badge)](https://www.npmjs.com/package/%40ndriadev/vite-plugin-universal-api)
![npm bundle size](https://img.shields.io/bundlephobia/minzip/%40ndriadev%2Fvite-plugin-universal-api?style=for-the-badge&label=SIZE&color=yellow)
[![npm downloads](https://img.shields.io/npm/dt/%40ndriadev/vite-plugin-universal-api?label=DOWNLOADS&style=for-the-badge&color=red)](https://www.npmjs.com/package/%40ndriadev/vite-plugin-universal-api)
[![License: MIT](https://img.shields.io/badge/LICENSE-MIT-blue.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

![Statements](https://img.shields.io/badge/statements-100%25-brightgreen.svg?style=for-the-badge)
![Branches](https://img.shields.io/badge/branches-90.99%25-green.svg?style=for-the-badge)
![Functions](https://img.shields.io/badge/functions-99.13%25-green.svg?style=for-the-badge)
![Lines](https://img.shields.io/badge/lines-100%25-brightgreen.svg?style=for-the-badge)

*Built with:*

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6.svg?style=for-the-badge&logo=TypeScript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-646CFF.svg?style=for-the-badge&logo=Vite&logoColor=white)](https://vitejs.dev/)
[![Vitest](https://img.shields.io/badge/Vitest-6E9F18.svg?style=for-the-badge&logo=Vitest&logoColor=white)](https://vitest.dev/)
[![ESLint](https://img.shields.io/badge/ESLint-4B32C3.svg?style=for-the-badge&logo=ESLint&logoColor=white)](https://eslint.org/)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Installation](#-installation)
- [Quick Start](#-quick-start)
- [Configuration](#-configuration)
  - [Basic Options](#basic-options)
  - [REST API Handlers](#rest-api-handlers)
  - [WebSocket Handlers](#websocket-handlers)
  - [File-System Based API](#file-system-based-api)
- [Usage Examples](#-usage-examples)
  - [File-Based Mocking](#file-based-mocking)
  - [Custom REST Handlers](#custom-rest-handlers)
  - [WebSocket Real-Time Communication](#websocket-real-time-communication)
  - [Advanced Patterns](#advanced-patterns)
- [API Reference](#-api-reference)
- [WebSocket API](#-websocket-api)
- [Middleware System](#-middleware-system)
- [Advanced Features](#-advanced-features)
- [Important Notes](#-important-notes)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🎯 Overview

**vite-plugin-universal-api** is a comprehensive Vite plugin that transforms your development server into a powerful mock backend. It provides three complementary approaches to handle API requests:

1. **📁 File-System Based API** - Automatically serve mock data from your file system
2. **🔄 REST API Handlers** - Define custom programmatic handlers for dynamic responses
3. **⚡ WebSocket Support** - Real-time bidirectional communication with rooms and broadcast capabilities

Perfect for frontend developers who need to:
- Develop without waiting for backend APIs
- Test edge cases and error scenarios
- Work offline or with unreliable backend connections
- Prototype and demo features quickly
- Simulate real-time features with WebSocket

---

## ✨ Features

### 🎨 File-System Based Mocking
- **Zero Configuration** - Point to a directory and start serving files
- **Smart Path Mapping** - Automatic mapping of URL paths to file paths
- **Multiple File Formats** - JSON, HTML, XML, text files, and binary data
- **Directory Index** - Automatic `index.json` lookup for directory requests
- **Built-in Pagination** - Automatic pagination for JSON arrays via query params or body
- **Advanced Filtering** - Filter JSON arrays by field values with type-safe comparisons
- **CRUD Operations** - Full support for GET, POST, PUT, PATCH, DELETE on files

### 🔧 REST API Handlers
- **Flexible Routing** - Ant-style path patterns (`/users/**`, `/items/{id}`)
- **HTTP Method Support** - GET, POST, PUT, PATCH, DELETE, HEAD
- **Dynamic Responses** - Programmatic handlers with full request/response control
- **Express-like Middleware** - Pre-processing, authentication, logging
- **Custom Parsers** - Compatible with Express body parsers
- **Error Handling** - Dedicated error middleware chain
- **Hybrid Approach** - Mix file-based and programmatic handlers

### ⚡ WebSocket Support
- **RFC 6455 Compliant** - Full WebSocket protocol implementation
- **Room System** - Group connections and broadcast to specific rooms
- **Compression** - permessage-deflate extension support (RFC 7692)
- **Heartbeat/Keep-alive** - Configurable ping/pong mechanism
- **Inactivity Timeout** - Automatic connection cleanup
- **Event Handlers** - onConnect, onMessage, onClose, onError, onPing, onPong
- **Pattern Matching** - Ant-style patterns for WebSocket endpoints
- **Authentication** - Custom authentication hook before upgrade
- **Sub-protocols** - WebSocket sub-protocol negotiation

### 🛠️ Development Utilities
- **Simulated Latency** - Add delays to test loading states
- **Gateway Timeout** - Simulate server timeouts
- **Detailed Logging** - Configurable log levels (debug, info, warn, error)
- **Hot Reload** - Changes reflected immediately during development
- **TypeScript Support** - Full type definitions included

---

## 📦 Installation

```bash
# pnpm (recommended)
pnpm add -D @ndriadev/vite-plugin-universal-api

# npm
npm install -D @ndriadev/vite-plugin-universal-api

# yarn
yarn add -D @ndriadev/vite-plugin-universal-api
```

### Requirements

- **Node.js**: `^16.0.0 || ^18.0.0 || >=20.0.0`
- **Vite**: `^4.0.0 || ^5.0.0 || ^6.0.0 || >=7.0.0`

---

## 🚀 Quick Start

### Minimal Setup

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
// import mockApi from '@ndriadev/vite-plugin-universal-api' //Default export
import { universalApi } from '@ndriadev/vite-plugin-universal-api' // Named export ;

export default defineConfig({
  plugins: [
    universalApi({
      endpointPrefix: '/api',
      fsDir: 'mock'
    })
  ]
});
```

Create a mock file:

```json
// mock/users.json
[
  { "id": 1, "name": "John Doe", "email": "john@example.com" },
  { "id": 2, "name": "Jane Smith", "email": "jane@example.com" }
]
```

Access it:
```bash
curl http://localhost:5173/api/users
# Returns the JSON array
```

---

## ⚙️ Configuration

### Basic Options

```typescript
interface UniversalApiOptions {
  /**
   * Disable the entire plugin
   * @default false
   */
  disable?: boolean;

  /**
   * Logging verbosity level
   * @default 'info'
   */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';

  /**
   * URL prefix(es) for API endpoints
   * Can be a single string or array of prefixes
   * @example '/api' or ['/api', '/mock']
   */
  endpointPrefix: string | string[];

  /**
   * Directory path for file-based mocking (relative to project root)
   * Set to null to disable file-based routing
   * @example 'mock' or 'src/mocks'
   */
  fsDir?: string | null;

  /**
   * Enable WebSocket support
   * When true, wsHandlers option becomes required
   * @default false
   */
  enableWs?: boolean;

  /**
   * Simulated response delay in milliseconds
   * Useful for testing loading states
   * @default 0
   */
  delay?: number;

  /**
   * Timeout for long-running handlers (in ms)
   * Returns 504 Gateway Timeout if exceeded
   * @default 30000 (30 seconds)
   */
  gatewayTimeout?: number;

  /**
   * Behavior for unmatched requests
   * - '404': Return 404 Not Found
   * - 'forward': Pass to next Vite middleware (e.g., serve static files)
   * @default '404'
   */
  noHandledRestFsRequestsAction?: '404' | 'forward';

  /**
   * Request body parsing configuration
   * @default true (built-in parser)
   */
  parser?: boolean | {
    parser: ParserFunction | ParserFunction[];
    transform: (req: IncomingMessage) => {
      body?: any;
      files?: { name: string; content: Buffer; contentType: string }[];
      query?: URLSearchParams;
    }
  };

  /**
   * Global middleware executed before all handlers
   * Similar to Express middleware
   */
  handlerMiddlewares?: MiddlewareFunction[];

  /**
   * Error handling middleware
   */
  errorMiddlewares?: ErrorHandlerFunction[];

  /**
   * REST API handler configurations
   */
  handlers?: RestHandler[];

  /**
   * WebSocket handler configurations (required when enableWs is true)
   */
  wsHandlers?: WebSocketHandler[];

  /**
   * Global pagination configuration for file-based endpoints
   */
  pagination?: Partial<Record<'ALL' | 'GET' | 'POST' | 'DELETE', PaginationConfig>>;

  /**
   * Global filter configuration for file-based endpoints
   */
  filters?: Partial<Record<'ALL' | 'GET' | 'POST' | 'DELETE', FilterConfig>>;
}
```

---

### REST API Handlers

```typescript
interface RestHandler {
  /**
   * URL pattern with Ant-style syntax
   * - * matches one path segment
   * - ** matches zero or more path segments
   * - {param} extracts a path parameter
   * @example '/users/{id}' or '/posts/**'
   */
  pattern: string;

  /**
   * HTTP method to handle
   */
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';

  /**
   * Handler function or 'FS' for file-system routing
   */
  handle: 'FS' | ((req: UniversalApiRequest, res: ServerResponse) => void | Promise<void>);

  /**
   * Disable this specific handler
   * @default false
   */
  disabled?: boolean;

  /**
   * Response delay override for this handler
   */
  delay?: number;

  /**
   * For 'FS' handlers: function called before reading the file
   * Can modify path, check permissions, etc.
   */
  preHandle?: (req: UniversalApiRequest, res: ServerResponse) => {
    continueHandle: boolean;
    path?: string;
  } | Promise<{...}>;

  /**
   * For 'FS' handlers: function called after reading the file
   * Can transform data, add headers, etc.
   */
  postHandle?: (req: UniversalApiRequest, res: ServerResponse, data: any) => {
    continueHandle: boolean;
    data?: any;
  } | Promise<{...}>;

  /**
   * Pagination config for this handler (overrides global)
   */
  pagination?: PaginationConfig;

  /**
   * Filter config for this handler (overrides global)
   */
  filters?: FilterConfig;
}
```

#### Pagination Configuration

```typescript
type PaginationConfig = {
  /**
   * Where to look for pagination params
   * - 'query-param': URL query string (?limit=10&skip=20)
   * - 'body': Request body
   */
  type: 'query-param' | 'body';

  /**
   * For body type: nested object path
   * @example 'pagination' for { pagination: { limit: 10 } }
   */
  root?: string;

  /**
   * Parameter name for limit/page size
   * @default 'limit'
   */
  limit?: string;

  /**
   * Parameter name for skip/offset
   * @default 'skip'
   */
  skip?: string;

  /**
   * Parameter name for sort field
   * @default 'sort'
   */
  sort?: string;

  /**
   * Parameter name for sort order ('asc' | 'desc')
   * @default 'order'
   */
  order?: string;
}
```

#### Filter Configuration

```typescript
type FilterConfig = {
  type: 'query-param' | 'body';
  root?: string;
  filters: Array<{
    /**
     * Query param or body field name
     */
    key: string;

    /**
     * Field in the JSON object to filter by
     */
    field?: string;

    /**
     * Expected value type
     */
    valueType: 'string' | 'number' | 'boolean';

    /**
     * Comparison operator
     * - eq: equals
     * - neq: not equals
     * - gt: greater than
     * - gte: greater than or equal
     * - lt: less than
     * - lte: less than or equal
     * - in: value in array
     * - nin: value not in array
     * - contains: string contains (case-insensitive)
     */
    comparison: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'contains';
  }>;
}
```

---

### WebSocket Handlers

```typescript
interface WebSocketHandler {
  /**
   * URL pattern for WebSocket upgrade requests
   * @example '/ws/chat' or '/ws/**'
   */
  pattern: string;

  /**
   * Disable this handler
   * @default false
   */
  disabled?: boolean;

  /**
   * Authentication function executed before WebSocket upgrade
   * Return true to allow, false to reject with 401
   */
  authenticate?: (req: IncomingMessage) => boolean | Promise<boolean>;

  /**
   * Default room to join on connection
   */
  defaultRoom?: string;

  /**
   * Heartbeat interval in milliseconds
   * Sends ping frames to keep connection alive
   * Connection closed after 3 missed pongs
   */
  heartbeat?: number;

  /**
   * Inactivity timeout in milliseconds
   * Closes connection if no data received within this time
   */
  inactivityTimeout?: number;

  /**
   * WebSocket sub-protocols to accept
   * @example ['chat', 'v2.chat']
   */
  subprotocols?: string[];

  /**
   * permessage-deflate compression configuration
   * @default false (disabled)
   */
  perMessageDeflate?: boolean | {
    clientNoContextTakeover?: boolean;
    serverNoContextTakeover?: boolean;
    clientMaxWindowBits?: 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;
    serverMaxWindowBits?: 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;
    strict?: boolean;
  };

  /**
   * Custom data transformation function
   * Override default JSON/text parsing
   */
  transformRawData?: (data: Buffer) => any | Promise<any>;

  /**
   * Delay before processing messages (ms)
   */
  delay?: number;

  /**
   * Pattern-based automatic responses
   * Messages matching conditions trigger automatic replies
   */
  responses?: Array<{
    /**
     * Function to test if message matches
     */
    match: (connection: IWebSocketConnection, message: any) => boolean;

    /**
     * Response data or function to generate response
     */
    response: any | ((connection: IWebSocketConnection, message: any) => any | Promise<any>);

    /**
     * Broadcast response instead of sending to sender
     */
    broadcast?: boolean | {
      room?: string;
      includeSelf?: boolean;
    };
  }>;

  /** Called when connection is established */
  onConnect?: (connection: IWebSocketConnection, request: IncomingMessage) => void | Promise<void>;

  /** Called when message is received */
  onMessage?: (connection: IWebSocketConnection, message: any) => void | Promise<void>;

  /** Called when connection is closed */
  onClose?: (connection: IWebSocketConnection, code: number, reason: string, initiatedByClient: boolean) => void | Promise<void>;

  /** Called on errors */
  onError?: (connection: IWebSocketConnection, error: Error) => void | Promise<void>;

  /** Called on ping frame received */
  onPing?: (connection: IWebSocketConnection, payload: Buffer) => void | Promise<void>;

  /** Called on pong frame received */
  onPong?: (connection: IWebSocketConnection, payload: Buffer) => void | Promise<void>;
}
```

---

## 💡 Usage Examples

### File-Based Mocking

#### Basic File Structure

```
project/
├── mock/
│   ├── users.json              # GET /api/users
│   ├── users/
│   │   ├── index.json          # GET /api/users/ (directory index)
│   │   └── profile.json        # GET /api/users/profile
│   ├── posts/
│   │   └── {id}.json           # GET /api/posts/123 (dynamic parameter)
│   └── data.xml                # GET /api/data (XML response)
└── vite.config.ts
```

#### Configuration

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [
    universalApi({
      endpointPrefix: '/api',
      fsDir: 'mock',
      // Global pagination for GET requests
      pagination: {
        GET: {
          type: 'query-param',
          limit: 'limit',
          skip: 'skip',
          sort: 'sortBy',
          order: 'order'
        }
      },
      // Global filters
      filters: {
        GET: {
          type: 'query-param',
          filters: [
            { key: 'status', valueType: 'string', comparison: 'eq' },
            { key: 'age', valueType: 'number', comparison: 'gte' }
          ]
        }
      }
    })
  ]
});
```

#### Requests

```bash
# Basic request
GET /api/users
# Returns: mock/users.json

# With pagination
GET /api/users?limit=10&skip=20&sortBy=name&order=desc
# Returns: Paginated and sorted array from users.json

# With filters
GET /api/users?status=active&age=25
# Returns: Filtered array (status === 'active' AND age >= 25)

# Dynamic path parameter
GET /api/posts/123
# Returns: mock/posts/123.json

# Directory index
GET /api/users/
# Returns: mock/users/index.json

# POST with body (creates/updates file)
POST /api/users
Content-Type: application/json

{"name": "New User", "email": "new@example.com"}
# Writes to: mock/users.json (appends to array if file exists)

# PUT (replaces file content)
PUT /api/users/123
# Writes to: mock/users/123.json (creates if not exists)

# DELETE (removes file)
DELETE /api/users/123
# Deletes: mock/users/123.json
```

---

### Custom REST Handlers

#### Basic Handler

```typescript
export default defineConfig({
  plugins: [
    universalApi({
      endpointPrefix: '/api',
      handlers: [
        {
          pattern: '/users/{id}',
          method: 'GET',
          handle: async (req, res) => {
            const userId = req.params?.id;

            // Simulate database lookup
            const user = await db.findUser(userId);

            if (!user) {
              res.writeHead(404, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'User not found' }));
              return;
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(user));
          }
        }
      ]
    })
  ]
});
```

#### Hybrid: Custom + File-System

```typescript
handlers: [
  {
    pattern: '/users',
    method: 'GET',
    handle: 'FS', // Use file-system
    preHandle: async (req, res) => {
      // Check authentication before reading file
      if (!req.headers.authorization) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return { continueHandle: false };
      }
      return { continueHandle: true };
    },
    postHandle: async (req, res, data) => {
      // Transform data after reading file
      const transformedData = data.map(user => ({
        ...user,
        fullName: `${user.firstName} ${user.lastName}`
      }));
      return { continueHandle: true, data: transformedData };
    }
  },
  {
    pattern: '/users',
    method: 'POST',
    handle: async (req, res) => {
      // Custom validation
      const { email, name } = req.body;

      if (!email || !email.includes('@')) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid email' }));
        return;
      }

      const newUser = { id: Date.now(), email, name };

      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(newUser));
    }
  }
]
```

#### With Middleware

```typescript
export default defineConfig({
  plugins: [
    universalApi({
      endpointPrefix: '/api',
      // Global middleware for all handlers
      handlerMiddlewares: [
        // Logger
        async (req, res, next) => {
          console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
          next();
        },
        // Authentication
        async (req, res, next) => {
          const token = req.headers.authorization?.replace('Bearer ', '');

          if (!token) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'No token provided' }));
            return;
          }

          try {
            req.body.user = await verifyToken(token);
            next();
          } catch (err) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid token' }));
          }
        }
      ],
      // Error middleware
      errorMiddlewares: [
        (err, req, res, next) => {
          console.error('API Error:', err);

          if (err.name === 'ValidationError') {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          } else {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error' }));
          }
        }
      ],
      handlers: [
        {
          pattern: '/protected/data',
          method: 'GET',
          handle: async (req, res) => {
            // req.body.user available from auth middleware
            const user = req.body.user;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: `Hello ${user.name}` }));
          }
        }
      ]
    })
  ]
});
```

---

### WebSocket Real-Time Communication

#### Basic Chat Server

```typescript
export default defineConfig({
  plugins: [
    universalApi({
      endpointPrefix: '/api',
      enableWs: true,
      wsHandlers: [
        {
          pattern: '/ws/chat',
          defaultRoom: 'lobby',
          heartbeat: 30000, // Send ping every 30 seconds
          inactivityTimeout: 60000, // Close after 1 minute of inactivity

          onConnect: (conn, req) => {
            console.log(`User connected: ${conn.id}`);

            // Send welcome message
            conn.send({
              type: 'system',
              message: 'Welcome to the chat!'
            });

            // Notify others
            conn.broadcast({
              type: 'system',
              message: 'A user joined the chat'
            }, { includeSelf: false });
          },

          onMessage: (conn, msg) => {
            console.log('Received:', msg);

            if (msg.type === 'chat') {
              // Broadcast to all in same room
              conn.broadcast({
                type: 'chat',
                user: msg.user,
                message: msg.message,
                timestamp: Date.now()
              }, { includeSelf: true });
            }

            if (msg.type === 'join-room') {
              conn.leaveRoom('lobby');
              conn.joinRoom(msg.room);

              conn.send({
                type: 'system',
                message: `Joined room: ${msg.room}`
              });
            }
          },

          onClose: (conn, code, reason) => {
            console.log(`User disconnected: ${conn.id}`);

            conn.broadcast({
              type: 'system',
              message: 'A user left the chat'
            }, { includeSelf: false });
          },

          onError: (conn, error) => {
            console.error('WebSocket error:', error);
          }
        }
      ]
    })
  ]
});
```

#### Advanced: Game Server with Rooms

```typescript
wsHandlers: [
  {
    pattern: '/ws/game',
    authenticate: async (req) => {
      const token = new URLSearchParams(req.url?.split('?')[1]).get('token');
      return token === 'valid-token';
    },

    perMessageDeflate: {
      serverNoContextTakeover: true,
      clientNoContextTakeover: true,
      serverMaxWindowBits: 15,
      clientMaxWindowBits: 15
    },

    heartbeat: 20000,

    // Automatic responses
    responses: [
      {
        match: (conn, msg) => msg.type === 'ping',
        response: { type: 'pong', timestamp: Date.now() }
      },
      {
        match: (conn, msg) => msg.type === 'get-rooms',
        response: (conn) => ({
          type: 'rooms',
          rooms: conn.getRooms()
        })
      }
    ],

    onConnect: (conn, req) => {
      // Extract game room from query params
      const url = new URL(req.url!, `http://${req.headers.host}`);
      const gameRoom = url.searchParams.get('room') || 'default';

      conn.joinRoom(gameRoom);
      conn.metadata.gameRoom = gameRoom;
      conn.metadata.username = url.searchParams.get('username') || 'Anonymous';

      // Send current game state
      conn.send({
        type: 'game-state',
        state: getGameState(gameRoom)
      });

      // Notify room members
      conn.broadcast({
        type: 'player-joined',
        username: conn.metadata.username
      }, { room: gameRoom, includeSelf: false });
    },

    onMessage: (conn, msg) => {
      const gameRoom = conn.metadata.gameRoom;

      switch (msg.type) {
        case 'move':
          // Update game state
          updateGameState(gameRoom, conn.metadata.username, msg.move);

          // Broadcast to all players in the same room
          conn.broadcast({
            type: 'player-moved',
            username: conn.metadata.username,
            move: msg.move
          }, { room: gameRoom, includeSelf: true });
          break;

        case 'chat':
          // Room-specific chat
          conn.broadcast({
            type: 'chat-message',
            username: conn.metadata.username,
            message: msg.message,
            timestamp: Date.now()
          }, { room: gameRoom, includeSelf: true });
          break;

        case 'leave-game':
          conn.leaveRoom(gameRoom);
          conn.send({ type: 'left-game' });
          break;
      }
    },

    onClose: (conn, code, reason, initiatedByClient) => {
      const gameRoom = conn.metadata.gameRoom;
      const username = conn.metadata.username;

      // Notify remaining players
      conn.broadcast({
        type: 'player-left',
        username: username,
        reason: reason || 'Connection closed'
      }, { room: gameRoom });

      // Cleanup game state
      removePlayerFromGame(gameRoom, username);
    }
  }
]
```

#### Client-Side Example

```typescript
// Frontend WebSocket client
const ws = new WebSocket('ws://localhost:5173/api/ws/chat');

ws.onopen = () => {
  console.log('Connected to chat');

  // Send message
  ws.send(JSON.stringify({
    type: 'chat',
    user: 'John',
    message: 'Hello everyone!'
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);

  if (data.type === 'chat') {
    displayMessage(data.user, data.message);
  } else if (data.type === 'system') {
    displaySystemMessage(data.message);
  }
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  console.log('Disconnected from chat');
};
```

---

### Advanced Patterns

#### Custom Parser (Express Integration)

```typescript
import express from 'express';
import multer from 'multer';

const upload = multer();

export default defineConfig({
  plugins: [
    universalApi({
      endpointPrefix: '/api',
      parser: {
        // Use Express parsers
        parser: [
          express.json(),
          express.urlencoded({ extended: true }),
          upload.any() // Handle multipart/form-data
        ],
        // Transform Express request to plugin format
        transform: (req: any) => ({
          body: req.body,
          files: req.files?.map((f: any) => ({
            name: f.originalname,
            content: f.buffer,
            contentType: f.mimetype
          })),
          query: new URLSearchParams(req.url.split('?')[1])
        })
      },
      handlers: [
        {
          pattern: '/upload',
          method: 'POST',
          handle: async (req, res) => {
            const files = req.files;
            if (files && files.length > 0) {
              console.log(`Received ${files.length} files`);
              files.forEach(file => {
                console.log(`- ${file.name} (${file.contentType})`);
              });
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: true,
              filesReceived: files?.length || 0
            }));
          }
        }
      ]
    })
  ]
});
```

#### Dynamic Mock Data Generation

```typescript
import { faker } from '@faker-js/faker';

handlers: [
  {
    pattern: '/users/random',
    method: 'GET',
    handle: async (req, res) => {
      const count = parseInt(req.query.get('count') || '10');

      const users = Array.from({ length: count }, () => ({
        id: faker.string.uuid(),
        name: faker.person.fullName(),
        email: faker.internet.email(),
        avatar: faker.image.avatar(),
        address: {
          street: faker.location.streetAddress(),
          city: faker.location.city(),
          country: faker.location.country()
        }
      }));

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(users));
    }
  }
]
```

#### Stateful Mock Server

```typescript
// Maintain state across requests
const mockDatabase = {
  users: new Map<string, any>(),
  posts: new Map<string, any>()
};

handlers: [
  {
    pattern: '/users',
    method: 'GET',
    handle: async (req, res) => {
      const users = Array.from(mockDatabase.users.values());
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(users));
    }
  },
  {
    pattern: '/users',
    method: 'POST',
    handle: async (req, res) => {
      const newUser = {
        id: Date.now().toString(),
        ...req.body,
        createdAt: new Date().toISOString()
      };

      mockDatabase.users.set(newUser.id, newUser);

      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(newUser));
    }
  },
  {
    pattern: '/users/{id}',
    method: 'GET',
    handle: async (req, res) => {
      const user = mockDatabase.users.get(req.params!.id);

      if (!user) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'User not found' }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(user));
    }
  },
  {
    pattern: '/users/{id}',
    method: 'DELETE',
    handle: async (req, res) => {
      const deleted = mockDatabase.users.delete(req.params!.id);

      if (!deleted) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'User not found' }));
        return;
      }

      res.writeHead(204);
      res.end();
    }
  }
]
```

---

## 📚 API Reference

### Request Object (UniversalApiRequest)

Extended `IncomingMessage` with additional properties:

```typescript
interface UniversalApiRequest extends IncomingMessage {
  /** Parsed request body (JSON, form data, etc.) */
  body: any;

  /** Extracted route parameters from pattern */
  params: Record<string, string> | null;

  /** Parsed URL query parameters */
  query: URLSearchParams;

  /** Uploaded files (multipart/form-data) */
  files: Array<{
    name: string;
    content: Buffer;
    contentType: string;
  }> | null;
}
```

#### Examples

```typescript
// Access parsed body
const { username, password } = req.body;

// Access route parameters
// Pattern: /users/{userId}/posts/{postId}
// URL: /users/123/posts/456
const userId = req.params.userId; // "123"
const postId = req.params.postId; // "456"

// Access query parameters
// URL: /search?q=typescript&page=2
const searchQuery = req.query.get('q'); // "typescript"
const page = parseInt(req.query.get('page') || '1'); // 2

// Access uploaded files
if (req.files && req.files.length > 0) {
  req.files.forEach(file => {
    console.log(`File: ${file.name}`);
    console.log(`Type: ${file.contentType}`);
    // Save file.content to disk
  });
}
```

---

## ⚡ WebSocket API

### Connection Object (IWebSocketConnection)

```typescript
interface IWebSocketConnection {
  /** Unique connection identifier */
  id: string;

  /** Request path that initiated the connection */
  path: string;

  /** Whether connection is closed */
  closed: boolean;

  /** Negotiated sub-protocol */
  subprotocol?: string;

  /** Custom metadata storage */
  metadata: Record<string, any>;

  /** Set of rooms this connection belongs to */
  rooms: Set<string>;

  /**
   * Send message to this connection
   * Automatically JSON-stringifies objects
   */
  send(data: any): Promise<void>;

  /**
   * Broadcast message to other connections
   * @param data Message to send
   * @param options Filtering options
   */
  broadcast(data: any, options?: {
    room?: string;
    includeSelf?: boolean;
  }): void;

  /**
   * Broadcast to all rooms this connection is in
   */
  broadcastAllRooms(data: any, includeSelf?: boolean): void;

  /**
   * Join a room
   */
  joinRoom(room: string): void;

  /**
   * Leave a room
   */
  leaveRoom(room: string): void;

  /**
   * Check if in a room
   */
  isInRoom(room: string): boolean;

  /**
   * Get all rooms
   */
  getRooms(): string[];

  /**
   * Send ping frame
   */
  ping(payload?: string | Buffer): void;

  /**
   * Send pong frame
   */
  pong(payload?: string | Buffer): void;

  /**
   * Close connection
   * @param code WebSocket close code (default 1000)
   * @param reason Close reason string
   * @param initiatedByClient Whether client initiated close
   */
  close(code?: number, reason?: string, initiatedByClient?: boolean): Promise<void>;

  /**
   * Force close without handshake
   */
  forceClose(): void;

  /**
   * Reset missed pong counter
   */
  resetMissedPong(): void;

  /**
   * Decompress data (if compression enabled)
   */
  decompressData(data: Buffer): Promise<Buffer>;
}
```

### WebSocket Close Codes

Standard close codes according to RFC 6455:

| Code | Name | Description |
|------|------|-------------|
| 1000 | Normal Closure | Successful operation / regular socket shutdown |
| 1001 | Going Away | Server/client going down or navigating away |
| 1002 | Protocol Error | Endpoint terminating due to protocol error |
| 1003 | Unsupported Data | Received data type that cannot be accepted |
| 1007 | Invalid Payload | Received inconsistent data (e.g., non-UTF-8) |
| 1008 | Policy Violation | Received message violating policy |
| 1009 | Message Too Big | Message too large to process |
| 1010 | Mandatory Extension | Client requires extensions server doesn't support |
| 1011 | Internal Error | Server encountered unexpected condition |
| 3000-3999 | Reserved | Framework/library codes |
| 4000-4999 | Reserved | Application codes |

---

### REST API Request Handling

Comprehensive table showing how different HTTP methods are handled in File-System mode and with handlers:

| Method | File Exists | Body Allowed | Files Allowed | Pagination | Filters | Behavior | Status Code | Notes |
|--------|-------------|--------------|---------------|------------|---------|----------|-------------|-------|
| **GET** | ✅ Yes | ❌ No | ❌ No | ✅ Yes (JSON arrays) | ✅ Yes (JSON arrays) | Returns file content | 200 | • Supports pagination/filters for JSON arrays<br>• Binary files returned as-is<br>• Directory lookup for `index.json` |
| **GET** | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No | Error | 404 | File not found |
| **HEAD** | ✅ Yes | ❌ No | ❌ No | ✅ Yes (JSON arrays) | ✅ Yes (JSON arrays) | Returns headers only | 200 | Same as GET but without body |
| **HEAD** | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No | Error | 404 | File not found |
| **POST** | ❌ No | ✅ Yes | ✅ Yes (single) | ❌ No | ❌ No | Creates new file | 201 | • Creates file with body or first file<br>• **Only first file is written** |
| **POST** | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No | Error | 400 | No data provided |
| **POST** | ✅ Yes (JSON) | ✅ Yes | ❌ No | ✅ Yes | ✅ Yes | Returns filtered data | 200 | • File not modified<br>• With pagination/filters: returns query results<br>• Without pagination/filters and with body: returns 409 Conflict |
| **POST** | ✅ Yes (JSON) | ❌ No | ❌ No | ✅ Yes | ✅ Yes | Returns filtered data | 200 | No modification, returns data with pagination/filters applied |
| **POST** | ✅ Yes (non-JSON) | - | - | ❌ No | ❌ No | Error | 400 | POST not allowed for non-JSON files |
| **POST** | - | ✅ Yes | ✅ Yes | - | - | Error | 400 | Cannot send both body and files |
| **POST** | - | - | ✅ Yes (multiple) | - | - | Error | 400 | Only single file allowed |
| **PUT** | ❌ No | ✅ Yes | ✅ Yes (single) | ❌ No | ❌ No | Creates file | 201 | • Body or first file becomes file content<br>• **Only first file is written** |
| **PUT** | ✅ Yes | ✅ Yes | ✅ Yes (single) | ❌ No | ❌ No | Replaces file | 200 | Completely replaces file content |
| **PUT** | - | ❌ No | ❌ No | ❌ No | ❌ No | Error | 400 | No data provided |
| **PUT** | - | - | ✅ Yes (multiple) | - | - | Error | 400 | Only single file allowed |
| **PATCH** | ✅ Yes (JSON) | ✅ Yes (JSON) | ❌ No | ❌ No | ❌ No | Merges/patches file | 200 | • Supports `application/json` (merge)<br>• Supports `application/json-patch+json` (JSON Patch RFC 6902)<br>• Supports `application/merge-patch+json` (Merge Patch RFC 7396) |
| **PATCH** | ❌ No | - | - | ❌ No | ❌ No | Error | 404 | Resource not found |
| **PATCH** | ✅ Yes (non-JSON) | - | - | ❌ No | ❌ No | Error | 400 | Only JSON files can be patched |
| **PATCH** | - | ✅ (non-JSON) | - | - | - | Error | 415 | Unsupported Content-Type |
| **DELETE** | ✅ Yes | ❌ No | ❌ No | ❌ No | ❌ No | Deletes file | 204 | • Removes entire file<br>• Returns `X-Deleted-Elements: 1` header |
| **DELETE** | ✅ Yes (JSON) | ❌ No | ❌ No | ✅ Yes | ✅ Yes | Partial delete | 204 | • With pagination/filters: deletes matched items from array<br>• If all items deleted: removes file<br>• If some items remain: updates file<br>• Returns `X-Deleted-Elements: N` header |
| **DELETE** | ❌ No | - | - | ❌ No | ❌ No | Error | 404 | Resource not found |
| **DELETE** | - | ✅ Yes | - | - | - | Error | 400 | Body not allowed in DELETE |
| **OPTIONS** | - | - | - | ❌ No | ❌ No | Error | 405 | Method not allowed in FS mode |

#### Legend

- ✅ **Yes**: Feature is supported/allowed
- ❌ **No**: Feature is not supported/will cause error
- **-**: Not applicable for this scenario
- **Status Codes**: HTTP status returned for the operation

#### Special Headers

The plugin uses custom headers for metadata:

| Header | Usage | Example |
|--------|-------|---------|
| `X-Total-Elements` | Total number of elements (before pagination) | `X-Total-Elements: 150` |
| `X-Deleted-Elements` | Number of elements deleted | `X-Deleted-Elements: 5` |

#### Content-Type Requirements

| Method | Content-Type | Required | Notes |
|--------|--------------|----------|-------|
| POST | `application/json` | No | Auto-detected for JSON body |
| POST | `multipart/form-data` | Yes | When sending files |
| POST | Other | Yes | Must match file content |
| PUT | Any | Yes | Must match file content |
| PATCH | `application/json` | Yes | Merge patch |
| PATCH | `application/json-patch+json` | Yes | JSON Patch (RFC 6902) |
| PATCH | `application/merge-patch+json` | Yes | Merge Patch (RFC 7396) |

#### Pagination & Filters Scope

**Pagination and Filters work ONLY when ALL of these conditions are met:**

1. ✅ File exists and contains **JSON array**
2. ✅ Method is **GET**, **POST**, **HEAD**, or **DELETE**
3. ✅ Pagination/filters are configured (globally or per-handler)
4. ✅ File is a valid JSON file

**Pagination & Filters do NOT work for:**

- ❌ Non-JSON files (binary, XML, HTML, etc.)
- ❌ JSON objects (not arrays)
- ❌ PUT or PATCH methods
- ❌ Custom programmatic handlers (unless explicitly implemented)

**Example scenarios:**

```json
// ✅ Works with pagination/filters
[
  {"id": 1, "name": "John"},
  {"id": 2, "name": "Jane"}
]

// ❌ Does NOT work (object, not array)
{
  "users": [
    {"id": 1, "name": "John"}
  ]
}

// ❌ Does NOT work (not JSON)
<users>
  <user id="1">John</user>
</users>
```

#### POST Method Special Behavior

The POST method has complex behavior depending on file existence and request content:

**File Does NOT Exist:**
```
POST /api/users
Body: {"name": "John"}
→ Creates new file with body content
→ Status: 201 Created
```

**File Exists (JSON) WITHOUT Pagination/Filters:**
```
POST /api/users
Body: {"name": "John"}
→ Error: File already exists
→ Status: 409 Conflict
```

**File Exists (JSON) WITH Pagination/Filters and NO Body:**
```
POST /api/users?status=active&limit=10
(no body)
→ Returns filtered/paginated data
→ File is NOT modified
→ Status: 200 OK
```

**File Exists (JSON) WITH Pagination/Filters and Body:**
```
POST /api/users?status=active
Body: {"name": "John"}
→ If body contains ONLY pagination/filter params: returns filtered data
→ If body contains OTHER data: Error 409 Conflict
→ File is NOT modified
```

**⚠️ Important POST Notes:**

1. When sending files (`multipart/form-data`), **only the FIRST file is written**. All other files are ignored.
2. You cannot send both `body` and `files` in the same POST request (Error 400).
3. Multiple files in a single POST request are not allowed (Error 400).
4. For non-JSON files, POST is only allowed when file doesn't exist (Error 400 if file exists).

#### DELETE Method Special Behavior

DELETE behavior varies based on pagination/filters configuration:

**Without Pagination/Filters:**
```
DELETE /api/users/123
→ Deletes entire file
→ Status: 204 No Content
→ Header: X-Deleted-Elements: 1
```

**With Pagination/Filters (JSON Array):**
```
DELETE /api/users?status=inactive
→ Deletes matching items from array
→ If array becomes empty: deletes file
→ If items remain: updates file with remaining items
→ Status: 204 No Content
→ Header: X-Deleted-Elements: 5
```

#### File Lookup Behavior

When a request path doesn't exactly match a file, the plugin tries multiple strategies:

1. **Exact file match**: `/api/users` → `mock/users` (if exists)
2. **Directory with index**: `/api/users/` → `mock/users/index.json` (if exists)
3. **File with extension**: `/api/data` → `mock/data.json`, `mock/data.xml`, etc.

**Example:**
```
Request: GET /api/users

Tries in order:
1. mock/users (exact match)
2. mock/users/index.json (directory index)
3. mock/users.json, mock/users.xml, etc. (with extensions)
```



## 🔧 Middleware System

### Middleware Execution Order

```
Request arrives
    ↓
[handlerMiddlewares] (in order)
    ↓
[parser] (if enabled)
    ↓
[handler function or FS routing]
    ↓
Response sent
    ↓
(If error occurs at any step)
    ↓
[errorMiddlewares] (in order)
```

### Middleware Types

#### 1. Handler Middleware

```typescript
type MiddlewareFunction = (
  req: UniversalApiRequest,
  res: ServerResponse,
  next: () => void
) => void | Promise<void>;
```

Example use cases:
- Authentication/Authorization
- Request logging
- Rate limiting
- Request validation
- Adding custom headers
- Request timing

#### 2. Error Middleware

```typescript
type ErrorHandlerFunction = (
  err: any,
  req: UniversalApiRequest | IncomingMessage,
  res: ServerResponse,
  next: (err?: any) => void
) => void | Promise<void>;
```

Example use cases:
- Error logging
- Error transformation
- Custom error responses
- Error monitoring/tracking

### Middleware Examples

```typescript
// Request logger
const loggerMiddleware: MiddlewareFunction = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
  });

  next();
};

// API key authentication
const apiKeyMiddleware: MiddlewareFunction = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey || !isValidApiKey(apiKey)) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid API key' }));
    return;
  }

  next();
};

// Request validation
const validateMiddleware: MiddlewareFunction = async (req, res, next) => {
  if (req.method === 'POST' || req.method === 'PUT') {
    if (!req.body) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Request body required' }));
      return;
    }

    try {
      await validateSchema(req.body);
      next();
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  } else {
    next();
  }
};

// CORS middleware
const corsMiddleware: MiddlewareFunction = (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  next();
};

// Error handler
const errorHandler: ErrorHandlerFunction = (err, req, res, next) => {
  console.error('Error:', err);

  // Don't send response if already sent
  if (res.writableEnded) {
    return;
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  }));
};
```

---

## 🎓 Advanced Features

### Pattern Matching

The plugin uses Ant-style path patterns for flexible routing:

| Pattern | Matches | Example |
|---------|---------|---------|
| `/api/users` | Exact match | `/api/users` |
| `/api/*` | Single segment wildcard | `/api/users`, `/api/posts` |
| `/api/**` | Multi-segment wildcard | `/api/users/123`, `/api/posts/456/comments` |
| `/api/{id}` | Path parameter | `/api/123` (params.id = "123") |
| `/api/users/{userId}/posts/{postId}` | Multiple parameters | `/api/users/1/posts/2` |
| `/api/**.json` | Extension match | `/api/data.json`, `/api/sub/data.json` |

### Pagination Details

When pagination is enabled for a file-based handler:

1. **File must contain a JSON array**
2. **Query params or body fields are extracted** based on configuration
3. **Operations applied in order:**
   - Filtering (if configured)
   - Sorting (if sort field provided)
   - Pagination (skip and limit)

**Response format:**

```json
{
  "data": [...],
  "pagination": {
    "total": 100,
    "skip": 20,
    "limit": 10,
    "returned": 10
  }
}
```

### Filtering Details

Supported comparison operators:

- `eq`: Equals (==)
- `neq`: Not equals (!=)
- `gt`: Greater than (>)
- `gte`: Greater than or equal (>=)
- `lt`: Less than (<)
- `lte`: Less than or equal (<=)
- `in`: Value in array
- `nin`: Value not in array
- `contains`: String contains substring (case-insensitive)

**Example:**

```typescript
filters: {
  GET: {
    type: 'query-param',
    filters: [
      { key: 'status', valueType: 'string', comparison: 'eq' },
      { key: 'minAge', field: 'age', valueType: 'number', comparison: 'gte' },
      { key: 'categories', field: 'category', valueType: 'string', comparison: 'in' }
    ]
  }
}

// Request: GET /api/users?status=active&minAge=18&categories=admin,moderator
// Filters: status === 'active' AND age >= 18 AND category IN ['admin', 'moderator']
```

### WebSocket Compression

When `perMessageDeflate` is enabled:

- Messages are compressed using DEFLATE algorithm (RFC 1951)
- Reduces bandwidth usage for text-heavy messages
- Configurable compression parameters
- **Note:** Adds CPU overhead, use for text > 1KB

**Compression Options:**

```typescript
perMessageDeflate: {
  // Client doesn't reuse compression context between messages
  clientNoContextTakeover: false,

  // Server doesn't reuse compression context between messages
  serverNoContextTakeover: false,

  // LZ77 sliding window size for client (8-15, higher = better compression)
  clientMaxWindowBits: 15,

  // LZ77 sliding window size for server
  serverMaxWindowBits: 15,

  // Reject handshake if client doesn't support these exact parameters
  strict: false
}
```

### File-System Handler Details

#### POST Request Behavior

When handling `POST` to a file-based endpoint:

1. **If file exists and contains JSON array:** Append new item
2. **If file exists and contains JSON object:** Replace with new object
3. **If file doesn't exist:** Create new file with body content
4. **If `req.files` exists:** Write first file to the path (other files ignored)

**⚠️ Important:** When handling file-system POST requests, **only the first file in `req.files` is written**. Other files are ignored.

#### PUT/PATCH Request Behavior

- **PUT**: Replace entire file content
- **PATCH**: Merge with existing JSON object (if file exists)

#### DELETE Request Behavior

- Deletes the file at the matched path
- Returns 404 if file doesn't exist

### Response Streaming

When manually handling responses with streams:

```typescript
handle: async (req, res) => {
  const fileStream = fs.createReadStream('/path/to/large/file.zip');

  res.writeHead(200, {
    'Content-Type': 'application/zip',
    'Content-Disposition': 'attachment; filename="file.zip"'
  });

  fileStream.pipe(res);

  // ⚠️ IMPORTANT: Wait for stream to finish before returning
  await new Promise((resolve, reject) => {
    fileStream.on('end', resolve);
    fileStream.on('error', reject);
  });

  // Plugin checks res.writableEnded to determine if response is complete
}
```

**⚠️ Important:** If you manually use streams in your response, you must wait for them to finish before the handler function returns. Otherwise, the plugin might interfere with the response, causing unexpected behavior.

---

## ⚠️ Important Notes

### Handler Middleware Scope

**handlerMiddlewares** are executed **only** for handlers defined in the `handlers` array. They are **NOT** executed for:
- Pure file-system requests (when no custom handler matches)
- WebSocket requests
- Requests forwarded via `noHandledRestFsRequestsAction: 'forward'`

### Parser Scope

The `parser` option applies **only** to REST API requests. It is **NOT** used for:
- WebSocket messages (use `transformRawData` instead)

### Pagination and Filters Scope

Pagination and filters work **only** with:
- File-based handlers returning JSON arrays
- Handlers defined with `handle: 'FS'`

They do **NOT** work with:
- Custom programmatic handlers
- Non-JSON files
- JSON objects (not arrays)

### Pattern Matching Priority

When multiple handlers match a request:
1. More specific patterns have priority
2. First matching handler in the array is used
3. `handlers` array order matters

### WebSocket Pattern Collisions

Each WebSocket handler must have a **unique pattern**. Duplicate patterns will cause an error at startup.

### Performance Considerations

- **File I/O**: File-based routing reads from disk on each request. For production, use a real backend.
- **Compression**: WebSocket compression adds CPU overhead. Enable only for text-heavy messages.
- **Heartbeat**: Lower heartbeat intervals increase network traffic.
- **Large Files**: Use streams for large file responses to avoid memory issues.

---

## 🔍 Troubleshooting

### Common Issues

#### 1. Plugin Not Working

**Symptoms:** Requests return 404 or are handled by Vite's default handler

**Solutions:**
- Check `endpointPrefix` matches your request URL
- Verify `disable` option is not set to `true`
- Ensure `fsDir` path exists (if using file-based routing)
- Check Vite server logs for error messages

```typescript
// Enable debug logging
universalApi({
  logLevel: 'debug',
  // ...
})
```

#### 2. WebSocket Connection Fails

**Symptoms:** WebSocket upgrade fails with 401, 404, or 500

**Solutions:**
- Ensure `enableWs: true` is set
- Check `wsHandlers` pattern matches your WebSocket URL
- Verify `authenticate` function (if defined) returns `true`
- Check browser console and Vite server logs

```typescript
// Test authentication
wsHandlers: [{
  pattern: '/ws/test',
  authenticate: async (req) => {
    console.log('Auth check:', req.headers);
    return true; // Allow all during debugging
  }
}]
```

#### 3. Request Body is Undefined

**Symptoms:** `req.body` is `undefined` or `null`

**Solutions:**
- Ensure `parser` is not disabled
- Check `Content-Type` header is set correctly
- Verify request body is valid JSON (for built-in parser)
- Try custom parser with logging

```typescript
parser: {
  parser: (req, res, next) => {
    console.log('Content-Type:', req.headers['content-type']);
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      console.log('Raw body:', body);
      try {
        req.body = JSON.parse(body);
      } catch (e) {
        console.error('Parse error:', e);
      }
      next();
    });
  },
  transform: (req: any) => ({ body: req.body })
}
```

#### 4. File Not Found

**Symptoms:** 404 error when accessing file-based endpoint

**Solutions:**
- Check file path relative to `fsDir`
- Verify file extension matches request
- Check file permissions
- Try absolute path in logs

```typescript
handlers: [{
  pattern: '/test/**',
  method: 'GET',
  handle: 'FS',
  preHandle: (req, res) => {
    console.log('Looking for file:', req.url);
    console.log('fsDir:', options.fsDir);
    return { continueHandle: true };
  }
}]
```

#### 5. CORS Errors

**Symptoms:** Browser blocks requests with CORS policy error

**Solutions:**
- Add CORS middleware

```typescript
handlerMiddlewares: [
  (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    next();
  }
]
```

#### 6. Pagination Not Working

**Symptoms:** Pagination returns entire array

**Solutions:**
- Ensure file contains a JSON array, not an object
- Check pagination parameter names match query params
- Verify file contains more items than `limit`

```typescript
// Debug pagination
pagination: {
  GET: {
    type: 'query-param',
    limit: 'limit',
    skip: 'skip'
  }
}

// Request: GET /api/users?limit=5&skip=0
// Should return first 5 items
```

#### 7. WebSocket Messages Not Received

**Symptoms:** `onMessage` not called or messages lost

**Solutions:**
- Ensure messages are valid JSON (if not using `transformRawData`)
- Check WebSocket is fully connected before sending
- Verify no errors in browser console
- Add logging to `onMessage`

```typescript
onMessage: (conn, msg) => {
  console.log('Received message:', msg);
  // Your logic here
}
```

### Debug Mode

Enable maximum verbosity for troubleshooting:

```typescript
universalApi({
  logLevel: 'debug',
  // ... other options
})
```

This will log:
- Plugin initialization
- Request matching attempts
- File system operations
- WebSocket lifecycle events
- Middleware execution
- Parser operations

---



## 📄 License

[MIT](LICENSE) © [nDriaDev](https://github.com/nDriaDev)

---

## 🙏 Acknowledgments

- Inspired by various mock server solutions
- Built with [Vite](https://vitejs.dev/)
- Tested with [Vitest](https://vitest.dev/)

---

## 📞 Support

- **Issues:** [GitHub Issues](https://github.com/nDriaDev/vite-plugin-universal-api/issues)
- **Discussions:** [GitHub Discussions](https://github.com/nDriaDev/vite-plugin-universal-api/discussions)
- **Email:** info@ndria.dev

---



<div align="center">


If you find this plugin useful, please consider giving it a ⭐ on [GitHub](https://github.com/nDriaDev/vite-plugin-universal-api)!

</div>
