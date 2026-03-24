import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useAuthStore } from './auth.js'

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
      const err = await res.json()
      throw new Error(err.detail || 'Failed to submit song')
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
      const err = await res.json()
      throw new Error(err.detail || 'Failed to confirm song')
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
    mySongs.value = data.songs
    rateLimit.value = data.rate_limit
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

  function handleWsEvent(event) {
    const { event: eventType, data } = event
    switch (eventType) {
      case 'song_added':
        queue.value.push(data)
        totalInQueue.value = queue.value.length
        break
      case 'song_removed':
        queue.value = queue.value.filter(s => s.id !== data.id)
        totalInQueue.value = queue.value.length
        break
      case 'now_playing_changed':
        nowPlaying.value = data.song
        if (data.song) {
          queue.value = queue.value.filter(s => s.id !== data.song.id)
          totalInQueue.value = queue.value.length
        }
        fallbackActive.value = data.fallback_active || false
        break
      case 'queue_reordered':
        if (data.queue) {
          const posMap = {}
          data.queue.forEach(q => { posMap[q.id] = q.position })
          queue.value.forEach(s => {
            if (posMap[s.id] !== undefined) s.position = posMap[s.id]
          })
          queue.value.sort((a, b) => a.position - b.position)
        }
        break
      case 'song_skipped':
        nowPlaying.value = data.now_playing
        break
      case 'playback_status_changed':
        // handled in kiosk view
        break
    }
  }

  async function cancelMySong(songId) {
    const auth = useAuthStore()
    const res = await fetch(`${API}/api/queue/my-songs/${songId}`, {
      method: 'DELETE',
      headers: auth.authHeaders(),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.detail || 'Failed to cancel song')
    }
    return await res.json()
  }

  return {
    nowPlaying, queue, totalInQueue, fallbackActive,
    mySongs, rateLimit, recentHistory, loading,
    fetchQueue, submitSong, confirmSong, cancelMySong,
    fetchMySongs, fetchRecentHistory, fetchRemainingSlots,
    handleWsEvent,
  }
})
