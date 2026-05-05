import { ref } from 'vue'

// Module-level state — single toast queue shared across the app so a toast
// fired from any component shows in the global Toast container.
const toasts = ref([])
let nextId = 1

function push(message, type = 'info', duration = 3500) {
  const id = nextId++
  toasts.value.push({ id, message, type })
  setTimeout(() => dismiss(id), duration)
  return id
}

function dismiss(id) {
  toasts.value = toasts.value.filter(t => t.id !== id)
}

export function useToast() {
  return {
    toasts,
    success: (msg, dur) => push(msg, 'success', dur),
    error: (msg, dur) => push(msg, 'error', dur ?? 5000),
    info: (msg, dur) => push(msg, 'info', dur),
    warn: (msg, dur) => push(msg, 'warn', dur),
    dismiss,
  }
}

/**
 * Wrap a fetch call so any failure surfaces as an error toast and the caller
 * still gets the response (or null on failure). Use for admin actions where
 * silent failures hurt awareness of system state.
 *
 *   const ok = await safeFetch('skip', () => fetch(...), { success: 'Saltado' })
 */
export async function safeFetch(actionName, fetcher, opts = {}) {
  const t = useToast()
  try {
    const res = await fetcher()
    if (!res.ok) {
      let detail = `${res.status}`
      try {
        const body = await res.clone().json()
        detail = body.detail || detail
      } catch { /* non-json */ }
      t.error(`${actionName}: ${detail}`)
      return { ok: false, res, error: detail }
    }
    if (opts.success) t.success(opts.success)
    return { ok: true, res }
  } catch (e) {
    t.error(`${actionName}: error de red`)
    return { ok: false, error: e?.message || 'network error' }
  }
}
