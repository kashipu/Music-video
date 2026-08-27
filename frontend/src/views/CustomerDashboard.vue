<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import { useQueueStore } from '../stores/queue.js'
import { useWebSocket } from '../composables/useWebSocket.js'
import { useToast } from '../composables/useToast.js'
import NowPlaying from '../components/NowPlaying.vue'
import { useTheme } from '../composables/useTheme.js'
import SongSubmit from '../components/SongSubmit.vue'
import SongPreview from '../components/SongPreview.vue'
import CustomerHeader from '../components/CustomerHeader.vue'
import CustomerMySongs from '../components/CustomerMySongs.vue'
import CustomerQueuePreview from '../components/CustomerQueuePreview.vue'
import SongErrorModal from '../components/SongErrorModal.vue'
import { checkSession } from '../services/auth.js'
import { trackSongConfirmed, trackSongCancelled, trackSessionKicked, trackSessionExpired, setAnalyticsContext } from '../utils/analytics.js'

const t = useToast()

const route = useRoute()
const router = useRouter()
const { applyVenueTheme } = useTheme()
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
const { onEvent, onReconnect, connected: wsConnected } = useWebSocket(venueSlug, auth.user?.id, auth.token)

// Subtle WS state — only show banner when disconnected for >2s (avoids flicker on quick reconnects)
const wsOffline = ref(false)
let wsOfflineTimer = null
watch(wsConnected, (online) => {
  if (online) {
    if (wsOfflineTimer) { clearTimeout(wsOfflineTimer); wsOfflineTimer = null }
    if (wsOffline.value) {
      wsOffline.value = false
      t.success('Conexión restaurada', 2500)
    }
  } else {
    if (!wsOfflineTimer) {
      wsOfflineTimer = setTimeout(() => { wsOffline.value = true }, 2000)
    }
  }
})

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
    const title = event.data.song?.title || 'Tu canción está sonando'
    t.success(`🎵 ${title}`, 7000)
    sendBrowserNotification(title)
  }
  if (event.event === 'rate_limit_reset') {
    t.info('Slot liberado — puedes pedir otra canción', 4000)
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
async function syncAll() {
  try {
    // Check session is still valid
    const res = await checkSession(auth.token)
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
    if (result.position === 1) {
      t.success(`🎵 Tu canción es la siguiente!`)
    } else {
      t.success(`Canción agregada — posición #${result.position}`)
    }
    await queueStore.fetchMySongs()
    await queueStore.fetchRemainingSlots()
    if (notificationPermission.value === 'default') requestNotifications()
  } catch (e) {
    t.error(e.message || 'Error al confirmar canción')
  } finally { confirmLoading.value = false }
}

async function cancelSong(songId) {
  cancelLoading.value = { ...cancelLoading.value, [songId]: true }
  try {
    await queueStore.cancelMySong(songId)
    trackSongCancelled(songId)
    t.success('Canción removida de la cola')
    await queueStore.fetchMySongs()
    await queueStore.fetchQueue(venueSlug)
  } catch (e) {
    t.error(e.message || 'Error al cancelar canción')
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
    <SongErrorModal :error="songError" @dismiss="dismissError" />

    <!-- WS offline banner — only shows after 2s of disconnect -->
    <Transition name="fade">
      <div v-if="wsOffline" class="ws-offline-banner" role="status">
        <span class="ws-banner-dot"></span>
        Sin conexión — reintentando…
      </div>
    </Transition>

    <!-- Header -->
    <CustomerHeader
      :venue-name="auth.session?.venue_name || venueSlug.replace(/-/g, ' ')"
      @logout="handleLogout"
    />
    <div class="container">

      <!-- Greeting -->
      <div class="user-greeting">
        <p class="greeting-name">Hola, <strong>{{ auth.user?.display_name?.split(' ')[0] || auth.user?.phone }}</strong> 👋</p>
        <p class="greeting-sub">¿Qué quieres escuchar hoy?</p>
      </div>

      <!-- 1. NOW PLAYING BANNER -->
      <NowPlaying :song="queueStore.nowPlaying" :mine="isMyNowPlaying" />

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
      <CustomerMySongs
        :songs="queueStore.mySongs"
        :cancel-loading="cancelLoading"
        @cancel-song="cancelSong"
      />

      <!-- 4. NEXT UP -->
      <CustomerQueuePreview
        :queue="nextFive"
        :total-in-queue="queueStore.totalInQueue"
      />


    </div>
  </div>
</template>

<style scoped>
/* WS offline banner */
.ws-offline-banner {
  position: sticky; top: 0; z-index: 20;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 6px 12px;
  background: var(--danger-soft, rgba(239,68,68,0.15));
  color: var(--danger, #ef4444);
  font-size: 12px; font-weight: 600;
  border-bottom: 1px solid var(--danger, #ef4444);
}
.ws-banner-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--danger, #ef4444);
  animation: ws-pulse 1s infinite;
}
@keyframes ws-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }

/* ── Layout ── */
.dashboard {
  padding-bottom: max(40px, env(safe-area-inset-bottom));
  min-height: 100vh; min-height: 100dvh;
  background: var(--bg);
}

/* ── Greeting ── */
.user-greeting { padding-top: 18px; padding-bottom: 4px; }
.greeting-name { font-size: 22px; font-weight: 800; color: var(--text); line-height: 1.2; }
.greeting-name strong { color: var(--primary); }
.greeting-sub { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
</style>
