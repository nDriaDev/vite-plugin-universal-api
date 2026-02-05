# WebSocket Game Server Example

Multiplayer game server with rooms and state management.

## Server

```typescript
import { defineConfig } from 'vite'
// import mockApi from '@ndriadev/vite-plugin-universal-api' //Default export
import { universalApi } from '@ndriadev/vite-plugin-universal-api' // Named export

const games = new Map()

export default defineConfig({
  plugins: [
    universalApi({
      enableWs: true,
      wsHandlers: [
        {
          pattern: '/ws/game',
          heartbeat: 10000,
          compression: { enabled: true },

          onMessage: (conn, data) => {
            switch (data.type) {
              case 'create-game':
                const gameId = `game-${Date.now()}`
                games.set(gameId, { players: [conn.id], state: {} })
                conn.joinRoom(gameId)
                conn.send({ type: 'game-created', gameId })
                break

              case 'join-game':
                if (games.has(data.gameId)) {
                  games.get(data.gameId).players.push(conn.id)
                  conn.joinRoom(data.gameId)
                  conn.broadcast({
                    type: 'player-joined',
                    playerId: conn.id
                  }, { rooms: [data.gameId] })
                }
                break

              case 'game-action':
                conn.broadcast({
                  type: 'game-update',
                  playerId: conn.id,
                  action: data.action
                }, { rooms: [data.gameId], includeSelf: true })
                break
            }
          }
        }
      ]
    })
  ]
})
```

Simple multiplayer game server!
