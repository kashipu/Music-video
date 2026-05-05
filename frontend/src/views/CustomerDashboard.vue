<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import { useQueueStore } from '../stores/queue.js'
import { useWebSocket } from '../composables/useWebSocket.js'
import { formatDuration } from '../utils/youtube.js'
import { useTheme } from '../composables/useTheme.js'
import SongSubmit from '../components/SongSubmit.vue'
import SongPreview from '../components/SongPreview.vue'
import { trackSongConfirmed, trackSongCancelled, trackSessionKicked, trackSessionExpired, setAnalyticsContext } from '../utils/analytics.js'

const route = useRoute()
const router = useRouter()
const { currentMode, toggleMode, applyVenueTheme } = useTheme()
const auth = useAuthStore()
const queueStore = useQueueStore()

const venueSlug = route.params.venueSlug
const preview = ref(null)
const confirmLoading = ref(false)
const cancelLoading = ref({})
const toast = ref('')
const toastTimeout = ref(null)
const mySongPlaying = ref(false)
const songError = ref(null) // { title, youtube_id, message }
const supportsNotifications = 'Notification' in window && typeof Notification.requestPermission === 'function'
const notificationPermission = ref(supportsNotifications ? Notification.permission : 'denied')

const isMyNowPlaying = computed(() => {
  if (!queueStore.nowPlaying) return false
  return queueStore.mySongs.some(s => s.id === queueStore.nowPlaying.id) || mySongPlaying.value
})

const nextFive = computed(() => queueStore.queue.slice(0, 5))

// Refresh all data from server
function refreshAll() {
  queueStore.fetchQueue(venueSlug)
  queueStore.fetchMySongs()
  queueStore.fetchRemainingSlots()
}

// WebSocket
const { onEvent, onReconnect } = useWebSocket(venueSlug, auth.user?.id)

// On reconnect (after background, network loss, etc.), re-fetch everything
// since we likely missed events while disconnected
onReconnect(refreshAll)

onEvent((event) => {
  if (event.event === 'now_playing_changed') {
    mySongPlaying.value = false
    if (event.data.fallback_active && event.data.song?.is_fallback) {
      // Fallback song started — backend has no record of it, update directly
      queueStore.nowPlaying = event.data.song
      queueStore.fallbackActive = true
    } else if (event.data.fallback_active) {
      queueStore.nowPlaying = null
      queueStore.fallbackActive = true
      queueStore.fetchMySongs()
      queueStore.fetchRemainingSlots()
    } else {
      refreshAll()
    }
  }
  if (['song_added', 'song_removed'].includes(event.event)) {
    refreshAll()
  }
  if (event.event === 'queue_reordered') {
    queueStore.fetchQueue(venueSlug)
    queueStore.fetchMySongs()
  }
  if (event.event === 'your_song_playing') {
    mySongPlaying.value = true
    showToast(event.data.song?.title || 'Tu cancion esta sonando!')
    sendBrowserNotification(event.data.song?.title || 'Tu cancion esta sonando!')
  }
  if (event.event === 'song_error_notification') {
    // Clear preview if it was showing the errored song
    if (preview.value && preview.value.youtube_id === event.data.youtube_id) {
      preview.value = null
    }
    songError.value = {
      title: event.data.title || 'Tu cancion',
      youtube_id: event.data.youtube_id || '',
      message: event.data.message || 'Tu cancion no pudo ser reproducida',
    }
    // Immediately remove the errored song from local state so user doesn't see it
    const errorYtId = event.data.youtube_id
    if (errorYtId) {
      queueStore.mySongs = queueStore.mySongs.filter(s => s.youtube_id !== errorYtId)
      queueStore.queue = queueStore.queue.filter(s => s.youtube_id !== errorYtId)
    }
    // Then sync with server
    queueStore.fetchMySongs()
    queueStore.fetchRemainingSlots()
    queueStore.fetchQueue(venueSlug)
  }
  if (event.event === 'fallback_status_changed') {
    if (event.data.paused) {
      queueStore.nowPlaying = null
      queueStore.fallbackActive = false
    }
    // when resumed, next fallback-playing event will restore nowPlaying
  }
  if (event.event === 'rate_limit_reset') {
    queueStore.fetchRemainingSlots()
  }
  if (event.event === 'session_kicked') {
    trackSessionKicked(venueSlug)
    auth.logout()
    router.push({ name: 'registro', params: { venueSlug } })
  }
})

// Full sync: verify session + refresh queue, songs, rate limits
const API = import.meta.env.VITE_API_URL || ''
async function syncAll() {
  try {
    // Check session is still valid
    const res = await fetch(`${API}/api/auth/session`, {
      headers: auth.authHeaders(),
    })
    if (res.status === 401 || res.status === 404) {
      trackSessionExpired(venueSlug, res.status === 401 ? 'expired' : 'not_found')
      auth.logout()
      router.push({ name: 'registro', params: { venueSlug } })
      return
    }
    if (res.ok) {
      const data = await res.json()
      if (!data.session) {
        auth.logout()
        router.push({ name: 'registro', params: { venueSlug } })
        return
      }
    }
  } catch { /* network error, skip */ }

  // Refresh data in case WS events were missed
  queueStore.fetchQueue(venueSlug)
  queueStore.fetchMySongs()
  queueStore.fetchRemainingSlots()
}

let syncPoll = null

onMounted(async () => {
  document.title = `${auth.session?.venue_name || venueSlug} - Repitela`
  applyVenueTheme(auth.session?.config)
  setAnalyticsContext(venueSlug)
  await Promise.all([
    queueStore.fetchQueue(venueSlug),
    queueStore.fetchMySongs(),
    queueStore.fetchRemainingSlots(),
  ])
  // Safety net sync every 30s — catches any missed WS events
  syncPoll = setInterval(syncAll, 30000)
})

onUnmounted(() => { if (syncPoll) clearInterval(syncPoll) })

function showToast(msg) {
  toast.value = msg
  if (toastTimeout.value) clearTimeout(toastTimeout.value)
  toastTimeout.value = setTimeout(() => { toast.value = '' }, 4000)
}

function sendBrowserNotification(title) {
  if (notificationPermission.value === 'granted') {
    new Notification('Repitela', { body: title })
  }
}

async function requestNotifications() {
  if (supportsNotifications) {
    const perm = await Notification.requestPermission()
    notificationPermission.value = perm
  }
}

function handleLogout() {
  auth.logout()
  router.push({ name: 'registro', params: { venueSlug } })
}

function dismissError() {
  songError.value = null
  // Preview stays null, search query stays — user can immediately pick another song
}

function onPreview(data) { preview.value = data }
function onCancelPreview() { preview.value = null }

async function onConfirm(youtubeId) {
  confirmLoading.value = true
  try {
    const result = await queueStore.confirmSong(youtubeId)
    trackSongConfirmed(youtubeId, result.title, result.position)
    preview.value = null
    showToast(`Cancion agregada! Posicion #${result.position}`)
    await queueStore.fetchMySongs()
    await queueStore.fetchRemainingSlots()
    if (notificationPermission.value === 'default') requestNotifications()
  } catch (e) {
    showToast(e.message)
  } finally { confirmLoading.value = false }
}

async function cancelSong(songId) {
  cancelLoading.value = { ...cancelLoading.value, [songId]: true }
  try {
    await queueStore.cancelMySong(songId)
    trackSongCancelled(songId)
    showToast('Cancion removida de la cola')
    await queueStore.fetchMySongs()
    await queueStore.fetchQueue(venueSlug)
  } catch (e) {
    showToast(e.message)
  } finally { cancelLoading.value = { ...cancelLoading.value, [songId]: false } }
}
</script>

<template>
  <div class="dashboard">
    <!-- Toast -->
    <Transition name="fade">
      <div v-if="toast" class="toast">{{ toast }}</div>
    </Transition>

    <!-- Song Error Modal -->
    <Transition name="fade">
      <div v-if="songError" class="error-overlay" @click.self="dismissError">
        <div class="error-modal">
          <div class="error-icon">&#9888;</div>
          <p class="error-title">No se pudo reproducir</p>
          <p class="error-song-name">{{ songError.title }}</p>
          <p class="error-msg">Este video tiene restricciones de derechos de autor y no puede reproducirse en este momento.</p>
          <p class="error-hint">Busca otra version o una cancion diferente. Tu turno fue liberado.</p>
          <button class="error-btn" @click="dismissError">Buscar otra cancion</button>
        </div>
      </div>
    </Transition>

    <!-- Header -->
    <header class="dash-header">
      <div class="header-left">
        <span class="venue-name">{{ auth.session?.venue_name || venueSlug.replace(/-/g, ' ') }}</span>
      </div>
      <div class="header-right">
        <button class="theme-toggle" @click="toggleMode">{{ currentMode === 'dark' ? '&#9728;' : '&#9790;' }}</button>
        <button class="logout-btn" @click="handleLogout">Salir</button>
      </div>
    </header>
    <div class="container">

      <!-- Greeting -->
      <div class="user-greeting">
        <p class="greeting-name">Hola, <strong>{{ auth.user?.display_name?.split(' ')[0] || auth.user?.phone }}</strong> 👋</p>
        <p class="greeting-sub">¿Qué quieres escuchar hoy?</p>
      </div>

      <!-- 1. NOW PLAYING BANNER -->
      <div class="np-banner" :class="{ 'np-mine': isMyNowPlaying }" v-if="queueStore.nowPlaying">
        <img :src="`https://i.ytimg.com/vi/${queueStore.nowPlaying.youtube_id}/mqdefault.jpg`" class="np-thumb" />
        <div class="np-info">
          <div class="np-label-row">
            <span class="np-dot"></span>
            <p class="np-label" v-if="isMyNowPlaying">TU CANCION SUENA</p>
            <p class="np-label" v-else>SONANDO AHORA</p>
          </div>
          <p class="np-title">{{ queueStore.nowPlaying.title }}</p>
          <p class="np-meta">por {{ queueStore.nowPlaying.added_by }}</p>
        </div>
      </div>
      <div v-else class="np-banner np-empty">
        <span class="np-empty-icon">&#127925;</span>
        <p class="np-empty-text">Nada sonando aun — sé el primero!</p>
      </div>

      <!-- 2. SUBMIT SONG -->
      <SongPreview
        v-if="preview"
        :preview="preview"
        :loading="confirmLoading"
        @confirm="onConfirm"
        @cancel="onCancelPreview"
      />
      <SongSubmit
        v-else
        :rate-limit="queueStore.rateLimit"
        @preview="onPreview"
      />

      <!-- 3. MY SONGS -->
      <div class="card section" v-if="queueStore.mySongs.length">
        <p class="section-title">&#127911; Tus canciones</p>
        <div v-for="song in queueStore.mySongs" :key="song.id" class="my-item">
          <img :src="`https://i.ytimg.com/vi/${song.youtube_id}/mqdefault.jpg`" class="my-thumb" />
          <div class="my-info">
            <p class="my-title">{{ song.title }}</p>
            <div class="my-status">
              <template v-if="song.status === 'playing'">
                <span class="status-pill playing">&#9654; Sonando</span>
              </template>
              <template v-else>
                <span class="status-pill pending">#{{ song.position }} en cola</span>
              </template>
            </div>
          </div>
          <button
            v-if="song.status === 'pending'"
            class="cancel-btn"
            @click="cancelSong(song.id)"
            :disabled="cancelLoading[song.id]"
            title="Quitar de la cola"
          >{{ cancelLoading[song.id] ? '...' : '&#10005;' }}</button>
        </div>
      </div>

      <!-- 4. NEXT UP -->
      <div class="card section" v-if="nextFive.length">
        <p class="section-title">&#9654; Siguiente · {{ queueStore.totalInQueue }} en cola</p>
        <div v-for="(song, i) in nextFive" :key="song.id" class="q-item">
          <span class="q-pos">{{ i + 1 }}</span>
          <img :src="song.thumbnail_url || `https://i.ytimg.com/vi/${song.youtube_id}/mqdefault.jpg`" class="q-thumb" />
          <div class="q-info">
            <p class="q-title">{{ song.title }}</p>
            <p class="q-meta">{{ song.added_by }}</p>
          </div>
        </div>
        <p v-if="queueStore.totalInQueue > 5" class="more-text">+ {{ queueStore.totalInQueue - 5 }} mas en la cola</p>
      </div>


    </div>
  </div>
</template>

<style scoped>
/* ── Layout ── */
.dashboard {
  padding-bottom: max(40px, env(safe-area-inset-bottom));
  min-height: 100vh; min-height: 100dvh;
  background: var(--bg);
}

/* ── Header ── */
.dash-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: max(14px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) 14px max(16px, env(safe-area-inset-left));
  background: var(--bg-card);
  border-bottom: 1px solid var(--border-soft);
  position: -webkit-sticky; position: sticky; top: 0; z-index: 10;
}
.header-left { display: flex; align-items: center; min-width: 0; flex-shrink: 1; }
.venue-name { font-weight: 800; font-size: 17px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.header-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.logout-btn {
  padding: 6px 14px; border-radius: 20px;
  background: transparent; border: 1px solid var(--border);
  color: var(--text-muted); font-size: 12px; font-weight: 600;
  cursor: pointer; transition: all 0.15s;
}
.logout-btn:hover { border-color: var(--danger); color: var(--danger); }

/* ── Greeting ── */
.user-greeting { padding-top: 18px; padding-bottom: 4px; }
.greeting-name { font-size: 22px; font-weight: 800; color: var(--text); line-height: 1.2; }
.greeting-name strong { color: var(--primary); }
.greeting-sub { font-size: 13px; color: var(--text-muted); margin-top: 4px; }

/* ── Now Playing Banner ── */
.np-banner {
  margin-top: 16px;
  background: var(--bg-card);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius);
  display: flex; align-items: center; gap: 14px;
  overflow: hidden; position: relative;
  box-shadow: 0 2px 8px var(--shadow);
  padding: .8rem;
}
.np-mine {
  border-color: var(--success);
  background: linear-gradient(135deg, color-mix(in srgb, var(--success) 8%, var(--bg-card)), var(--bg-card));
}
.np-thumb {
  width: 90px; height: 68px;
  object-fit: cover; flex-shrink: 0;
  border-radius: 0;
}
.np-info { flex: 1; min-width: 0; padding: 12px 14px 12px 0; }
.np-label-row { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
.np-dot {
  width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0;
  background: var(--primary); animation: pulse 2s infinite;
}
.np-mine .np-dot { background: var(--success); }
.np-label {
  font-size: 10px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.8px;
  color: var(--text-muted);
}
.np-mine .np-label { color: var(--success); }
.np-title {
  font-size: 14px; font-weight: 700; line-height: 1.3;
  display: -webkit-box; -webkit-line-clamp: 2;
  -webkit-box-orient: vertical; overflow: hidden;
}
.np-meta { font-size: 11px; color: var(--text-muted); margin-top: 4px; }
@keyframes pulse {
  0%, 100% { opacity: 1; box-shadow: 0 0 0 0 var(--primary-soft); }
  50% { opacity: 0.6; box-shadow: 0 0 0 5px rgba(0,0,0,0); }
}
.np-empty {
  flex-direction: column; justify-content: center; align-items: center;
  padding: 28px; gap: 8px; border-style: dashed;
}
.np-empty-icon { font-size: 28px; opacity: 0.4; }
.np-empty-text { color: var(--text-muted); font-size: 14px; text-align: center; }

/* ── Sections ── */
.section { margin-top: 14px; }
.section.card { border: 1px solid var(--border-soft); background: var(--bg-card); }
.section-title {
  font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.6px; color: var(--text-muted); margin-bottom: 12px;
}

/* ── My Songs ── */
.my-item {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 0;
}
.my-item + .my-item { border-top: 1px solid var(--border-soft); }
.my-thumb {
  width: 52px; height: 39px; border-radius: 6px;
  object-fit: cover; flex-shrink: 0;
}
.my-info { flex: 1; min-width: 0; }
.my-title {
  font-size: 13px; font-weight: 600; line-height: 1.3;
  display: -webkit-box; -webkit-line-clamp: 2;
  -webkit-box-orient: vertical; overflow: hidden;
}
.my-status { margin-top: 5px; }
.status-pill {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 11px; font-weight: 600;
  padding: 2px 8px; border-radius: 10px;
}
.status-pill.playing { background: var(--success-soft); color: var(--success); }
.status-pill.pending { background: var(--warning-soft); color: var(--warning); }
.cancel-btn {
  width: 36px; height: 36px; border-radius: 50%;
  background: var(--danger-soft); border: none;
  color: var(--danger); font-size: 13px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s;
}
.cancel-btn:hover { background: var(--danger); color: white; }

/* ── Queue items ── */
.q-item {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 0;
}
.q-item + .q-item { border-top: 1px solid var(--border-soft); }
.q-pos {
  width: 22px; height: 22px; border-radius: 50%;
  background: var(--bg-elevated);
  font-size: 11px; font-weight: 700; color: var(--text-muted);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.q-thumb {
  width: 48px; height: 36px; border-radius: 6px;
  object-fit: cover; flex-shrink: 0;
}
.q-info { flex: 1; min-width: 0; }
.q-title {
  font-size: 13px; font-weight: 500;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.q-meta { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
.more-text {
  font-size: 12px; color: var(--text-muted);
  text-align: center; padding: 10px 0 2px; opacity: 0.6;
}

/* ── Error Modal ── */
.error-overlay {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
  -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px);
}
.error-modal {
  background: var(--bg-card); border-radius: 16px;
  padding: 28px 24px; max-width: 340px; width: 100%;
  text-align: center; box-shadow: 0 8px 32px rgba(0,0,0,0.3);
}
.error-icon { font-size: 40px; margin-bottom: 8px; color: var(--warning); }
.error-title { font-size: 17px; font-weight: 700; margin-bottom: 6px; }
.error-song-name {
  font-size: 14px; font-weight: 600; color: var(--text-muted); margin-bottom: 14px;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.error-msg { font-size: 13px; color: var(--text-muted); line-height: 1.5; margin-bottom: 6px; }
.error-hint { font-size: 13px; color: var(--success); font-weight: 600; margin-bottom: 20px; }
.error-btn {
  width: 100%; padding: 13px; border: none; border-radius: 10px;
  background: var(--primary); color: white;
  font-size: 15px; font-weight: 700; cursor: pointer; transition: opacity 0.15s;
}
.error-btn:active { opacity: 0.8; }
</style>
