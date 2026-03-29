<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useWebSocket } from '../composables/useWebSocket.js'

const route = useRoute()
const venueSlug = route.params.venueSlug
const API = import.meta.env.VITE_API_URL || ''

const song = ref(null)
const fallbackActive = ref(false)
const fallbackSongs = ref([])
const fallbackIndex = ref(0)
const fallbackPlayed = ref(new Set())
const playingFallback = ref(false)
const fallbackPaused = ref(false)
const playbackStatus = ref('playing')
const queue = ref([])
const started = ref(false)
const showOverlay = ref(false)
let ytPlayer = null
let overlayTimer = null

const { onEvent, onReconnect } = useWebSocket(venueSlug)

// On reconnect, re-fetch current state since events were missed
onReconnect(() => {
  fetchNowPlaying()
  fetchQueuePreview()
})

onEvent((event) => {
  if (event.event === 'now_playing_changed') {
    if (event.data.song) {
      song.value = event.data.song
      fallbackActive.value = false
      playingFallback.value = false
      loadVideo(event.data.song.youtube_id)
      triggerOverlay()
    } else {
      song.value = null
      fallbackActive.value = true
      playingFallback.value = false
      if (event.data.fallback_songs) fallbackSongs.value = event.data.fallback_songs
      if (fallbackSongs.value.length) playFallback()
    }
    fetchQueuePreview()
  } else if (event.event === 'playback_status_changed') {
    playbackStatus.value = event.data.status
    if (ytPlayer) {
      event.data.status === 'paused' ? ytPlayer.pauseVideo() : ytPlayer.playVideo()
    }
  } else if (event.event === 'fallback_status_changed') {
    fallbackPaused.value = event.data.paused
    if (playingFallback.value) {
      if (event.data.paused) {
        // Stop fallback playback
        if (ytPlayer) ytPlayer.stopVideo()
        song.value = null
        playingFallback.value = false
      }
    } else if (!event.data.paused && fallbackActive.value && !song.value) {
      // Resume fallback
      playFallback()
    }
  } else if (event.event === 'fallback_play_now') {
    if (event.data.fallback_songs) fallbackSongs.value = event.data.fallback_songs
    fallbackPaused.value = false
    fallbackActive.value = true
    playFallback()
  } else if (event.event === 'volume_changed') {
    if (ytPlayer && ytPlayer.setVolume) {
      ytPlayer.setVolume(event.data.volume)
    }
  } else if (event.event === 'song_added' || event.event === 'song_removed' || event.event === 'queue_reordered') {
    fetchQueuePreview()
  }
})

onMounted(async () => {
  await fetchNowPlaying()
  await fetchQueuePreview()
})

function startKiosk() {
  started.value = true
  setTimeout(loadYouTubeAPI, 100)
}

function triggerOverlay() {
  showOverlay.value = true
  if (overlayTimer) clearTimeout(overlayTimer)
  overlayTimer = setTimeout(() => { showOverlay.value = false }, 15000)
}

async function fetchNowPlaying() {
  const res = await fetch(`${API}/api/playback/now-playing?venue=${venueSlug}`)
  if (!res.ok) return
  const data = await res.json()
  song.value = data.song
  playbackStatus.value = data.playback_status
  fallbackActive.value = data.fallback_active
  if (data.fallback_songs) fallbackSongs.value = data.fallback_songs
  if (song.value) {
    playingFallback.value = false
    triggerOverlay()
  } else if (fallbackSongs.value.length && started.value) {
    playFallback()
  }
}

function playFallback() {
  if (!fallbackSongs.value.length || fallbackPaused.value) return

  // If all songs played, reset the cycle
  if (fallbackPlayed.value.size >= fallbackSongs.value.length) {
    fallbackPlayed.value = new Set()
  }

  // Find next unplayed song starting from current index
  let attempts = 0
  while (attempts < fallbackSongs.value.length) {
    if (fallbackIndex.value >= fallbackSongs.value.length) fallbackIndex.value = 0
    const fb = fallbackSongs.value[fallbackIndex.value]
    if (!fallbackPlayed.value.has(fb.youtube_id)) {
      playingFallback.value = true
      fallbackPlayed.value.add(fb.youtube_id)
      song.value = { id: null, youtube_id: fb.youtube_id, title: fb.title, is_fallback: true }
      loadVideo(fb.youtube_id)
      return
    }
    fallbackIndex.value++
    attempts++
  }

  // All played — reset and start from first
  fallbackPlayed.value = new Set()
  if (!fallbackSongs.value.length) return
  const fb = fallbackSongs.value[0]
  fallbackPlayed.value.add(fb.youtube_id)
  fallbackIndex.value = 0
  playingFallback.value = true
  song.value = { id: null, youtube_id: fb.youtube_id, title: fb.title, is_fallback: true }
  loadVideo(fb.youtube_id)
}

function nextFallback() {
  fallbackIndex.value++
  playFallback()
}

async function fetchQueuePreview() {
  const res = await fetch(`${API}/api/queue?venue=${venueSlug}`)
  if (!res.ok) return
  const data = await res.json()
  queue.value = data.queue.slice(0, 3)
}

function loadYouTubeAPI() {
  if (window.YT && window.YT.Player) {
    initPlayer()
    return
  }
  const tag = document.createElement('script')
  tag.src = 'https://www.youtube.com/iframe_api'
  document.head.appendChild(tag)
  window.onYouTubeIframeAPIReady = initPlayer
}

function initPlayer() {
  ytPlayer = new window.YT.Player('yt-player', {
    width: '100%',
    height: '100%',
    playerVars: {
      autoplay: 1,
      controls: 0,
      disablekb: 1,
      modestbranding: 1,
      rel: 0,
      iv_load_policy: 3,
      showinfo: 0,
    },
    events: {
      onReady: () => {
        if (song.value) {
          loadVideo(song.value.youtube_id)
        } else if (fallbackSongs.value.length && !fallbackPaused.value) {
          playFallback()
        }
      },
      onStateChange: onPlayerStateChange,
    },
  })
}

function loadVideo(videoId) {
  if (ytPlayer && ytPlayer.loadVideoById) {
    ytPlayer.loadVideoById(videoId)
  }
}

async function onPlayerStateChange(event) {
  // YT.PlayerState: ENDED=0, UNSTARTED=-1, PAUSED=2
  if (event.data === 0 && song.value) {
    if (playingFallback.value) {
      nextFallback()
    } else {
      // User song ended, notify backend
      const songId = song.value.id
      song.value = null
      const adminToken = localStorage.getItem('bq_admin_token')
      const hdrs = { 'Content-Type': 'application/json' }
      if (adminToken) hdrs['Authorization'] = `Bearer ${adminToken}`
      await fetch(`${API}/api/playback/finished`, {
        method: 'POST',
        headers: hdrs,
        body: JSON.stringify({ song_id: songId, venue_slug: venueSlug }),
      })
      // If backend didn't send next song via WS, check after a short delay
      setTimeout(() => {
        if (!song.value && !playingFallback.value && fallbackSongs.value.length && !fallbackPaused.value) {
          playFallback()
        }
      }, 2000)
    }
  }
  // Detect silence: player stopped/unstarted with nothing queued
  if ((event.data === -1 || event.data === 5) && !song.value && !playingFallback.value) {
    if (fallbackSongs.value.length && !fallbackPaused.value) {
      playFallback()
    }
  }
}
</script>

<template>
  <div class="kiosk">
    <!-- Start Screen -->
    <div v-if="!started" class="start-screen" @click="startKiosk">
      <div class="start-content">
        <div class="start-icon">&#9835;</div>
        <h1 class="start-venue">{{ venueSlug.replace(/-/g, ' ') }}</h1>
        <p class="start-sub">Sistema de musica</p>
        <button class="start-btn" @click.stop="startKiosk">INICIAR REPRODUCTOR</button>
        <p class="start-hint">Click en cualquier lugar para comenzar</p>
      </div>
    </div>

    <!-- Fullscreen Player -->
    <template v-else>
      <div class="player-fullscreen">
        <div id="yt-player"></div>

        <!-- Fallback: no songs playing -->
        <div v-if="!song && !playingFallback" class="fallback-overlay">
          <div class="fallback-content">
            <div class="fallback-icon">&#9835;</div>
            <p class="fallback-text" v-if="fallbackPaused">Playlist pausada</p>
            <p class="fallback-text" v-else>Esperando canciones...</p>
            <p class="fallback-sub">Escanea el QR de tu mesa para pedir musica</p>
          </div>
        </div>

        <!-- Song Info Overlay (appears 15s then fades) -->
        <Transition name="overlay">
          <div v-if="song && showOverlay && !playingFallback" class="song-overlay">
            <div class="overlay-content">
              <p class="overlay-title">{{ song.title }}</p>
              <p class="overlay-meta" v-if="queue.length">
                Siguiente: {{ queue[0]?.title }}
              </p>
            </div>
          </div>
        </Transition>

        <!-- Persistent bottom bar -->
        <div v-if="song" class="bottom-bar" :class="{ 'bottom-fallback': playingFallback }">
          <div class="bottom-left">
            <span class="bottom-dot" :class="{ 'dot-fallback': playingFallback }"></span>
            <span v-if="playingFallback" class="bottom-badge">PLAYLIST</span>
            <span class="bottom-title">{{ song.title }}</span>
          </div>
          <div class="bottom-right">
            <span v-if="queue.length" class="bottom-next">Siguiente: {{ queue[0]?.title }}</span>
            <span v-else-if="playingFallback" class="bottom-next">{{ fallbackPlayed.size }}/{{ fallbackSongs.length }} reproducidas</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.kiosk {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: var(--kiosk-bg);
  color: white;
}

/* ===== FULLSCREEN PLAYER ===== */
.player-fullscreen {
  position: relative;
  width: 100%;
  height: 100%;
}
.player-fullscreen :deep(iframe) {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

/* ===== FALLBACK ===== */
.fallback-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--kiosk-bg);
  z-index: 5;
}
.fallback-content {
  text-align: center;
}
.fallback-icon {
  font-size: 80px;
  margin-bottom: 16px;
  opacity: 0.3;
}
.fallback-text {
  font-size: 32px;
  font-weight: 700;
  opacity: 0.8;
}
.fallback-sub {
  font-size: 18px;
  color: var(--kiosk-text-dim);
  margin-top: 8px;
}

/* ===== SONG OVERLAY (fades after 15s) ===== */
.song-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 10;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.85));
  padding: 60px 40px 40px;
}
.overlay-content {
  max-width: 900px;
}
.overlay-title {
  font-size: 28px;
  font-weight: 700;
  line-height: 1.2;
  text-shadow: 0 2px 8px rgba(0,0,0,0.6);
}
.overlay-meta {
  font-size: 16px;
  color: rgba(255,255,255,0.6);
  margin-top: 8px;
  text-shadow: 0 1px 4px rgba(0,0,0,0.6);
}

/* Overlay transition */
.overlay-enter-active {
  transition: opacity 0.6s ease;
}
.overlay-leave-active {
  transition: opacity 1.5s ease;
}
.overlay-enter-from,
.overlay-leave-to {
  opacity: 0;
}

/* ===== PERSISTENT BOTTOM BAR (always visible, very subtle) ===== */
.bottom-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 8;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 24px;
  background: linear-gradient(transparent, rgba(0,0,0,0.5));
  opacity: 0.7;
  transition: opacity 0.3s;
}
.bottom-bar:hover {
  opacity: 1;
}
.bottom-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.bottom-fallback {
  opacity: 0.5;
}
.bottom-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--kiosk-dot);
  animation: pulse 2s infinite;
}
.dot-fallback {
  background: var(--primary);
}
.bottom-badge {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.5px;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--primary-soft);
  color: var(--primary);
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
.bottom-title {
  font-size: 13px;
  font-weight: 500;
  opacity: 0.8;
}
.bottom-next {
  font-size: 12px;
  opacity: 0.5;
}

/* ===== START SCREEN ===== */
.start-screen {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--kiosk-bg);
  cursor: pointer;
}
.start-content { text-align: center; }
.start-icon { font-size: 80px; margin-bottom: 16px; opacity: 0.5; }
.start-venue {
  font-size: 36px; font-weight: 700;
  text-transform: capitalize; margin-bottom: 8px;
}
.start-sub { color: var(--kiosk-text-dim); font-size: 18px; margin-bottom: 40px; }
.start-btn {
  background: var(--primary); color: white;
  font-size: 20px; font-weight: 700;
  padding: 16px 48px; border-radius: 12px;
  border: none; cursor: pointer;
  transition: transform 0.2s;
}
.start-btn:hover { transform: scale(1.05); }
.start-hint { margin-top: 16px; color: var(--kiosk-text-dimmer); font-size: 14px; }
</style>
