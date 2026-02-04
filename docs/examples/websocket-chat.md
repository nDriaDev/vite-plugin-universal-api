# WebSocket Chat Example

Real-time chat application with rooms.

## Server Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import mockApi from '@ndriadev/vite-plugin-ws-rest-fs-api'

export default defineConfig({
  plugins: [
    mockApi({
      endpointPrefix: '/api',
      enableWs: true,
      
      wsHandlers: [
        {
          pattern: '/ws/chat',
          heartbeat: 30000,
          
          onConnect: (conn) => {
            console.log('Client connected:', conn.id)
            conn.send({ type: 'connected', id: conn.id })
          },
          
          onMessage: (conn, data) => {
            switch (data.type) {
              case 'join':
                conn.joinRoom(data.room || 'general')
                conn.broadcast({
                  type: 'user-joined',
                  username: data.username,
                  room: data.room || 'general'
                }, { 
                  rooms: [data.room || 'general'],
                  includeSelf: false
                })
                break
                
              case 'message':
                conn.broadcast({
                  type: 'chat-message',
                  username: data.username,
                  message: data.message,
                  timestamp: Date.now()
                }, { 
                  rooms: [data.room || 'general'],
                  includeSelf: true
                })
                break
                
              case 'leave':
                conn.leaveRoom(data.room || 'general')
                conn.broadcast({
                  type: 'user-left',
                  username: data.username,
                  room: data.room || 'general'
                }, { rooms: [data.room || 'general'] })
                break
            }
          },
          
          onClose: (conn) => {
            console.log('Client disconnected:', conn.id)
          }
        }
      ]
    })
  ]
})
```

## React Client

```tsx
import { useState, useEffect, useRef } from 'react'

function Chat() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const ws = useRef(null)
  
  useEffect(() => {
    ws.current = new WebSocket('ws://localhost:5173/api/ws/chat')
    
    ws.current.onopen = () => {
      ws.current.send(JSON.stringify({ 
        type: 'join', 
        username: 'User',
        room: 'general'
      }))
    }
    
    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.type === 'chat-message') {
        setMessages(prev => [...prev, data])
      }
    }
    
    return () => ws.current.close()
  }, [])
  
  const sendMessage = () => {
    if (input.trim()) {
      ws.current.send(JSON.stringify({
        type: 'message',
        username: 'User',
        message: input,
        room: 'general'
      }))
      setInput('')
    }
  }
  
  return (
    <div>
      <div>
        {messages.map((msg, i) => (
          <div key={i}>
            <strong>{msg.username}:</strong> {msg.message}
          </div>
        ))}
      </div>
      <input 
        value={input} 
        onChange={(e) => setInput(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
      />
      <button onClick={sendMessage}>Send</button>
    </div>
  )
}
```

Real-time chat in under 100 lines!
