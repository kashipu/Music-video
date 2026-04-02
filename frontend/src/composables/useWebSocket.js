import { ref, onUnmounted } from 'vue'

const WS_URL = import.meta.env.VITE_WS_URL || `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`

export function useWebSocket(venueSlug, userId = null) {
  const ws = ref(null)
  const connected = ref(false)
  const lastEvent = ref(null)
  let reconnectTimer = null
  let reconnectDelay = 1000
  const handlers = new Set()
  const reconnectHandlers = new Set()

  function connect() {
    if (!venueSlug) return
    if (ws.value) {
      try { ws.value.close() } catch { /* ignore */ }
      ws.value = null
    }

    let url = `${WS_URL}/ws/queue?venue=${venueSlug}`
    if (userId) url += `&user_id=${userId}`

    try {
      ws.value = new WebSocket(url)
    } catch {
      scheduleReconnect()
      return
    }

    ws.value.onopen = () => {
      const wasDisconnected = !connected.value
      connected.value = true
      reconnectDelay = 1000
      // On reconnect, notify so views can re-fetch full state
      if (wasDisconnected) {
        reconnectHandlers.forEach(h => h())
      }
    }

    ws.value.onmessage = (event) => {
      let data
      try {
        data = JSON.parse(event.data)
      } catch {
        return // ignore malformed messages
      }
      lastEvent.value = data
      handlers.forEach(h => {
        try { h(data) } catch { /* handler error — don't break other handlers */ }
      })
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
      reconnectDelay = Math.min(reconnectDelay * 1.5, 15000)
      connect()
    }, reconnectDelay)
  }

  function onEvent(handler) {
    handlers.add(handler)
    return () => handlers.delete(handler)
  }

  function onReconnect(handler) {
    reconnectHandlers.add(handler)
    return () => reconnectHandlers.delete(handler)
  }

  function disconnect() {
    if (reconnectTimer) clearTimeout(reconnectTimer)
    reconnectTimer = null
    ws.value?.close()
    connected.value = false
    handlers.clear()
    reconnectHandlers.clear()
  }

  function sendPing() {
    if (ws.value?.readyState === WebSocket.OPEN) {
      ws.value.send('ping')
    }
  }

  // iOS Safari kills WebSockets when app goes to background.
  // Any browser can also lose connection on unstable networks.
  // On return: force reconnect + always re-fetch data since messages were likely lost.
  function handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
      reconnectDelay = 500
      if (!ws.value || ws.value.readyState !== WebSocket.OPEN) {
        connect()
      } else {
        // Connection looks open but could be stale — ping + re-fetch anyway
        sendPing()
        reconnectHandlers.forEach(h => h())
      }
    }
  }

  document.addEventListener('visibilitychange', handleVisibilityChange)

  connect()

  const pingInterval = setInterval(sendPing, 30000)

  onUnmounted(() => {
    clearInterval(pingInterval)
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    disconnect()
  })

  return { ws, connected, lastEvent, onEvent, onReconnect, disconnect }
}
