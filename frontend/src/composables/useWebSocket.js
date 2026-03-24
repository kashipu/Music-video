import { ref, onUnmounted } from 'vue'

const WS_URL = import.meta.env.VITE_WS_URL || `ws://${window.location.host}`

export function useWebSocket(venueSlug, userId = null) {
  const ws = ref(null)
  const connected = ref(false)
  const lastEvent = ref(null)
  let reconnectTimer = null
  let reconnectDelay = 1000
  const handlers = new Set()

  function connect() {
    if (!venueSlug) return
    let url = `${WS_URL}/ws/queue?venue=${venueSlug}`
    if (userId) url += `&user_id=${userId}`

    try {
      ws.value = new WebSocket(url)
    } catch {
      scheduleReconnect()
      return
    }

    ws.value.onopen = () => {
      connected.value = true
      reconnectDelay = 1000 // reset on success
    }

    ws.value.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        lastEvent.value = data
        handlers.forEach(h => h(data))
      } catch {
        // ignore malformed messages
      }
    }

    ws.value.onclose = () => {
      connected.value = false
      scheduleReconnect()
    }

    ws.value.onerror = () => {
      ws.value?.close()
    }
  }

  function scheduleReconnect() {
    if (reconnectTimer) clearTimeout(reconnectTimer)
    reconnectTimer = setTimeout(() => {
      reconnectDelay = Math.min(reconnectDelay * 1.5, 15000) // exponential backoff, max 15s
      connect()
    }, reconnectDelay)
  }

  function onEvent(handler) {
    handlers.add(handler)
    // Return cleanup function
    return () => handlers.delete(handler)
  }

  function disconnect() {
    if (reconnectTimer) clearTimeout(reconnectTimer)
    reconnectTimer = null
    ws.value?.close()
    connected.value = false
    handlers.clear()
  }

  function sendPing() {
    if (ws.value?.readyState === WebSocket.OPEN) {
      ws.value.send('ping')
    }
  }

  connect()

  const pingInterval = setInterval(sendPing, 30000)

  onUnmounted(() => {
    clearInterval(pingInterval)
    disconnect()
  })

  return { ws, connected, lastEvent, onEvent, disconnect }
}
