<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useWebSocket } from '../composables/useWebSocket.js'
import { useTheme } from '../composables/useTheme.js'
import { trackSongPlayed, trackSongEnded, trackSongError, trackFallbackActivated } from '../utils/analytics.js'

const route = useRoute()
const venueSlug = route.params.venueSlug
const { applyVenueTheme } = useTheme()
const API = import.meta.env.VITE_API_URL || ''
const registroUrl = `${window.location.origin}/${venueSlug}/registro`
const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(registroUrl)}`

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
const dailyPin = ref('')
const showOverlay = ref(false)
const bannerText = ref('')
let bannerTimer = null
let bannerAutoHidden = false
const venueName = ref('')
const venueLogo = ref(null)
const showBrand = ref(true)
const pendingUserSong = ref(null)
const audioBlocked = ref(false)
const kioskControlsVisible = ref(false)
const isPlaying = ref(false)
const showQr = ref(false)
const qrCycleVisible = ref(true)
const progress = ref(0)
const currentTime = ref(0)
const duration = ref(0)
let audioUnlocked = false
let kioskControlsTimer = null
let progressInterval = null
let qrCycleTimer = null
let ytPlayer = null
let preloadPlayer = null
let preloadedVideoId = null
let overlayTimer = null

const { onEvent, onReconnect } = useWebSocket(venueSlug)

// On reconnect, re-fetch current state since events were missed
onReconnect(() => {
  syncNowPlaying()
  fetchQueuePreview()
})

onEvent((event) => {
  if (event.event === 'now_playing_changed') {
    if (event.data.song) {
      if (playingFallback.value) {
        // Don't interrupt the current fallback — queue the user song for after it ends
        pendingUserSong.value = event.data.song
      } else {
        song.value = event.data.song
        fallbackActive.value = false
        pendingUserSong.value = null
        loadVideo(event.data.song.youtube_id)
        triggerOverlay()
      }
    } else {
      song.value = null
      fallbackActive.value = true
      playingFallback.value = false
      pendingUserSong.value = null
      if (event.data.fallback_songs) fallbackSongs.value = event.data.fallback_songs
      if (fallbackSongs.value.length) playFallback()
    }
    fetchQueuePreview()
  } else if (event.event === 'playback_status_changed') {
    playbackStatus.value = event.data.status
    applyPlaybackStatus(event.data.status)
  } else if (event.event === 'fallback_status_changed') {
    fallbackPaused.value = event.data.paused
    if (playingFallback.value) {
      if (event.data.paused) {
        // Stop fallback playback
        if (ytPlayer) ytPlayer.stopVideo()
        song.value = null
        playingFallback.value = false
        // If a user song is pending, play it now since fallback stopped
        if (pendingUserSong.value) {
          const userSong = pendingUserSong.value
          pendingUserSong.value = null
          song.value = userSong
          fallbackActive.value = false
          loadVideo(userSong.youtube_id)
          triggerOverlay()
          fetchQueuePreview()
        }
      }
    } else if (!event.data.paused && fallbackActive.value && !song.value) {
      // Resume fallback
      playFallback()
    }
  } else if (event.event === 'fallback_skip') {
    if (playingFallback.value) nextFallback()
  } else if (event.event === 'fallback_play_now') {
    if (event.data.fallback_songs) fallbackSongs.value = event.data.fallback_songs
    fallbackPaused.value = false
    fallbackActive.value = true
    playFallback()
  } else if (event.event === 'volume_changed') {
    applyVolume(event.data.volume)
  } else if (event.event === 'banner_changed') {
    // Banner text
    bannerAutoHidden = false
    bannerText.value = event.data.banner_text || ''
    if (bannerTimer) clearTimeout(bannerTimer)
    if (bannerText.value) {
      bannerTimer = setTimeout(() => { bannerText.value = ''; bannerAutoHidden = true }, 3 * 60 * 1000)
    }
    // Brand visibility
    if (event.data.show_brand !== undefined) showBrand.value = event.data.show_brand
  } else if (event.event === 'qr_visibility_changed') {
    showQr.value = event.data.show_qr
    if (event.data.show_qr) startQrCycle()
    else { stopQrCycle(); qrCycleVisible.value = false }
  } else if (event.event === 'song_added' || event.event === 'song_removed' || event.event === 'queue_reordered') {
    fetchQueuePreview()
    // Safety net: if nothing is playing, a song_added might have started playback
    // but the now_playing_changed event could have been lost
    if (event.event === 'song_added' && !song.value && !playingFallback.value) {
      setTimeout(syncNowPlaying, 500)
    }
  }
})

// Fetch now_playing from the API and sync the player to match backend state.
// This is the single source of truth — handles song changes, pause/resume,
// and fallback transitions.
async function syncNowPlaying() {
  const res = await fetch(`${API}/api/playback/now-playing?venue=${venueSlug}`)
  if (!res.ok) return
  const data = await res.json()
  if (data.fallback_songs) fallbackSongs.value = data.fallback_songs

  // 1. Sync song state
  if (data.song) {
    if (playingFallback.value) {
      // Fallback is playing — queue the user song instead of interrupting
      pendingUserSong.value = data.song
    } else {
      const currentYtId = song.value?.youtube_id
      const playerIdle = ytPlayer && typeof ytPlayer.getPlayerState === 'function'
        && (ytPlayer.getPlayerState() === -1 || ytPlayer.getPlayerState() === 5)
      if (currentYtId !== data.song.youtube_id || playerIdle) {
        song.value = data.song
        fallbackActive.value = false
        pendingUserSong.value = null
        if (started.value) loadVideo(data.song.youtube_id)
        triggerOverlay()
      }
    }
  } else if (!data.song) {
    // No song playing on backend
    if (song.value && !playingFallback.value) {
      // We thought a user song was playing — clear it
      song.value = null
    }
    fallbackActive.value = true
    // Start fallback if not already playing and songs available
    if (!playingFallback.value && fallbackSongs.value.length && started.value && !fallbackPaused.value) {
      playFallback()
    }
  }

  // 2. Sync playback status — always compare backend state vs actual player state
  playbackStatus.value = data.playback_status
  enforcePlaybackStatus()

  // 3. Sync volume
  if (data.volume !== undefined) applyVolume(data.volume)

  // 4. Sync banner + venue branding (don't re-show if auto-hidden)
  if (data.banner_text !== undefined && !bannerAutoHidden) bannerText.value = data.banner_text
  if (data.show_brand !== undefined) showBrand.value = data.show_brand
  if (data.show_qr !== undefined && data.show_qr !== showQr.value) {
    showQr.value = data.show_qr
    if (data.show_qr) startQrCycle()
    else { stopQrCycle(); qrCycleVisible.value = false }
  }
  if (data.venue_name) venueName.value = data.venue_name
  if (data.venue_logo !== undefined) venueLogo.value = data.venue_logo
}

// Compare desired playback status with actual YouTube player state and fix mismatches.
// YT PlayerState: PLAYING=1, PAUSED=2, BUFFERING=3
function enforcePlaybackStatus() {
  if (!ytPlayer || typeof ytPlayer.getPlayerState !== 'function') return
  const playerState = ytPlayer.getPlayerState()
  if (playbackStatus.value === 'paused') {
    // Should be paused but player is playing or buffering
    if (playerState === 1 || playerState === 3) {
      ytPlayer.pauseVideo()
    }
  } else {
    // Should be playing but player is paused
    if (playerState === 2) {
      ytPlayer.playVideo()
    }
  }
}

// Apply pause/resume to the YouTube player (for immediate WS events)
function applyPlaybackStatus(status) {
  if (!ytPlayer) return
  if (status === 'paused') {
    if (typeof ytPlayer.pauseVideo === 'function') ytPlayer.pauseVideo()
  } else {
    if (typeof ytPlayer.playVideo === 'function') ytPlayer.playVideo()
  }
}

// Apply volume to the YouTube player
function applyVolume(vol) {
  if (!ytPlayer || typeof ytPlayer.setVolume !== 'function') return
  ytPlayer.setVolume(vol)
  if (typeof ytPlayer.unMute === 'function' && vol > 0) ytPlayer.unMute()
  if (typeof ytPlayer.mute === 'function' && vol === 0) ytPlayer.mute()
}

// Periodic polling as safety net: every 15s, check if the player state
// matches the backend. Catches any missed WS events.
let pollInterval = null

async function fetchDailyPin() {
  try {
    const adminToken = localStorage.getItem('bq_admin_token')
    if (!adminToken) return
    const res = await fetch(`${API}/api/admin/daily-pin`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    if (res.ok) {
      const data = await res.json()
      dailyPin.value = data.require_pin ? data.pin : ''
    }
  } catch { /* */ }
}

onMounted(async () => {
  // Apply venue theme
  try {
    const adminRaw = localStorage.getItem('bq_admin')
    if (adminRaw) {
      const admin = JSON.parse(adminRaw)
      applyVenueTheme(admin.config)
    }
  } catch { /* */ }
  await fetchNowPlaying()
  await fetchQueuePreview()
  await fetchDailyPin()
  pollInterval = setInterval(syncNowPlaying, 10000)
})

function startKiosk() {
  started.value = true
  audioUnlocked = true
  audioBlocked.value = false
  setTimeout(loadYouTubeAPI, 100)
}

function unlockAudio() {
  audioUnlocked = true
  audioBlocked.value = false
  if (ytPlayer && typeof ytPlayer.unMute === 'function') {
    ytPlayer.unMute()
    ytPlayer.playVideo()
  }
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
  if (data.banner_text !== undefined) bannerText.value = data.banner_text
  if (data.show_brand !== undefined) showBrand.value = data.show_brand
  if (data.show_qr !== undefined) {
    showQr.value = data.show_qr
    if (data.show_qr) startQrCycle()
    else { stopQrCycle(); qrCycleVisible.value = false }
  }
  if (data.venue_name) venueName.value = data.venue_name
  if (data.venue_logo !== undefined) venueLogo.value = data.venue_logo
  if (song.value) {
    playingFallback.value = false
    triggerOverlay()
  } else if (fallbackSongs.value.length && started.value) {
    playFallback()
  }
}

function playFallback() {
  if (!fallbackSongs.value.length || fallbackPaused.value) return
  if (!playingFallback.value) trackFallbackActivated(venueSlug)

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
  queue.value = data.queue.slice(0, 5)
  preloadNextSong()
}

function preloadNextSong() {
  if (!preloadPlayer || !preloadPlayer.cueVideoById) return
  if (queue.value.length > 0) {
    const nextId = queue.value[0].youtube_id
    if (nextId !== preloadedVideoId) {
      preloadPlayer.cueVideoById(nextId)
      preloadedVideoId = nextId
    }
  }
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
        syncNowPlaying()
        // Initialize preload player
        preloadPlayer = new window.YT.Player('yt-preloader', {
          width: '1',
          height: '1',
          playerVars: { autoplay: 0, controls: 0, disablekb: 1, modestbranding: 1 },
          events: {
            onReady: () => { preloadNextSong() },
          },
        })
      },
      onStateChange: onPlayerStateChange,
      onError: onPlayerError,
    },
  })
}

function loadVideo(videoId) {
  if (!ytPlayer || !ytPlayer.loadVideoById) return
  if (playbackStatus.value === 'paused') {
    // Load but don't play — cueVideoById loads without autoplay
    ytPlayer.cueVideoById(videoId)
  } else {
    ytPlayer.loadVideoById(videoId)
  }
}

let consecutiveFallbackErrors = 0

async function onPlayerError(event) {
  const errorCode = event.data
  trackSongError(song.value?.youtube_id, errorCode)

  if (playingFallback.value) {
    consecutiveFallbackErrors++
    if (consecutiveFallbackErrors >= 3) {
      // Too many consecutive fallback errors — stop trying
      console.warn(`${consecutiveFallbackErrors} consecutive fallback errors, stopping`)
      playingFallback.value = false
      song.value = null
      return
    }
    nextFallback()
    return
  }

  // User song failed — notify backend to skip and advance
  if (song.value && song.value.id) {
    const songId = song.value.id
    let adminToken = null
    try { adminToken = localStorage.getItem('bq_admin_token') } catch { /* */ }
    const hdrs = { 'Content-Type': 'application/json' }
    if (adminToken) hdrs['Authorization'] = `Bearer ${adminToken}`

    try {
      const res = await fetch(`${API}/api/playback/error`, {
        method: 'POST',
        headers: hdrs,
        body: JSON.stringify({ song_id: songId, venue_slug: venueSlug, error_code: errorCode }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.next_song) {
          song.value = data.next_song
          fallbackActive.value = false
          playingFallback.value = false
          loadVideo(data.next_song.youtube_id)
          triggerOverlay()
          fetchQueuePreview()
          return
        }
      }
    } catch { /* Network error — fall through */ }

    // No next song or fetch failed — activate fallback
    song.value = null
    fallbackActive.value = true
    setTimeout(async () => {
      if (!song.value && !playingFallback.value) {
        await syncNowPlaying()
        if (!song.value && !playingFallback.value && fallbackSongs.value.length && !fallbackPaused.value) {
          playFallback()
        }
      }
    }, 1000)
  }
}

async function onPlayerStateChange(event) {
  // YT.PlayerState: ENDED=0, PLAYING=1, PAUSED=2, BUFFERING=3, CUED=5, UNSTARTED=-1

  // If video started playing but we're supposed to be paused, pause it
  if (event.data === 1 && playbackStatus.value === 'paused') {
    ytPlayer.pauseVideo()
    return
  }

  // Track playing state and progress
  isPlaying.value = event.data === 1
  if (event.data === 1) startProgressTracking()
  else if (event.data === 0 || event.data === -1) stopProgressTracking()

  // Reset consecutive error counter on successful play
  if (event.data === 1) {
    consecutiveFallbackErrors = 0
    if (song.value) trackSongPlayed(song.value.youtube_id, song.value.title, playingFallback.value)
    // Check if browser muted the player (autoplay policy)
    if (!audioUnlocked && ytPlayer && typeof ytPlayer.isMuted === 'function' && ytPlayer.isMuted()) {
      audioBlocked.value = true
    }
  }

  if (event.data === 0 && song.value) {
    trackSongEnded(song.value.youtube_id, song.value.title)
    if (playingFallback.value) {
      // Fallback song ended — check if a user song is waiting
      if (pendingUserSong.value) {
        const userSong = pendingUserSong.value
        pendingUserSong.value = null
        song.value = userSong
        fallbackActive.value = false
        playingFallback.value = false
        loadVideo(userSong.youtube_id)
        triggerOverlay()
        fetchQueuePreview()
      } else {
        // Check backend for any new user songs that arrived
        try {
          const res = await fetch(`${API}/api/playback/now-playing?venue=${venueSlug}`)
          if (res.ok) {
            const data = await res.json()
            if (data.song) {
              song.value = data.song
              fallbackActive.value = false
              playingFallback.value = false
              loadVideo(data.song.youtube_id)
              triggerOverlay()
              fetchQueuePreview()
            } else {
              nextFallback()
            }
          } else {
            nextFallback()
          }
        } catch {
          nextFallback()
        }
      }
    } else {
      // User song ended — notify backend to advance queue
      const songId = song.value.id
      let adminToken = null
      try { adminToken = localStorage.getItem('bq_admin_token') } catch { /* */ }
      const hdrs = { 'Content-Type': 'application/json' }
      if (adminToken) hdrs['Authorization'] = `Bearer ${adminToken}`

      try {
        const res = await fetch(`${API}/api/playback/finished`, {
          method: 'POST',
          headers: hdrs,
          body: JSON.stringify({ song_id: songId, venue_slug: venueSlug }),
        })
        if (res.ok) {
          const data = await res.json()
          if (data.next_song) {
            // Backend returned next song — load it directly without waiting for WS
            song.value = data.next_song
            fallbackActive.value = false
            playingFallback.value = false
            loadVideo(data.next_song.youtube_id)
            triggerOverlay()
            fetchQueuePreview()
            return
          }
        }
      } catch {
        // Network error — fall through to sync
      }

      // No next song or fetch failed — sync from backend after short delay
      song.value = null
      fallbackActive.value = true
      setTimeout(async () => {
        if (!song.value && !playingFallback.value) {
          await syncNowPlaying()
          // If still nothing after sync, try fallback
          if (!song.value && !playingFallback.value && fallbackSongs.value.length && !fallbackPaused.value) {
            playFallback()
          }
        }
      }, 1000)
    }
  }
  // Detect silence: player stopped/unstarted with nothing queued
  if ((event.data === -1 || event.data === 5) && !song.value && !playingFallback.value) {
    syncNowPlaying()
  }
}

function formatTime(sec) {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function updateProgress() {
  if (!ytPlayer || typeof ytPlayer.getCurrentTime !== 'function') return
  currentTime.value = ytPlayer.getCurrentTime() || 0
  duration.value = ytPlayer.getDuration() || 0
  progress.value = duration.value > 0 ? (currentTime.value / duration.value) * 100 : 0
}

function startProgressTracking() {
  stopProgressTracking()
  progressInterval = setInterval(updateProgress, 500)
}

function stopProgressTracking() {
  if (progressInterval) { clearInterval(progressInterval); progressInterval = null }
}

function seekToPercent(event) {
  if (!ytPlayer || typeof ytPlayer.seekTo !== 'function' || !duration.value) return
  const bar = event.currentTarget
  const rect = bar.getBoundingClientRect()
  const pct = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
  ytPlayer.seekTo(pct * duration.value, true)
  showKioskControls()
}

function showKioskControls() {
  kioskControlsVisible.value = true
  if (kioskControlsTimer) clearTimeout(kioskControlsTimer)
  kioskControlsTimer = setTimeout(() => { kioskControlsVisible.value = false }, 5000)
}

function seekRelative(seconds) {
  if (!ytPlayer || typeof ytPlayer.getCurrentTime !== 'function') return
  const current = ytPlayer.getCurrentTime()
  const duration = ytPlayer.getDuration()
  const target = Math.max(0, Math.min(duration, current + seconds))
  ytPlayer.seekTo(target, true)
  showKioskControls()
}

function togglePlayPause() {
  if (!ytPlayer) return
  const state = ytPlayer.getPlayerState()
  if (state === 1) { ytPlayer.pauseVideo(); isPlaying.value = false }
  else { ytPlayer.playVideo(); isPlaying.value = true }
  showKioskControls()
}

function startQrCycle() {
  stopQrCycle()
  qrCycleVisible.value = true
  function cycle() {
    // Show 2 min, hide 1 min
    qrCycleTimer = setTimeout(() => {
      qrCycleVisible.value = false
      qrCycleTimer = setTimeout(() => {
        qrCycleVisible.value = true
        cycle()
      }, 60 * 1000) // 1 min hidden
    }, 2 * 60 * 1000) // 2 min visible
  }
  cycle()
}

function stopQrCycle() {
  if (qrCycleTimer) { clearTimeout(qrCycleTimer); qrCycleTimer = null }
}

onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval)
  if (kioskControlsTimer) clearTimeout(kioskControlsTimer)
  stopProgressTracking()
  stopQrCycle()
})
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
        <div id="yt-preloader" class="preloader-player"></div>

        <!-- Venue branding top-left -->
        <div v-if="showBrand && (venueName || venueLogo)" class="venue-brand">
          <img v-if="venueLogo" :src="venueLogo.startsWith('/') ? API + venueLogo : venueLogo" class="venue-brand-logo" />
          <span v-else class="venue-brand-name">{{ venueName }}</span>
        </div>

        <!-- Audio blocked by browser -->
        <div v-if="audioBlocked" class="audio-blocked-overlay" @click="unlockAudio">
          <div class="audio-blocked-content">
            <div class="audio-blocked-icon">&#128264;</div>
            <p class="audio-blocked-text">El navegador bloqueo el audio</p>
            <button class="audio-blocked-btn" @click.stop="unlockAudio">ACTIVAR SONIDO</button>
          </div>
        </div>

        <!-- Fallback: no songs playing -->
        <div v-if="!song && !playingFallback" class="fallback-overlay">
          <div class="fallback-content">
            <div class="fallback-icon">&#9835;</div>
            <p class="fallback-text" v-if="fallbackPaused">Playlist pausada</p>
            <p class="fallback-text" v-else>Esperando canciones...</p>
            <p class="fallback-sub">Escanea el QR para pedir musica</p>
            <div class="fallback-qr">
              <img :src="qrCodeUrl" alt="QR" class="fallback-qr-img" crossorigin="anonymous" />
            </div>
            <div v-if="dailyPin" class="pin-display">
              <p class="pin-label">CODIGO DE HOY</p>
              <p class="pin-value">{{ dailyPin }}</p>
            </div>
          </div>
        </div>

        <!-- Progress bar + controls (bottom, expands on hover) -->
        <div v-if="song && !audioBlocked" class="player-bar" @mouseenter="showKioskControls" @mouseleave="kioskControlsVisible = false" @click="showKioskControls">
          <!-- Thin progress line (always visible) -->
          <div class="progress-thin">
            <div class="progress-thin-fill" :style="{ width: progress + '%' }"></div>
          </div>
          <!-- Expanded controls -->
          <Transition name="slide-up">
            <div v-if="kioskControlsVisible" class="player-bar-expanded">
              <div class="pb-progress" @click.stop="seekToPercent($event)">
                <div class="pb-track">
                  <div class="pb-fill" :style="{ width: progress + '%' }"></div>
                  <div class="pb-handle" :style="{ left: progress + '%' }"></div>
                </div>
              </div>
              <div class="pb-row">
                <span class="pb-time">{{ formatTime(currentTime) }}</span>
                <div class="pb-controls">
                  <button class="kc-btn" @click.stop="seekRelative(-10)">-10s</button>
                  <button class="kc-btn kc-playpause" @click.stop="togglePlayPause">
                    {{ isPlaying ? '&#10074;&#10074;' : '&#9654;' }}
                  </button>
                  <button class="kc-btn" @click.stop="seekRelative(10)">+10s</button>
                </div>
                <span class="pb-time">{{ formatTime(duration) }}</span>
              </div>
            </div>
          </Transition>
        </div>

        <!-- Mini QR (bottom-right, cycles 2min on / 1min off) -->
        <Transition name="fade">
          <div v-if="song && showQr && qrCycleVisible" class="mini-qr">
            <img :src="qrCodeUrl" alt="QR" class="mini-qr-img" crossorigin="anonymous" />
            <p class="mini-qr-label">Pide tu cancion</p>
          </div>
        </Transition>

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
            <span v-if="pendingUserSong && playingFallback" class="bottom-next bottom-pending">Siguiente: {{ pendingUserSong.title }}</span>
            <span v-else-if="queue.length" class="bottom-next">Siguiente: {{ queue[0]?.title }}</span>
            <span v-else-if="playingFallback" class="bottom-next">{{ fallbackPlayed.size }}/{{ fallbackSongs.length }} reproducidas</span>
          </div>
        </div>

        <!-- Scrolling banner -->
        <div v-if="bannerText" class="banner-marquee">
          <div class="banner-track">
            <span class="banner-content">{{ bannerText }}</span>
            <span class="banner-content">{{ bannerText }}</span>
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
.player-fullscreen :deep(#yt-player) {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}
/* Hide YouTube branding, watermark, and info overlays */
.player-fullscreen :deep(iframe) {
  pointer-events: none;
}
.player-fullscreen :deep(#yt-preloader) {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
  overflow: hidden;
  top: -9999px;
  left: -9999px;
}

/* ===== AUDIO BLOCKED ===== */
.audio-blocked-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.85);
  cursor: pointer;
}
.audio-blocked-content {
  text-align: center;
  color: #fff;
}
.audio-blocked-icon {
  font-size: 64px;
  margin-bottom: 16px;
}
.audio-blocked-text {
  font-size: 20px;
  margin-bottom: 24px;
  opacity: 0.8;
}
.audio-blocked-btn {
  padding: 16px 48px;
  font-size: 20px;
  font-weight: 700;
  background: #7c3aed;
  color: #fff;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  animation: pulse-btn 2s ease-in-out infinite;
}
@keyframes pulse-btn {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
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
.fallback-qr {
  margin-top: 24px;
}
.fallback-qr-img {
  width: 180px;
  height: 180px;
  border-radius: 12px;
  background: #fff;
  padding: 8px;
}
.pin-display {
  margin-top: 20px;
  text-align: center;
}
.pin-label {
  font-size: 14px;
  color: var(--kiosk-text-dim);
  letter-spacing: 2px;
  margin-bottom: 8px;
}
.pin-value {
  font-size: 56px;
  font-weight: 800;
  letter-spacing: 12px;
  color: #fff;
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
.overlay-enter-active, .fade-enter-active {
  transition: opacity 0.3s ease;
}
.overlay-leave-active, .fade-leave-active {
  transition: opacity 0.5s ease;
}
.overlay-enter-from, .overlay-leave-to,
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

/* ===== PERSISTENT BOTTOM BAR (always visible, very subtle) ===== */
.bottom-bar {
  position: absolute;
  bottom: 4px;
  left: 0;
  right: 0;
  z-index: 8;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 24px;
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
.bottom-pending {
  opacity: 0.8;
  color: #4ade80;
}

/* ===== PLAYER BAR (progress + controls) ===== */
.player-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 18;
}
.progress-thin {
  height: 3px;
  background: rgba(255, 255, 255, 0.15);
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  transition: opacity 0.3s;
}
.progress-thin-fill {
  height: 100%;
  background: var(--primary, #7C6CF0);
  transition: width 0.4s linear;
}
/* Hide thin bar when expanded */
.player-bar:hover .progress-thin { opacity: 0; }

.player-bar-expanded {
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.85));
  padding: 24px 24px 14px;
}
.pb-progress {
  cursor: pointer;
  padding: 8px 0;
}
.pb-track {
  position: relative;
  height: 6px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
  overflow: visible;
}
.pb-fill {
  height: 100%;
  background: var(--primary, #7C6CF0);
  border-radius: 3px;
  transition: width 0.3s linear;
}
.pb-handle {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 0 4px rgba(0,0,0,0.5);
  transition: left 0.3s linear;
}
.pb-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
}
.pb-time {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  font-variant-numeric: tabular-nums;
  min-width: 40px;
}
.pb-time:last-child { text-align: right; }
.pb-controls {
  display: flex;
  gap: 12px;
  align-items: center;
}
.kc-btn {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  border: none;
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.2s;
}
.kc-btn:hover { background: rgba(255, 255, 255, 0.3); }
.kc-btn:active { background: rgba(255, 255, 255, 0.4); }
.kc-playpause {
  font-size: 20px;
  padding: 8px 20px;
}

/* Slide-up transition */
.slide-up-enter-active { transition: all 0.3s ease; }
.slide-up-leave-active { transition: all 0.2s ease; }
.slide-up-enter-from, .slide-up-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

/* ===== MINI QR (during playback) ===== */
.mini-qr {
  position: absolute;
  bottom: 80px;
  right: 24px;
  z-index: 15;
  text-align: center;
}
.mini-qr-img {
  width: 140px;
  height: 140px;
  border-radius: 12px;
  background: #fff;
  padding: 6px;
}
.mini-qr-label {
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  margin-top: 6px;
  text-shadow: 0 1px 4px rgba(0,0,0,0.8);
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

/* ===== VENUE BRANDING ===== */
.venue-brand {
  position: absolute;
  top: 20px;
  left: 24px;
  z-index: 15;
  opacity: 0.8;
}
.venue-brand-logo {
  height: 48px;
  max-width: 160px;
  object-fit: contain;
  border-radius: 8px;
  filter: drop-shadow(0 2px 8px rgba(0,0,0,0.6));
}
.venue-brand-name {
  font-size: 22px;
  font-weight: 700;
  text-transform: capitalize;
  text-shadow: 0 2px 8px rgba(0,0,0,0.8);
}

/* ===== SCROLLING BANNER ===== */
.banner-marquee {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 20;
  overflow: hidden;
  background: #000000;
  padding: 18px 0;
  white-space: nowrap;
}
.banner-track {
  display: inline-flex;
  animation: marquee-scroll 20s linear infinite;
}
.banner-content {
  padding-right: 120px;
  font-size: 48px;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: 0.5px;
  min-width: 100vw;
}
@keyframes marquee-scroll {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
</style>
