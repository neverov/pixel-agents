/**
 * Server API — WebSocket + REST client replacing vscodeApi.ts
 *
 * Provides the same postMessage/onMessage interface so existing code
 * needs minimal changes.
 */

const RECONNECT_DELAY_MS = 2000
const MAX_RECONNECT_DELAY_MS = 30000

type MessageHandler = (msg: Record<string, unknown>) => void

let ws: WebSocket | null = null
let reconnectDelay = RECONNECT_DELAY_MS
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
const handlers: Set<MessageHandler> = new Set()

// Buffer messages that arrive before any handler is registered
let earlyMessages: Record<string, unknown>[] = []
let hasHadHandler = false

// Messages that route to REST endpoints instead of WebSocket
const REST_ROUTES: Record<string, { method: string; path: (msg: Record<string, unknown>) => string }> = {
  openClaude: { method: 'POST', path: () => '/api/agents' },
  closeAgent: { method: 'DELETE', path: (msg) => `/api/agents/${msg.id}` },
  saveLayout: { method: 'PUT', path: () => '/api/layout' },
  setSoundEnabled: { method: 'PUT', path: () => '/api/settings' },
  saveAgentSeats: { method: 'PUT', path: () => '/api/settings' },
}

function connect(): void {
  if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) return

  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
  ws = new WebSocket(`${protocol}//${location.host}/ws`)

  ws.onopen = () => {
    console.log('[serverApi] WebSocket connected')
    reconnectDelay = RECONNECT_DELAY_MS
  }

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data as string) as Record<string, unknown>
      if (handlers.size > 0) {
        for (const handler of handlers) {
          handler(msg)
        }
      } else if (!hasHadHandler) {
        // Buffer until first handler registers
        earlyMessages.push(msg)
      }
    } catch (err) {
      console.error('[serverApi] Failed to parse WS message:', err)
    }
  }

  ws.onclose = () => {
    console.log('[serverApi] WebSocket disconnected, reconnecting...')
    ws = null
    scheduleReconnect()
  }

  ws.onerror = () => {
    // onclose will fire after onerror
  }
}

function scheduleReconnect(): void {
  if (reconnectTimer) return
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    connect()
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY_MS)
  }, reconnectDelay)
}

async function sendRest(route: { method: string; path: (msg: Record<string, unknown>) => string }, msg: Record<string, unknown>): Promise<void> {
  try {
    await fetch(route.path(msg), {
      method: route.method,
      headers: { 'Content-Type': 'application/json' },
      body: route.method !== 'DELETE' ? JSON.stringify(msg) : undefined,
    })
  } catch (err) {
    console.error('[serverApi] REST request failed:', err)
  }
}

function postMessage(msg: unknown): void {
  const message = msg as Record<string, unknown>
  const type = message.type as string

  const route = REST_ROUTES[type]
  if (route) {
    void sendRest(route, message)
    return
  }

  // Everything else goes via WebSocket
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message))
  } else {
    console.warn('[serverApi] WS not connected, dropping message:', type)
  }
}

function onMessage(handler: MessageHandler): () => void {
  handlers.add(handler)

  // Replay any early messages that arrived before this handler was registered
  if (!hasHadHandler && earlyMessages.length > 0) {
    hasHadHandler = true
    const buffered = earlyMessages
    earlyMessages = []
    for (const msg of buffered) {
      handler(msg)
    }
  } else {
    hasHadHandler = true
  }

  return () => handlers.delete(handler)
}

// Connect on module load
connect()

export const serverApi = {
  postMessage,
  onMessage,
}
