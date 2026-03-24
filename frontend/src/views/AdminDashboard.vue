<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import { useWebSocket } from '../composables/useWebSocket.js'
import { formatDuration } from '../utils/youtube.js'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const API = import.meta.env.VITE_API_URL || ''
const venueSlug = route.params.venueSlug || auth.adminInfo?.venue_slug || 'default'

// State
const nowPlaying = ref(null)
const queue = ref([])
const played = ref([])
const playbackStatus = ref('playing')
const volume = ref(80)
const muted = ref(false)
const volumeBeforeMute = ref(80)
const tables = ref([])
const analytics = ref(null)
const library = ref([])
const librarySearch = ref('')
const fallbackSongs = ref([])
const fallbackPaused = ref(false)
const rightTab = ref('music')
const selectedTable = ref(null)
const addUrl = ref('')
const loading = ref(false)
const showLibrary = ref(false)
const dragIdx = ref(null)
const dropIdx = ref(null)

// Computed
const totalDuration = computed(() => {
  const secs = queue.value.reduce((sum, s) => sum + (s.duration_sec || 0), 0)
  return `${Math.floor(secs / 60)} min`
})

const registroUrl = computed(() => {
  if (auth.adminInfo?.qr_url) return auth.adminInfo.qr_url
  return `${window.location.origin}/${venueSlug}/registro`
})
const qrCodeUrl = computed(() =>
  `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(registroUrl.value)}`
)

// WebSocket
const { onEvent } = useWebSocket(venueSlug)
onEvent((event) => {
  if (['song_added', 'now_playing_changed', 'song_removed', 'queue_reordered', 'song_skipped', 'table_registered'].includes(event.event)) {
    fetchQueue()
    fetchTables()
  } else if (event.event === 'playback_status_changed') {
    playbackStatus.value = event.data.status
  }
})

onMounted(async () => {
  await Promise.all([fetchQueue(), fetchTables(), fetchAnalytics(), fetchFallbackPlaylist()])
})

// ===== FETCH =====
async function fetchQueue() {
  const res = await fetch(`${API}/api/admin/queue`, { headers: auth.adminHeaders() })
  if (!res.ok) return
  const data = await res.json()
  nowPlaying.value = data.now_playing
  queue.value = data.queue
  playbackStatus.value = data.playback_status
  fetchPlayed()
}

async function fetchPlayed() {
  const res = await fetch(`${API}/api/admin/played`, { headers: auth.adminHeaders() })
  if (res.ok) { const data = await res.json(); played.value = data.songs }
}

async function fetchTables() {
  const res = await fetch(`${API}/api/admin/tables`, { headers: auth.adminHeaders() })
  if (res.ok) { const data = await res.json(); tables.value = data.tables }
}

async function fetchAnalytics() {
  const res = await fetch(`${API}/api/admin/analytics?period=week`, { headers: auth.adminHeaders() })
  if (res.ok) analytics.value = await res.json()
}

async function fetchFallbackPlaylist() {
  const res = await fetch(`${API}/api/admin/playlist`, { headers: auth.adminHeaders() })
  if (res.ok) { const data = await res.json(); fallbackSongs.value = data.songs }
}

async function fetchLibrary() {
  const q = librarySearch.value ? `&search=${encodeURIComponent(librarySearch.value)}` : ''
  const res = await fetch(`${API}/api/admin/library?${q}`, { headers: auth.adminHeaders() })
  if (res.ok) { const data = await res.json(); library.value = data.songs }
}

// ===== PLAYBACK =====
async function startPlayback() {
  await fetch(`${API}/api/admin/playback/start`, { method: 'POST', headers: auth.adminHeaders() })
  await fetchQueue()
}
async function skipSong() {
  await fetch(`${API}/api/admin/queue/skip`, { method: 'POST', headers: auth.adminHeaders() })
  await fetchQueue()
}
async function pausePlayback() {
  await fetch(`${API}/api/admin/playback/pause`, { method: 'POST', headers: auth.adminHeaders() })
  playbackStatus.value = 'paused'
}
async function resumePlayback() {
  await fetch(`${API}/api/admin/playback/resume`, { method: 'POST', headers: auth.adminHeaders() })
  playbackStatus.value = 'playing'
}

// ===== VOLUME =====
async function playFallbackNow() {
  fallbackPaused.value = false
  await fetch(`${API}/api/admin/fallback-status?paused=false`, {
    method: 'POST', headers: auth.adminHeaders(),
  })
  // Broadcast to kiosk to start fallback now
  await fetch(`${API}/api/admin/fallback-play`, {
    method: 'POST', headers: auth.adminHeaders(),
  })
}

async function toggleFallback() {
  fallbackPaused.value = !fallbackPaused.value
  await fetch(`${API}/api/admin/fallback-status?paused=${fallbackPaused.value}`, {
    method: 'POST', headers: auth.adminHeaders(),
  })
}

async function changeVolume() {
  muted.value = false
  await fetch(`${API}/api/admin/volume?volume=${volume.value}`, { method: 'POST', headers: auth.adminHeaders() })
}
async function toggleMute() {
  if (muted.value) { muted.value = false; volume.value = volumeBeforeMute.value }
  else { volumeBeforeMute.value = volume.value; muted.value = true; volume.value = 0 }
  await fetch(`${API}/api/admin/volume?volume=${volume.value}`, { method: 'POST', headers: auth.adminHeaders() })
}

// ===== QUEUE ACTIONS =====
async function playNow(songId) {
  await fetch(`${API}/api/admin/queue/songs/${songId}/play-now`, { method: 'POST', headers: auth.adminHeaders() })
  await fetchQueue()
}
async function removeSong(songId) {
  await fetch(`${API}/api/admin/queue/songs/${songId}`, { method: 'DELETE', headers: auth.adminHeaders() })
  await fetchQueue()
}
async function moveSong(songId, newPosition) {
  await fetch(`${API}/api/admin/queue/songs/${songId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...auth.adminHeaders() },
    body: JSON.stringify({ position: newPosition }),
  })
  await fetchQueue()
}
async function addSong() {
  if (!addUrl.value.trim()) return
  loading.value = true
  try {
    await fetch(`${API}/api/admin/queue/songs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth.adminHeaders() },
      body: JSON.stringify({ youtube_url: addUrl.value }),
    })
    addUrl.value = ''
  } finally { loading.value = false }
}
async function addFromLibrary(youtubeId) {
  loading.value = true
  try {
    await fetch(`${API}/api/admin/queue/songs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth.adminHeaders() },
      body: JSON.stringify({ youtube_url: `https://www.youtube.com/watch?v=${youtubeId}` }),
    })
  } finally { loading.value = false }
}
async function requeueSong(youtubeId) {
  await addFromLibrary(youtubeId)
}

// ===== DRAG & DROP =====
function onDragStart(idx, event) { dragIdx.value = idx; event.dataTransfer.effectAllowed = 'move' }
function onDragOver(idx) { if (dragIdx.value !== null && dragIdx.value !== idx) dropIdx.value = idx }
function onDragLeave() { dropIdx.value = null }
async function onDrop(idx) {
  if (dragIdx.value === null || dragIdx.value === idx) return
  const song = queue.value[dragIdx.value]
  const target = queue.value[idx]
  if (song && target) await moveSong(song.id, target.position)
  dragIdx.value = null; dropIdx.value = null
}
function onDragEnd() { dragIdx.value = null; dropIdx.value = null }

// ===== TABLES =====
async function kickTable(tableNumber) {
  await fetch(`${API}/api/admin/tables/${tableNumber}/kick`, { method: 'POST', headers: auth.adminHeaders() })
  await fetchTables()
}
async function resetTableLimit(tableNumber) {
  await fetch(`${API}/api/admin/tables/${tableNumber}/reset-limit`, { method: 'POST', headers: auth.adminHeaders() })
  await fetchTables()
}

function toggleLibrary() {
  showLibrary.value = !showLibrary.value
  if (showLibrary.value && !library.value.length) fetchLibrary()
}

function downloadQR() {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    const padding = 40
    const textHeight = 80
    canvas.width = img.width + padding * 2
    canvas.height = img.height + padding * 2 + textHeight
    // White background
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    // QR image
    ctx.drawImage(img, padding, padding)
    // Bar name
    ctx.fillStyle = '#000000'
    ctx.font = 'bold 24px Inter, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(auth.adminInfo?.venue_name || venueSlug, canvas.width / 2, img.height + padding + 35)
    // URL small
    ctx.font = '14px Inter, sans-serif'
    ctx.fillStyle = '#666666'
    ctx.fillText(registroUrl.value, canvas.width / 2, img.height + padding + 60)
    // Download
    const link = document.createElement('a')
    link.download = `qr-${venueSlug}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }
  img.src = qrCodeUrl.value
}

function printQR() {
  const printWin = window.open('', '_blank', 'width=500,height=600')
  printWin.document.write(`
    <html><head><title>QR - ${auth.adminInfo?.venue_name || venueSlug}</title>
    <style>
      body { margin: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; font-family: sans-serif; }
      img { width: 300px; height: 300px; }
      h1 { margin-top: 20px; font-size: 28px; }
      p { color: #666; font-size: 14px; margin-top: 8px; }
    </style></head><body>
      <img src="${qrCodeUrl.value}" />
      <h1>${auth.adminInfo?.venue_name || venueSlug}</h1>
      <p>${registroUrl.value}</p>
      <script>window.onload = () => { window.print(); window.close(); }<\/script>
    </body></html>
  `)
  printWin.document.close()
}

function logout() {
  auth.adminLogout()
  router.push({ name: 'admin-login', params: { venueSlug } })
}
</script>

<template>
  <div class="admin">
    <!-- HEADER -->
    <header class="admin-header">
      <div class="header-brand">
        <img v-if="auth.adminInfo?.logo_url" :src="auth.adminInfo.logo_url" class="header-logo" />
        <h1>{{ auth.adminInfo?.venue_name || venueSlug }}</h1>
      </div>
      <button class="btn-logout" @click="logout">Salir</button>
    </header>

    <!-- TWO COLUMN LAYOUT -->
    <div class="admin-layout">

      <!-- ===== LEFT: BAR INFO ===== -->
      <aside class="sidebar">

        <!-- Bar Info Card -->
        <div class="card sidebar-info">
          <img v-if="auth.adminInfo?.logo_url" :src="auth.adminInfo.logo_url" class="sidebar-logo" />
          <h2 class="bar-name">{{ auth.adminInfo?.venue_name }}</h2>
          <div class="info-stats">
            <div class="info-stat">
              <span class="info-val">{{ tables.length }}</span>
              <span class="info-label">Mesas activas</span>
            </div>
            <div class="info-stat">
              <span class="info-val">{{ queue.length }}</span>
              <span class="info-label">En cola</span>
            </div>
          </div>
        </div>

        <!-- Quick Actions -->
        <div class="card">
          <p class="section-title">ABRIR VISTAS</p>
          <div class="quick-actions">
            <a :href="`/${venueSlug}/registro`" target="_blank" class="action-btn action-registro">
              <span>&#128221;</span> Registro (QR)
            </a>
            <a :href="`/${venueSlug}/video`" target="_blank" class="action-btn action-video">
              <span>&#127909;</span> Pantalla Video
            </a>
            <a :href="`/${venueSlug}/usuario`" target="_blank" class="action-btn action-usuario">
              <span>&#128241;</span> Vista Usuario
            </a>
          </div>
        </div>

        <!-- QR Code -->
        <div class="card qr-card">
          <p class="section-title">QR DEL BAR</p>
          <div class="qr-wrapper" id="qr-print-area">
            <img :src="qrCodeUrl" :alt="`QR ${venueSlug}`" class="qr-img" crossorigin="anonymous" />
            <p class="qr-bar-name">{{ auth.adminInfo?.venue_name }}</p>
            <p class="qr-url">{{ registroUrl }}</p>
          </div>
          <div class="qr-btns">
            <button class="qr-btn" @click="downloadQR">Descargar</button>
            <button class="qr-btn" @click="printQR">Imprimir</button>
          </div>
        </div>

        <!-- Tables -->
        <div class="card">
          <p class="section-title">MESAS ({{ tables.length }})</p>
          <div v-if="tables.length" class="tables-list">
            <div v-for="table in tables" :key="table.table_number" class="table-item">
              <div class="table-top">
                <span class="table-num">Mesa {{ table.table_number }}</span>
                <span class="table-user">{{ table.user_name }}</span>
              </div>
              <div class="table-songs-mini">
                <span v-for="(s, i) in table.songs.slice(0, 3)" :key="i" class="song-pill" :class="s.status">
                  {{ s.title.substring(0, 20) }}{{ s.title.length > 20 ? '...' : '' }}
                </span>
              </div>
              <div class="table-btns">
                <button class="t-btn t-btn-reset" @click="resetTableLimit(table.table_number)">Resetear</button>
                <button class="t-btn t-btn-kick" @click="kickTable(table.table_number)">Expulsar</button>
              </div>
            </div>
          </div>
          <p v-else class="text-muted">Sin mesas activas</p>
        </div>

        <!-- Analytics Summary -->
        <div class="card" v-if="analytics">
          <p class="section-title">RESUMEN SEMANAL</p>
          <div class="analytics-mini">
            <div class="am"><strong>{{ analytics.summary.total_songs_played }}</strong> canciones</div>
            <div class="am"><strong>{{ analytics.summary.unique_users }}</strong> usuarios</div>
          </div>
          <div v-if="analytics.top_songs.length" class="top-mini">
            <p class="mini-label">Top canciones:</p>
            <div v-for="s in analytics.top_songs.slice(0, 3)" :key="s.youtube_id" class="top-mini-item">
              <span class="top-mini-title">{{ s.title }}</span>
              <span class="top-mini-count">{{ s.times_played }}x</span>
            </div>
          </div>
        </div>
      </aside>

      <!-- ===== RIGHT COLUMN ===== -->
      <main class="music-col">

        <!-- Right Tabs -->
        <div class="right-tabs">
          <button class="rt" :class="{ active: rightTab === 'music' }" @click="rightTab = 'music'">Musica</button>
          <button class="rt" :class="{ active: rightTab === 'tables' }" @click="rightTab = 'tables'; fetchTables()">Mesas</button>
          <button class="rt" :class="{ active: rightTab === 'analytics' }" @click="rightTab = 'analytics'; fetchAnalytics()">Analytics</button>
        </div>

        <!-- ========== MUSIC TAB ========== -->
        <template v-if="rightTab === 'music'">

        <!-- Stats Bar -->
        <div class="stats-bar">
          <div class="stat-pill"><span>&#9835;</span> <strong>{{ queue.length }}</strong> en cola</div>
          <div class="stat-pill"><span>&#9201;</span> {{ totalDuration }}</div>
          <div class="stat-pill" :class="playbackStatus === 'playing' ? 'stat-live' : 'stat-paused'">
            {{ playbackStatus === 'playing' ? 'EN VIVO' : 'PAUSADO' }}
          </div>
          <div v-if="!nowPlaying && queue.length === 0 && fallbackSongs.length && !fallbackPaused" class="stat-pill stat-fallback">
            PLAYLIST SONANDO
          </div>
        </div>

        <!-- Now Playing -->
        <div class="card np-card" v-if="nowPlaying">
          <div class="np-left">
            <img :src="`https://i.ytimg.com/vi/${nowPlaying.youtube_id}/mqdefault.jpg`" class="np-thumb" />
            <div class="np-info">
              <p class="section-title">SONANDO AHORA</p>
              <p class="np-title">{{ nowPlaying.title }}</p>
              <p class="np-meta">{{ nowPlaying.user_name }} &middot; Mesa {{ nowPlaying.table_number }}</p>
            </div>
          </div>
          <div class="np-controls">
            <button v-if="playbackStatus === 'playing'" class="ctrl-labeled ctrl-pause" @click="pausePlayback">
              <span class="ctrl-icon">&#10074;&#10074;</span><span class="ctrl-text">Pausar</span>
            </button>
            <button v-else class="ctrl-labeled ctrl-play" @click="resumePlayback">
              <span class="ctrl-icon">&#9654;</span><span class="ctrl-text">Reanudar</span>
            </button>
            <button class="ctrl-labeled ctrl-skip" @click="skipSong">
              <span class="ctrl-icon">&#9197;</span><span class="ctrl-text">Siguiente</span>
            </button>
          </div>
        </div>
        <div v-else class="card np-empty">
          <p class="np-empty-text" v-if="!queue.length">Sin reproduccion &mdash; agrega una cancion</p>
          <div v-else class="np-start">
            <p class="np-empty-text">{{ queue.length }} canciones en cola</p>
            <button class="ctrl-btn-lg ctrl-play" @click="startPlayback">&#9654; REPRODUCIR</button>
          </div>
        </div>

        <!-- Volume -->
        <div class="card volume-card">
          <div class="volume-row">
            <button class="mute-btn" :class="{ muted: muted }" @click="toggleMute">
              <span class="mute-icon" v-if="muted">&#128263;</span>
              <span class="mute-icon" v-else-if="volume < 50">&#128265;</span>
              <span class="mute-icon" v-else>&#128266;</span>
              <span class="mute-text">{{ muted ? 'Unmute' : 'Mute' }}</span>
            </button>
            <input type="range" min="0" max="100" v-model.number="volume" class="volume-slider" :disabled="muted" @input="changeVolume" />
            <span class="volume-value" :class="{ muted: muted }">{{ muted ? 'MUTE' : volume + '%' }}</span>
          </div>
        </div>

        <!-- Add Song -->
        <div class="card add-card">
          <div class="add-header">
            <p class="section-title">AGREGAR CANCION</p>
            <button class="lib-toggle" @click="toggleLibrary">{{ showLibrary ? 'Pegar URL' : 'Biblioteca' }}</button>
          </div>
          <form v-if="!showLibrary" class="add-row" @submit.prevent="addSong">
            <input v-model="addUrl" class="input-field" placeholder="Pegar URL de YouTube..." />
            <button type="submit" class="ctrl-add" :disabled="loading">+</button>
          </form>
          <div v-else class="library">
            <input v-model="librarySearch" class="input-field" placeholder="Buscar cancion..." @input="fetchLibrary" />
            <div class="library-list">
              <div v-for="song in library" :key="song.youtube_id" class="lib-item">
                <img :src="song.thumbnail_url" class="lib-thumb" />
                <div class="lib-info">
                  <p class="lib-title">{{ song.title }}</p>
                  <p class="lib-artist">{{ song.artist }} &middot; {{ formatDuration(song.duration_sec) }}</p>
                </div>
                <button class="ctrl-add-sm" @click="addFromLibrary(song.youtube_id)" :disabled="loading">+</button>
              </div>
              <p v-if="!library.length" class="text-muted">Sin canciones guardadas</p>
            </div>
          </div>
        </div>

        <!-- Queue -->
        <div class="card">
          <p class="section-title">COLA ({{ queue.length }})</p>
          <div class="q-list">
            <div v-for="(song, idx) in queue" :key="song.id" class="q-item"
              :class="{ 'q-dragging': dragIdx === idx, 'q-drop-above': dropIdx === idx && dropIdx < dragIdx, 'q-drop-below': dropIdx === idx && dropIdx > dragIdx }"
              draggable="true" @dragstart="onDragStart(idx, $event)" @dragover.prevent="onDragOver(idx)"
              @dragleave="onDragLeave" @drop.prevent="onDrop(idx)" @dragend="onDragEnd">
              <div class="q-handle">&#9776;</div>
              <span class="q-pos">{{ idx + 1 }}</span>
              <img :src="`https://i.ytimg.com/vi/${song.youtube_id}/mqdefault.jpg`" class="q-thumb" />
              <div class="q-info">
                <p class="q-title">{{ song.title }}</p>
                <p class="q-meta">{{ song.user_name }} &middot; Mesa {{ song.table_number }} &middot; {{ formatDuration(song.duration_sec) }}</p>
              </div>
              <button class="q-btn-label q-btn-play" @click="playNow(song.id)">&#9654; Play</button>
              <button class="q-btn-label q-btn-remove" @click="removeSong(song.id)">&#10005; Quitar</button>
            </div>
          </div>
          <p v-if="!queue.length" class="text-muted">Cola vacia</p>
        </div>

        <!-- Played -->
        <div class="card">
          <p class="section-title">YA SONARON ({{ played.length }})</p>
          <div class="q-list" v-if="played.length">
            <div v-for="song in played" :key="song.id" class="q-item q-item-played">
              <img :src="`https://i.ytimg.com/vi/${song.youtube_id}/mqdefault.jpg`" class="q-thumb" />
              <div class="q-info">
                <p class="q-title">{{ song.title }}</p>
                <p class="q-meta">{{ song.user_name }} &middot; {{ song.played_at_label }}</p>
              </div>
              <button class="q-btn-label q-btn-requeue" @click="requeueSong(song.youtube_id)">&#8634; Encolar</button>
            </div>
          </div>
          <p v-else class="text-muted">Sin historial de hoy</p>
        </div>

        <!-- Fallback Playlist -->
        <div class="card">
          <div class="fb-header">
            <p class="section-title">PLAYLIST DE RESPALDO ({{ fallbackSongs.length }})</p>
            <div class="fb-btns" v-if="fallbackSongs.length">
              <button class="fb-toggle fb-play-now" @click="playFallbackNow" v-if="!nowPlaying && queue.length === 0">
                &#9654; Reproducir
              </button>
              <button class="fb-toggle" :class="fallbackPaused ? 'fb-paused' : 'fb-playing'" @click="toggleFallback">
                {{ fallbackPaused ? '&#9654; Activar' : '&#10074;&#10074; Pausar' }}
              </button>
            </div>
          </div>
          <p class="text-hint">{{ fallbackPaused ? 'Playlist pausada — no suena cuando la cola esta vacia' : 'Suena automaticamente cuando no hay canciones de las mesas' }}</p>
          <div class="q-list" v-if="fallbackSongs.length">
            <div v-for="song in fallbackSongs" :key="song.id" class="q-item" :class="{ 'q-item-played': !song.active }">
              <img :src="song.thumbnail_url" class="q-thumb" />
              <div class="q-info">
                <p class="q-title">{{ song.title }}</p>
                <p class="q-meta">{{ formatDuration(song.duration_sec) }}</p>
              </div>
              <span class="fb-status" :class="song.active ? 'active' : 'inactive'">{{ song.active ? 'Activa' : 'Inactiva' }}</span>
            </div>
          </div>
          <p v-else class="text-muted">Sin playlist. Configurala desde el Super Admin.</p>
        </div>

        </template>

        <!-- ========== TABLES TAB ========== -->
        <template v-if="rightTab === 'tables'">
          <div v-if="!selectedTable">
            <div v-if="!tables.length" class="card"><p class="text-muted">Sin mesas activas</p></div>
            <div v-for="table in tables" :key="table.table_number" class="card table-detail-card" @click="selectedTable = table" style="cursor:pointer;">
              <div class="td-row">
                <div>
                  <span class="td-num">Mesa {{ table.table_number }}</span>
                  <span class="td-user">{{ table.user_name }} ({{ table.user_phone }})</span>
                </div>
                <span class="td-count">{{ table.songs.length }} canciones</span>
              </div>
            </div>
          </div>

          <!-- Table detail -->
          <div v-else>
            <button class="back-btn" @click="selectedTable = null">&#8592; Volver a mesas</button>
            <div class="card" style="margin-top:10px;">
              <div class="td-header">
                <div>
                  <h3>Mesa {{ selectedTable.table_number }}</h3>
                  <p class="td-user-detail">{{ selectedTable.user_name }} &middot; {{ selectedTable.user_phone }}</p>
                </div>
                <div class="td-actions">
                  <button class="t-btn t-btn-reset" @click="resetTableLimit(selectedTable.table_number)">Resetear limite</button>
                  <button class="t-btn t-btn-kick" @click="kickTable(selectedTable.table_number); selectedTable = null">Expulsar</button>
                </div>
              </div>
            </div>
            <div class="card" style="margin-top:10px;">
              <p class="section-title">CANCIONES PEDIDAS ({{ selectedTable.songs.length }})</p>
              <div v-if="selectedTable.songs.length" class="td-songs">
                <div v-for="(s, i) in selectedTable.songs" :key="i" class="td-song">
                  <span class="td-song-status" :class="s.status"></span>
                  <div class="td-song-info">
                    <p class="td-song-title">{{ s.title }}</p>
                    <p class="td-song-meta">{{ s.added_at }} &middot; {{ { playing: 'Sonando', pending: 'En cola', played: 'Reproducida', removed: 'Removida' }[s.status] || s.status }}</p>
                  </div>
                </div>
              </div>
              <p v-else class="text-muted">No ha pedido canciones</p>
            </div>
          </div>
        </template>

        <!-- ========== ANALYTICS TAB ========== -->
        <template v-if="rightTab === 'analytics'">
          <div v-if="analytics">
            <div class="an-grid">
              <div class="an-card"><p class="an-val">{{ analytics.summary.total_songs_played }}</p><p class="an-label">Canciones</p></div>
              <div class="an-card"><p class="an-val">{{ analytics.summary.unique_users }}</p><p class="an-label">Usuarios</p></div>
              <div class="an-card"><p class="an-val">{{ analytics.summary.unique_songs }}</p><p class="an-label">Unicas</p></div>
              <div class="an-card"><p class="an-val">{{ analytics.summary.avg_queue_length }}</p><p class="an-label">Prom. Cola</p></div>
            </div>
            <div class="card" v-if="analytics.top_songs.length">
              <p class="section-title">TOP CANCIONES (SEMANA)</p>
              <div v-for="(s, i) in analytics.top_songs" :key="s.youtube_id" class="an-song">
                <span class="an-pos">{{ i + 1 }}</span>
                <img :src="`https://i.ytimg.com/vi/${s.youtube_id}/mqdefault.jpg`" class="an-thumb" />
                <span class="an-title">{{ s.title }}</span>
                <span class="an-count">{{ s.times_played }}x</span>
              </div>
            </div>
            <div class="card" v-if="analytics.peak_hours.length" style="margin-top:12px;">
              <p class="section-title">HORAS PICO</p>
              <div v-for="h in analytics.peak_hours.slice(0, 8)" :key="h.hour" class="an-hour">
                <span class="an-hour-label">{{ h.hour }}:00</span>
                <div class="an-hour-bar"><div class="an-hour-fill" :style="{ width: (h.requests / analytics.peak_hours[0].requests * 100) + '%' }"></div></div>
                <span class="an-hour-count">{{ h.requests }}</span>
              </div>
            </div>
            <div class="card" v-if="analytics.top_tables && analytics.top_tables.length" style="margin-top:12px;">
              <p class="section-title">MESAS MAS ACTIVAS</p>
              <div v-for="t in analytics.top_tables" :key="t.table_number" class="an-song">
                <span class="an-pos">{{ t.table_number }}</span>
                <span class="an-title">Mesa {{ t.table_number }}</span>
                <span class="an-count">{{ t.total_songs }} canciones</span>
              </div>
            </div>
          </div>
          <div v-else class="card"><p class="text-muted">Cargando analytics...</p></div>
        </template>

      </main>
    </div>
  </div>
</template>

<style scoped>
/* ===== HEADER ===== */
.admin-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 20px; background: var(--bg-card);
  border-bottom: 1px solid var(--border);
}
.header-brand { display: flex; align-items: center; gap: 10px; }
.header-logo { width: 36px; height: 36px; border-radius: 8px; object-fit: cover; }
.admin-header h1 { font-size: 18px; text-transform: capitalize; }
.btn-logout {
  padding: 6px 14px; border-radius: 6px;
  background: var(--danger); color: white;
  font-size: 13px; font-weight: 600; opacity: 0.8;
}
.btn-logout:hover { opacity: 1; }

/* ===== TWO COLUMN LAYOUT ===== */
.admin-layout {
  display: grid; grid-template-columns: 320px 1fr;
  gap: 20px; max-width: 1200px;
  margin: 0 auto; padding: 16px;
}

/* ===== SIDEBAR ===== */
.sidebar {
  display: flex; flex-direction: column; gap: 14px;
  position: sticky; top: 16px; align-self: start;
  max-height: calc(100vh - 80px); overflow-y: auto;
}
.sidebar-info { text-align: center; }
.sidebar-logo { width: 64px; height: 64px; border-radius: 12px; object-fit: cover; margin: 0 auto 8px; }
.bar-name { font-size: 22px; margin-bottom: 12px; }
.info-stats { display: flex; justify-content: center; gap: 24px; }
.info-stat { text-align: center; }
.info-val { font-size: 28px; font-weight: 700; display: block; }
.info-label { font-size: 11px; color: var(--text-muted); }

/* Quick Actions */
.quick-actions { display: flex; flex-direction: column; gap: 6px; }
.action-btn {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 14px; border-radius: var(--radius-sm);
  background: var(--bg-elevated); border: 1px solid var(--border);
  color: var(--text); font-weight: 600; font-size: 13px;
  text-decoration: none; transition: all 0.15s;
}
.action-btn:hover { border-color: var(--primary); color: var(--primary); }
.action-registro:hover { border-color: var(--success); color: var(--success); }
.action-video:hover { border-color: var(--warning); color: var(--warning); }
.action-usuario:hover { border-color: var(--secondary); color: var(--secondary); }

/* QR */
.qr-card { text-align: center; }
.qr-wrapper { padding: 16px; }
.qr-img { width: 180px; height: 180px; border-radius: 8px; background: white; padding: 6px; }
.qr-bar-name { font-size: 16px; font-weight: 700; margin-top: 10px; }
.qr-url { font-size: 10px; color: var(--text-muted); margin-top: 4px; word-break: break-all; }
.qr-btns { display: flex; gap: 8px; justify-content: center; }
.qr-btn {
  padding: 6px 16px; border-radius: 6px; font-size: 12px; font-weight: 600;
  background: var(--bg-elevated); border: 1px solid var(--border); color: var(--text);
  cursor: pointer; transition: all 0.15s;
}
.qr-btn:hover { border-color: var(--primary); color: var(--primary); }

/* Tables in sidebar */
.tables-list { display: flex; flex-direction: column; gap: 8px; }
.table-item {
  padding: 8px; background: var(--bg-elevated);
  border-radius: 8px; border: 1px solid var(--border);
}
.table-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.table-num { font-weight: 700; font-size: 13px; }
.table-user { font-size: 11px; color: var(--text-muted); }
.table-songs-mini { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 6px; }
.song-pill {
  font-size: 10px; padding: 1px 6px; border-radius: 4px;
  background: var(--bg-card); border: 1px solid var(--border);
}
.song-pill.playing { border-color: var(--success); color: var(--success); }
.song-pill.pending { border-color: var(--warning); color: var(--warning); }
.table-btns { display: flex; gap: 4px; }
.t-btn {
  padding: 3px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; border: 1px solid;
}
.t-btn-reset { border-color: var(--secondary); color: var(--secondary); background: transparent; }
.t-btn-reset:hover { background: var(--secondary); color: #000; }
.t-btn-kick { border-color: var(--danger); color: var(--danger); background: transparent; }
.t-btn-kick:hover { background: var(--danger); color: white; }

/* Analytics mini */
.analytics-mini { display: flex; gap: 12px; margin-bottom: 10px; }
.am {
  flex: 1; text-align: center; padding: 8px;
  background: var(--bg-elevated); border-radius: 6px; font-size: 12px;
}
.top-mini { margin-top: 4px; }
.mini-label { font-size: 11px; color: var(--text-muted); margin-bottom: 4px; }
.top-mini-item { display: flex; justify-content: space-between; font-size: 12px; padding: 2px 0; }
.top-mini-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; margin-right: 8px; }
.top-mini-count { font-weight: 600; color: var(--primary); }

/* ===== MUSIC COLUMN ===== */
.music-col { display: flex; flex-direction: column; gap: 14px; }

/* Stats Bar */
.stats-bar { display: flex; gap: 8px; flex-wrap: wrap; }
.stat-pill {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 14px; border-radius: 20px;
  background: var(--bg-card); border: 1px solid var(--border);
  font-size: 13px;
}
.stat-live { background: rgba(85,239,196,0.15); border-color: var(--success); color: var(--success); font-weight: 700; }
.stat-paused { background: rgba(255,107,107,0.15); border-color: var(--danger); color: var(--danger); font-weight: 700; }
.stat-fallback { background: rgba(108,92,231,0.15); border-color: var(--primary); color: var(--primary); font-weight: 700; font-size: 12px; }

/* Now Playing */
.np-card {
  display: flex; justify-content: space-between; align-items: center;
  gap: 12px; border-left: 4px solid var(--primary);
}
.np-left { display: flex; gap: 12px; align-items: center; flex: 1; min-width: 0; }
.np-thumb { width: 72px; height: 54px; border-radius: 6px; object-fit: cover; flex-shrink: 0; }
.np-title { font-weight: 700; font-size: 15px; }
.np-meta { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
.np-controls { display: flex; gap: 8px; flex-shrink: 0; }
.np-empty { text-align: center; padding: 24px; }
.np-empty-text { color: var(--text-muted); font-size: 14px; }
.np-start { display: flex; flex-direction: column; align-items: center; gap: 16px; }
.ctrl-btn-lg {
  display: flex; align-items: center; gap: 8px;
  padding: 14px 32px; border-radius: 12px;
  font-size: 16px; font-weight: 700; border: 2px solid;
  background: rgba(85,239,196,0.15); border-color: var(--success); color: var(--success);
}
.ctrl-btn-lg:hover { background: var(--success); color: #000; }

/* Control Buttons */
.ctrl-labeled {
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  padding: 8px 14px; border-radius: 10px; font-weight: 700; border: 2px solid;
  transition: all 0.15s; min-width: 70px;
}
.ctrl-icon { font-size: 16px; }
.ctrl-text { font-size: 10px; text-transform: uppercase; }
.ctrl-pause { background: rgba(254,202,87,0.15); border-color: var(--warning); color: var(--warning); }
.ctrl-pause .ctrl-icon { font-size: 12px; letter-spacing: -2px; }
.ctrl-pause:hover { background: var(--warning); color: #000; }
.ctrl-play { background: rgba(85,239,196,0.15); border-color: var(--success); color: var(--success); }
.ctrl-play:hover { background: var(--success); color: #000; }
.ctrl-skip { background: rgba(108,92,231,0.15); border-color: var(--primary); color: var(--primary); }
.ctrl-skip:hover { background: var(--primary); color: white; }

/* Volume */
.volume-card { padding: 14px 16px; }
.volume-row { display: flex; align-items: center; gap: 12px; }
.mute-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 14px; border-radius: 10px; font-size: 14px; flex-shrink: 0;
  background: var(--bg-elevated); border: 1px solid var(--border);
  color: var(--text); cursor: pointer;
}
.mute-icon { font-size: 18px; }
.mute-text { font-size: 11px; font-weight: 700; text-transform: uppercase; }
.mute-btn.muted { background: rgba(255,107,107,0.15); border-color: var(--danger); color: var(--danger); }
.volume-value { font-size: 13px; font-weight: 700; color: var(--primary); min-width: 44px; text-align: right; }
.volume-value.muted { color: var(--danger); }
.volume-slider { flex: 1; height: 6px; -webkit-appearance: none; background: var(--bg-elevated); border-radius: 3px; outline: none; }
.volume-slider:disabled { opacity: 0.3; }
.volume-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 20px; height: 20px; background: var(--primary); border-radius: 50%; cursor: pointer; }

/* Add Song */
.add-card { padding: 14px; }
.add-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.add-header .section-title { margin-bottom: 0; }
.lib-toggle { padding: 4px 12px; border-radius: 6px; background: var(--bg-elevated); border: 1px solid var(--border); color: var(--primary); font-size: 12px; font-weight: 600; }
.add-row { display: flex; gap: 8px; }
.add-row .input-field { flex: 1; }
.ctrl-add {
  width: 44px; min-width: 44px; height: 44px; border-radius: 50%;
  background: var(--primary); border: 2px solid var(--primary);
  color: white; font-size: 22px; display: flex; align-items: center; justify-content: center;
}
.ctrl-add:disabled { opacity: 0.4; }
.ctrl-add-sm { width: 32px; height: 32px; min-width: 32px; background: var(--primary); border: 2px solid var(--primary); color: white; font-size: 18px; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
.library { display: flex; flex-direction: column; gap: 10px; }
.library-list { max-height: 300px; overflow-y: auto; }
.lib-item { display: flex; align-items: center; gap: 10px; padding: 6px 0; border-bottom: 1px solid var(--border); }
.lib-item:last-child { border-bottom: none; }
.lib-thumb { width: 48px; height: 36px; border-radius: 4px; object-fit: cover; }
.lib-info { flex: 1; min-width: 0; }
.lib-title { font-size: 13px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lib-artist { font-size: 11px; color: var(--text-muted); }

/* Queue List */
.q-list { display: flex; flex-direction: column; gap: 6px; }
.q-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; border-radius: 10px;
  background: var(--bg-elevated); border: 1px solid transparent; transition: all 0.2s;
}
.q-item:hover { border-color: var(--border); }
.q-dragging { opacity: 0.3; }
.q-drop-above { border-top: 2px solid var(--primary); }
.q-drop-below { border-bottom: 2px solid var(--primary); }
.q-handle { cursor: grab; font-size: 14px; color: var(--text-muted); flex-shrink: 0; opacity: 0.5; user-select: none; }
.q-handle:hover { opacity: 1; }
.q-pos { font-weight: 700; font-size: 13px; color: var(--text-muted); width: 20px; text-align: center; flex-shrink: 0; }
.q-thumb { width: 48px; height: 36px; border-radius: 4px; object-fit: cover; flex-shrink: 0; }
.q-info { flex: 1; min-width: 0; }
.q-title { font-size: 13px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.q-meta { font-size: 11px; color: var(--text-muted); }
.q-btn-label {
  padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600;
  white-space: nowrap; border: 1px solid var(--border);
  background: var(--bg-card); color: var(--text-muted); flex-shrink: 0;
}
.q-btn-play:hover { background: var(--success); color: #000; border-color: var(--success); }
.q-btn-requeue:hover { background: var(--primary); color: white; border-color: var(--primary); }
.q-btn-remove:hover { background: var(--danger); color: white; border-color: var(--danger); }
.q-item-played { opacity: 0.7; }
.q-item-played:hover { opacity: 1; }

/* Fallback playlist */
.text-hint { font-size: 12px; color: var(--text-muted); margin-bottom: 8px; }
.fb-header { display: flex; justify-content: space-between; align-items: center; }
.fb-btns { display: flex; gap: 6px; }
.fb-play-now { background: rgba(108,92,231,0.15); border-color: var(--primary); color: var(--primary); }
.fb-play-now:hover { background: var(--primary); color: white; }
.fb-toggle {
  padding: 5px 12px; border-radius: 6px; font-size: 12px; font-weight: 600;
  border: 1px solid; cursor: pointer; transition: all 0.15s;
}
.fb-playing { background: rgba(254,202,87,0.15); border-color: var(--warning); color: var(--warning); }
.fb-playing:hover { background: var(--warning); color: #000; }
.fb-paused { background: rgba(85,239,196,0.15); border-color: var(--success); color: var(--success); }
.fb-paused:hover { background: var(--success); color: #000; }
.fb-status { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; flex-shrink: 0; }
.fb-status.active { background: rgba(85,239,196,0.15); color: var(--success); }
.fb-status.inactive { background: rgba(139,139,167,0.15); color: var(--text-muted); }

/* Right Tabs */
.right-tabs {
  display: flex; gap: 4px; background: var(--bg-card);
  border-radius: 10px; padding: 3px;
}
.rt {
  flex: 1; padding: 8px; border-radius: 8px;
  background: transparent; color: var(--text-muted);
  font-size: 13px; font-weight: 600; text-align: center;
  transition: all 0.15s;
}
.rt.active { background: var(--primary); color: white; }

/* Tables Tab */
.table-detail-card { transition: border-color 0.15s; }
.table-detail-card:hover { border-color: var(--primary); }
.td-row { display: flex; justify-content: space-between; align-items: center; }
.td-num { font-weight: 700; font-size: 15px; margin-right: 8px; }
.td-user { font-size: 12px; color: var(--text-muted); }
.td-count { font-size: 13px; color: var(--primary); font-weight: 600; }
.back-btn {
  padding: 6px 12px; border-radius: 6px; background: var(--bg-card);
  border: 1px solid var(--border); color: var(--text-muted);
  font-size: 13px; font-weight: 600; cursor: pointer;
}
.back-btn:hover { border-color: var(--primary); color: var(--primary); }
.td-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; }
.td-header h3 { font-size: 18px; }
.td-user-detail { font-size: 13px; color: var(--text-muted); margin-top: 2px; }
.td-actions { display: flex; gap: 6px; }
.td-songs { display: flex; flex-direction: column; gap: 4px; }
.td-song {
  display: flex; align-items: center; gap: 10px;
  padding: 8px; background: var(--bg-elevated); border-radius: 8px;
}
.td-song-status {
  width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
}
.td-song-status.playing { background: var(--success); }
.td-song-status.pending { background: var(--warning); }
.td-song-status.played { background: var(--text-muted); }
.td-song-status.removed { background: var(--danger); }
.td-song-info { flex: 1; min-width: 0; }
.td-song-title { font-size: 13px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.td-song-meta { font-size: 11px; color: var(--text-muted); margin-top: 2px; }

/* Analytics Tab */
.an-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px; }
.an-card { background: var(--bg-card); border: 1px solid rgba(45,45,74,0.4); border-radius: var(--radius-sm); padding: 16px; text-align: center; }
.an-val { font-size: 26px; font-weight: 700; }
.an-label { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
.an-song {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 0; border-bottom: 1px solid rgba(45,45,74,0.4);
}
.an-song:last-child { border-bottom: none; }
.an-pos { font-weight: 700; font-size: 13px; color: var(--text-muted); width: 20px; text-align: center; flex-shrink: 0; }
.an-thumb { width: 44px; height: 33px; border-radius: 4px; object-fit: cover; flex-shrink: 0; }
.an-title { flex: 1; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.an-count { font-weight: 600; color: var(--primary); font-size: 13px; flex-shrink: 0; }
.an-hour {
  display: flex; align-items: center; gap: 10px;
  padding: 6px 0;
}
.an-hour-label { font-size: 13px; font-weight: 600; width: 45px; flex-shrink: 0; }
.an-hour-bar { flex: 1; height: 8px; background: var(--bg-elevated); border-radius: 4px; overflow: hidden; }
.an-hour-fill { height: 100%; background: var(--primary); border-radius: 4px; transition: width 0.3s; }
.an-hour-count { font-size: 12px; color: var(--text-muted); width: 30px; text-align: right; flex-shrink: 0; }

/* Common */
.text-muted { color: var(--text-muted); font-size: 14px; }

/* ===== RESPONSIVE ===== */
@media (max-width: 900px) {
  .admin-layout { grid-template-columns: 1fr; padding: 12px; gap: 12px; }
  .sidebar { position: static; max-height: none; }
  .np-card { flex-direction: column; align-items: stretch; }
  .np-controls { justify-content: center; flex-wrap: wrap; }
  .stats-bar { flex-wrap: wrap; }
  .volume-row { flex-wrap: wrap; }
  .q-item { flex-wrap: wrap; gap: 8px; padding: 10px 8px; }
  .q-btn-label { font-size: 10px; padding: 3px 8px; }
  .fb-header { flex-direction: column; align-items: flex-start; gap: 8px; }
  .fb-btns { width: 100%; }
  .fb-toggle { flex: 1; text-align: center; }
  .add-row { flex-wrap: wrap; }
  .admin-header { padding: 10px 12px; }
  .admin-header h1 { font-size: 16px; }
  .info-stats { gap: 12px; }
  .info-val { font-size: 22px; }
  .quick-actions { gap: 4px; }
  .action-btn { padding: 8px 12px; font-size: 12px; }
  .qr-img { width: 150px; height: 150px; }
  .table-item { padding: 6px; }
  .table-btns { flex-wrap: wrap; }
  .an-grid { grid-template-columns: repeat(2, 1fr); }
  .td-header { flex-direction: column; }
  .td-actions { width: 100%; }
}

</style>
