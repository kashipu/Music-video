<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import { useQueueStore } from '../stores/queue.js'
import { useWebSocket } from '../composables/useWebSocket.js'
import { formatDuration } from '../utils/youtube.js'
import { useTheme } from '../composables/useTheme.js'
import SongSubmit from '../components/SongSubmit.vue'
import SongPreview from '../components/SongPreview.vue'

const route = useRoute()
const router = useRouter()
const { currentMode, toggleMode, applyVenueTheme } = useTheme()
const auth = useAuthStore()
const queueStore = useQueueStore()

const venueSlug = route.params.venueSlug
const preview = ref(null)
const toast = ref('')
const toastTimeout = ref(null)
const mySongPlaying = ref(false)
const supportsNotifications = 'Notification' in window && typeof Notification.requestPermission === 'function'
const notificationPermission = ref(supportsNotifications ? Notification.permission : 'denied')

const isMyNowPlaying = computed(() => {
  if (!queueStore.nowPlaying) return false
  return queueStore.mySongs.some(s => s.id === queueStore.nowPlaying.id) || mySongPlaying.value
})

const nextThree = computed(() => queueStore.queue.slice(0, 3))

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
  if (['song_added', 'song_removed', 'now_playing_changed', 'queue_reordered', 'song_skipped'].includes(event.event)) {
    refreshAll()
  }
  if (event.event === 'your_song_playing') {
    mySongPlaying.value = true
    showToast(event.data.song?.title || 'Tu cancion esta sonando!')
    sendBrowserNotification(event.data.song?.title || 'Tu cancion esta sonando!')
  }
  if (event.event === 'now_playing_changed') {
    mySongPlaying.value = false
  }
  if (event.event === 'session_kicked') {
    auth.logout()
    router.push({ name: 'registro', params: { venueSlug } })
  }
})

onMounted(async () => {
  applyVenueTheme(auth.session?.config)
  await Promise.all([
    queueStore.fetchQueue(venueSlug),
    queueStore.fetchMySongs(),
    queueStore.fetchRemainingSlots(),
  ])
})

function showToast(msg) {
  toast.value = msg
  if (toastTimeout.value) clearTimeout(toastTimeout.value)
  toastTimeout.value = setTimeout(() => { toast.value = '' }, 4000)
}

function sendBrowserNotification(title) {
  if (notificationPermission.value === 'granted') {
    new Notification('BarQueue', { body: title, icon: '/vite.svg' })
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

function onPreview(data) { preview.value = data }
function onCancelPreview() { preview.value = null }

async function onConfirm(youtubeId) {
  try {
    const result = await queueStore.confirmSong(youtubeId)
    preview.value = null
    showToast(`Cancion agregada! Posicion #${result.position}`)
    await queueStore.fetchMySongs()
    await queueStore.fetchRemainingSlots()
    if (notificationPermission.value === 'default') requestNotifications()
  } catch (e) {
    showToast(e.message)
  }
}

async function cancelSong(songId) {
  try {
    await queueStore.cancelMySong(songId)
    showToast('Cancion removida de la cola')
    await queueStore.fetchMySongs()
    await queueStore.fetchQueue(venueSlug)
  } catch (e) {
    showToast(e.message)
  }
}
</script>

<template>
  <div class="dashboard">
    <!-- Toast -->
    <Transition name="fade">
      <div v-if="toast" class="toast">{{ toast }}</div>
    </Transition>

    <!-- Header -->
    <header class="dash-header">
      <div class="header-left">
        <span class="venue-name">{{ auth.session?.venue_name || venueSlug.replace(/-/g, ' ') }}</span>
        <span class="table-badge">Mesa {{ auth.session?.table_number }}</span>
      </div>
      <div class="header-right">
        <button class="theme-toggle" @click="toggleMode">{{ currentMode === 'dark' ? '&#9728;' : '&#9790;' }}</button>
        <span class="user-name">{{ auth.user?.display_name || auth.user?.phone }}</span>
        <button class="logout-btn" @click="handleLogout">Salir</button>
      </div>
    </header>

    <div class="container">

      <!-- 1. NOW PLAYING BANNER -->
      <div class="np-banner" :class="{ 'np-mine': isMyNowPlaying }" v-if="queueStore.nowPlaying">
        <img :src="`https://i.ytimg.com/vi/${queueStore.nowPlaying.youtube_id}/mqdefault.jpg`" class="np-thumb" />
        <div class="np-info">
          <p class="np-label" v-if="isMyNowPlaying">TU CANCION ESTA SONANDO</p>
          <p class="np-label" v-else>SONANDO AHORA</p>
          <p class="np-title">{{ queueStore.nowPlaying.title }}</p>
          <p class="np-meta">
            {{ queueStore.nowPlaying.added_by }} &middot; Mesa {{ queueStore.nowPlaying.table_number }}
          </p>
        </div>
        <div v-if="isMyNowPlaying" class="np-pulse"></div>
      </div>
      <div v-else class="np-banner np-empty">
        <p class="np-empty-text">No hay nada sonando. Pide una cancion!</p>
      </div>

      <!-- 2. SUBMIT SONG -->
      <SongPreview
        v-if="preview"
        :preview="preview"
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
        <p class="section-title">TUS CANCIONES</p>
        <div v-for="song in queueStore.mySongs" :key="song.id" class="my-item">
          <img :src="`https://i.ytimg.com/vi/${song.youtube_id}/mqdefault.jpg`" class="q-thumb" />
          <div class="my-info">
            <p class="my-title">{{ song.title }}</p>
            <p class="my-status" :class="song.status">
              <template v-if="song.status === 'playing'">
                <span class="status-dot playing"></span> Sonando ahora
              </template>
              <template v-else>
                <span class="status-dot pending"></span> Posicion #{{ song.position }}
              </template>
            </p>
          </div>
          <button
            v-if="song.status === 'pending'"
            class="cancel-btn"
            @click="cancelSong(song.id)"
            title="Quitar de la cola"
          >&#10005;</button>
        </div>
      </div>

      <!-- 4. NEXT UP (only 3) -->
      <div class="card section" v-if="nextThree.length">
        <p class="section-title">SIGUIENTE ({{ queueStore.totalInQueue }} en cola)</p>
        <div v-for="(song, i) in nextThree" :key="song.id" class="q-item">
          <span class="q-pos">{{ i + 1 }}</span>
          <img :src="song.thumbnail_url || `https://i.ytimg.com/vi/${song.youtube_id}/mqdefault.jpg`" class="q-thumb" />
          <div class="q-info">
            <p class="q-title">{{ song.title }}</p>
            <p class="q-meta">{{ song.added_by }} &middot; Mesa {{ song.table_number }}</p>
          </div>
        </div>
        <p v-if="queueStore.totalInQueue > 3" class="more-text">y {{ queueStore.totalInQueue - 3 }} mas...</p>
      </div>


    </div>
  </div>
</template>

<style scoped>
.dashboard {
  padding-bottom: 40px;
  padding-bottom: max(40px, env(safe-area-inset-bottom));
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--bg);
}

/* Header */
.dash-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 14px 16px;
  padding-top: max(14px, env(safe-area-inset-top));
  padding-left: max(16px, env(safe-area-inset-left));
  padding-right: max(16px, env(safe-area-inset-right));
  background: linear-gradient(180deg, var(--bg-card) 0%, var(--bg) 100%);
  position: sticky; top: 0; z-index: 10;
}
.header-left { display: flex; align-items: center; min-width: 0; flex-shrink: 1; }
.venue-name { font-weight: 700; font-size: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.table-badge {
  background: var(--primary); color: white;
  font-size: 10px; font-weight: 700;
  padding: 3px 10px; border-radius: 12px; margin-left: 8px;
  white-space: nowrap; flex-shrink: 0;
}
.header-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.user-name { font-size: 13px; color: var(--text-muted); max-width: 80px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.logout-btn {
  padding: 5px 12px; border-radius: 8px;
  background: transparent; border: 1px solid var(--border);
  color: var(--text-muted); font-size: 12px; font-weight: 600;
  cursor: pointer; transition: all 0.15s;
}
.logout-btn:hover { border-color: var(--danger); color: var(--danger); }

/* Now Playing Banner */
.np-banner {
  margin-top: 12px; padding: 14px 16px;
  background: var(--bg-card);
  border-radius: var(--radius); display: flex;
  align-items: center; gap: 12px; position: relative;
}
.np-mine {
  background: linear-gradient(135deg, var(--success-soft), var(--bg-card));
  box-shadow: inset 0 0 0 1px var(--success-soft);
}
.np-thumb {
  width: 56px; height: 42px; border-radius: 8px;
  object-fit: cover; flex-shrink: 0;
}
.np-info { flex: 1; min-width: 0; }
.np-label {
  font-size: 10px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.5px;
  color: var(--text-muted); margin-bottom: 3px;
}
.np-mine .np-label { color: var(--success); }
.np-title {
  font-size: 14px; font-weight: 600; line-height: 1.3;
  display: -webkit-box; -webkit-line-clamp: 2;
  -webkit-box-orient: vertical; overflow: hidden;
}
.np-meta { font-size: 11px; color: var(--text-muted); margin-top: 3px; }
.np-pulse {
  position: absolute; top: 14px; right: 14px;
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--success);
  animation: pulse 2s infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; box-shadow: 0 0 0 0 var(--success-soft); }
  50% { opacity: 0.6; box-shadow: 0 0 0 6px rgba(85, 239, 196, 0); }
}
.np-empty { justify-content: center; padding: 20px; }
.np-empty-text { color: var(--text-muted); font-size: 14px; text-align: center; }

.section { margin-top: 14px; }

/* Cards - softer look */
.section.card {
  border: none;
  background: var(--bg-card);
}

/* Queue items */
.q-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 0;
}
.q-item + .q-item {
  border-top: 1px solid var(--border-soft);
}
.q-pos {
  font-weight: 700; font-size: 12px; color: var(--text-muted);
  width: 18px; text-align: center; flex-shrink: 0;
  opacity: 0.6;
}
.q-thumb {
  width: 44px; height: 33px; border-radius: 6px;
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
  text-align: center; padding: 10px 0 2px;
  opacity: 0.7;
}

/* My Songs */
.my-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 0;
}
.my-item + .my-item {
  border-top: 1px solid var(--border-soft);
}
.my-info { flex: 1; min-width: 0; }
.my-title {
  font-size: 13px; font-weight: 500;
  display: -webkit-box; -webkit-line-clamp: 2;
  -webkit-box-orient: vertical; overflow: hidden;
}
.my-status {
  font-size: 12px; color: var(--text-muted); margin-top: 3px;
  display: flex; align-items: center; gap: 6px;
}
.status-dot {
  width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
}
.status-dot.playing { background: var(--success); animation: pulse 2s infinite; }
.status-dot.pending { background: var(--warning); }
.cancel-btn {
  width: 44px; height: 44px; border-radius: 8px;
  background: var(--danger-soft);
  border: none;
  color: var(--danger); font-size: 14px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s; opacity: 0.6;
}
.cancel-btn:hover { background: var(--danger); color: white; opacity: 1; }
</style>
