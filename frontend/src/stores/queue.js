import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useAuthStore } from './auth.js'
import { useToast } from '../composables/useToast.js'

const API = import.meta.env.VITE_API_URL || ''

export const useQueueStore = defineStore('queue', () => {
  const nowPlaying = ref(null)
  const queue = ref([])
  const totalInQueue = ref(0)
  const fallbackActive = ref(false)
  const mySongs = ref([])
  const rateLimit = ref(null)
  const recentHistory = ref([])
  const loading = ref(false)

  async function fetchQueue(venueSlug) {
    const res = await fetch(`${API}/api/queue?venue=${venueSlug}`)
    if (!res.ok) return
    const data = await res.json()
    nowPlaying.value = data.now_playing
    queue.value = data.queue
    totalInQueue.value = data.total_in_queue
    fallbackActive.value = data.fallback_active
  }

  async function submitSong(youtubeUrl) {
    const auth = useAuthStore()
    const res = await fetch(`${API}/api/queue/songs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth.authHeaders() },
      body: JSON.stringify({ youtube_url: youtubeUrl }),
    })
    if (!res.ok) {
      let detail = 'Error al enviar cancion'
      try {
        const err = await res.json()
        detail = err.detail || detail
      } catch { /* non-JSON response (e.g. 500) */ }
      throw new Error(detail)
    }
    return await res.json()
  }

  async function confirmSong(youtubeId) {
    const auth = useAuthStore()
    const res = await fetch(`${API}/api/queue/songs/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth.authHeaders() },
      body: JSON.stringify({ youtube_id: youtubeId }),
    })
    if (!res.ok) {
      let detail = 'Error al confirmar cancion'
      try {
        const err = await res.json()
        detail = err.detail || detail
      } catch { /* non-JSON response */ }
      throw new Error(detail)
    }
    return await res.json()
  }

  async function fetchMySongs() {
    const auth = useAuthStore()
    const res = await fetch(`${API}/api/queue/my-songs`, {
      headers: auth.authHeaders(),
    })
    if (!res.ok) return
    const data = await res.json()

    // Detect position changes for already-tracked songs and surface as toasts
    // so the user feels their song moving forward in real time. Only fire on
    // promotions (improvement) — demotions are covered by reorder events the
    // admin sees, customer doesn't need to know if dropped intentionally.
    notifyPositionChanges(mySongs.value, data.songs)

    mySongs.value = data.songs
    rateLimit.value = data.rate_limit
  }

  // Track which songs we've already notified as "siguiente" so we don't spam
  // the toast on every refresh while position stays at 1.
  const notifiedNextUp = new Set()

  function notifyPositionChanges(prev, next) {
    if (!prev || !prev.length || !next || !next.length) return
    const t = useToast()
    const prevById = new Map(prev.map(s => [s.id, s]))

    for (const song of next) {
      // Skip songs already playing (they get the "your song is playing" toast)
      if (song.status !== 'pending') continue

      const old = prevById.get(song.id)

      // "Eres el siguiente" — fire once when position becomes 1
      if (song.position === 1 && (!old || old.position > 1)) {
        if (!notifiedNextUp.has(song.id)) {
          t.success(`🎵 Tu canción es la siguiente: "${truncate(song.title, 40)}"`, 6000)
          notifiedNextUp.add(song.id)
        }
        continue
      }

      // Position improved by at least 1 (and not just landing at 1, handled above)
      if (old && old.status === 'pending' && song.position < old.position && song.position > 1) {
        t.info(`Subiste a #${song.position}: "${truncate(song.title, 30)}"`, 3500)
      }
    }

    // Cleanup notifiedNextUp set: drop entries no longer pending
    const stillPending = new Set(next.filter(s => s.status === 'pending').map(s => s.id))
    for (const id of notifiedNextUp) {
      if (!stillPending.has(id)) notifiedNextUp.delete(id)
    }
  }

  function truncate(s, n) {
    if (!s) return ''
    return s.length > n ? s.slice(0, n - 1) + '…' : s
  }

  async function fetchRecentHistory() {
    const auth = useAuthStore()
    const res = await fetch(`${API}/api/queue/recent-history`, {
      headers: auth.authHeaders(),
    })
    if (!res.ok) return
    const data = await res.json()
    recentHistory.value = data.recent_songs
  }

  async function fetchRemainingSlots() {
    const auth = useAuthStore()
    const res = await fetch(`${API}/api/queue/remaining-slots`, {
      headers: auth.authHeaders(),
    })
    if (!res.ok) return
    rateLimit.value = await res.json()
  }

  async function cancelMySong(songId) {
    const auth = useAuthStore()
    const res = await fetch(`${API}/api/queue/my-songs/${songId}`, {
      method: 'DELETE',
      headers: auth.authHeaders(),
    })
    if (!res.ok) {
      let detail = 'Error al cancelar cancion'
      try {
        const err = await res.json()
        detail = err.detail || detail
      } catch { /* non-JSON response */ }
      throw new Error(detail)
    }
    return await res.json()
  }

  return {
    nowPlaying, queue, totalInQueue, fallbackActive,
    mySongs, rateLimit, recentHistory, loading,
    fetchQueue, submitSong, confirmSong, cancelMySong,
    fetchMySongs, fetchRecentHistory, fetchRemainingSlots,
  }
})
