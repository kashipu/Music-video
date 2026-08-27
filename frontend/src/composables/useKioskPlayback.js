import { ref } from 'vue'
import {
  getDailyPin,
  getNowPlaying,
  getQueue,
  reportFallbackPlaying,
  reportPlaybackError,
  reportPlaybackFinished,
  setPlaybackStatus,
  startPlaying,
} from '../services/kiosk.js'

export function useKioskPlayback({ venueSlug, getPlayer, loadVideo, triggerOverlay, enforcePlaybackStatus, applyVolume, preloadNextSong, trackFallbackActivated }) {
  const song = ref(null)
  const fallbackActive = ref(false)
  const fallbackSongs = ref([])
  const fallbackPlayed = ref(new Set())
  const playingFallback = ref(false)
  const fallbackPaused = ref(false)
  const playbackStatus = ref('playing')
  const queue = ref([])
  const started = ref(false)
  const dailyPin = ref('')
  const bannerText = ref('')
  const venueName = ref('')
  const venueLogo = ref(null)
  const venueLogoLight = ref(null)
  const venueLogoDark = ref(null)
  const showBrand = ref(true)
  const pendingUserSong = ref(null)
  const showQr = ref(false)
  const qrSize = ref('M')
  let bannerAutoHidden = false

  function syncVenue(data) {
    if (data.banner_text !== undefined && !bannerAutoHidden) bannerText.value = data.banner_text
    if (data.show_brand !== undefined) showBrand.value = data.show_brand
    if (data.qr_size) qrSize.value = data.qr_size
    if (data.show_qr !== undefined) showQr.value = data.show_qr
    if (data.venue_name) venueName.value = data.venue_name
    if (data.venue_logo !== undefined) venueLogo.value = data.venue_logo
    if (data.venue_logo_light !== undefined) venueLogoLight.value = data.venue_logo_light
    if (data.venue_logo_dark !== undefined) venueLogoDark.value = data.venue_logo_dark
  }

  async function syncNowPlaying() {
    const data = await getNowPlaying(venueSlug)
    if (!data) return
    if (data.fallback_songs) fallbackSongs.value = data.fallback_songs

    if (data.song && !data.song.is_fallback) {
      if (playingFallback.value) {
        pendingUserSong.value = { ...data.song, already_playing: true }
      } else {
        const player = getPlayer()
        const currentYtId = song.value?.youtube_id
        const playerIdle = player && typeof player.getPlayerState === 'function'
          && (player.getPlayerState() === -1 || player.getPlayerState() === 5)
        if (currentYtId !== data.song.youtube_id || playerIdle) {
          song.value = data.song
          fallbackActive.value = false
          pendingUserSong.value = null
          if (started.value) loadVideo(data.song.youtube_id)
          triggerOverlay()
        }
      }
    } else if (!data.song) {
      if (song.value && !playingFallback.value) song.value = null
      fallbackActive.value = true
      if (!playingFallback.value && !pendingUserSong.value && fallbackSongs.value.length && started.value && !fallbackPaused.value) playFallback()
    }

    playbackStatus.value = data.playback_status
    enforcePlaybackStatus()
    if (data.volume !== undefined) applyVolume(data.volume)
    syncVenue(data)
  }

  async function fetchDailyPin() {
    try {
      const adminToken = localStorage.getItem('bq_admin_token')
      if (!adminToken) return
      const data = await getDailyPin(adminToken)
      if (data) dailyPin.value = data.require_pin ? data.pin : ''
    } catch { /* */ }
  }

  async function fetchNowPlaying() {
    const data = await getNowPlaying(venueSlug)
    if (!data) return
    song.value = data.song
    playbackStatus.value = data.playback_status
    fallbackActive.value = data.fallback_active
    if (data.fallback_songs) fallbackSongs.value = data.fallback_songs
    syncVenue(data)
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
    if (fallbackPlayed.value.size >= fallbackSongs.value.length) fallbackPlayed.value = new Set()
    const unplayed = fallbackSongs.value.filter(fb => !fallbackPlayed.value.has(fb.youtube_id))
    if (!unplayed.length) return

    const fallbackSong = unplayed[Math.floor(Math.random() * unplayed.length)]
    playingFallback.value = true
    fallbackPlayed.value.add(fallbackSong.youtube_id)
    song.value = { id: null, youtube_id: fallbackSong.youtube_id, title: fallbackSong.title, is_fallback: true }
    loadVideo(fallbackSong.youtube_id)
    reportFallbackPlaying(venueSlug, fallbackSong).catch(() => {})
  }

  function nextFallback() {
    playFallback()
  }

  async function startPendingUserSong(userSong) {
    song.value = userSong
    fallbackActive.value = false
    playingFallback.value = false
    pendingUserSong.value = null
    loadVideo(userSong.youtube_id)
    triggerOverlay()
    fetchQueuePreview()

    if (userSong.id && !userSong.already_playing) {
      const adminToken = localStorage.getItem('bq_admin_token')
      startPlaying(venueSlug, userSong.id, adminToken).catch(() => {})
    }
  }

  async function handleFallbackSkip() {
    if (pendingUserSong.value) {
      await startPendingUserSong(pendingUserSong.value)
      return
    }

    try {
      const data = await getNowPlaying(venueSlug)
      if (data?.song && !data.song.is_fallback) {
        song.value = data.song
        fallbackActive.value = false
        playingFallback.value = false
        pendingUserSong.value = null
        loadVideo(data.song.youtube_id)
        triggerOverlay()
        fetchQueuePreview()
        return
      }
    } catch { /* network error — fall through */ }

    playFallback()
  }

  async function fetchQueuePreview() {
    const data = await getQueue(venueSlug)
    if (!data) return
    queue.value = data.queue.slice(0, 5)
    preloadNextSong()
  }

  function hideBannerAutomatically() {
    bannerAutoHidden = true
  }

  function showBanner() {
    bannerAutoHidden = false
  }

  function reportError(songId, errorCode, adminToken) {
    return reportPlaybackError(songId, venueSlug, errorCode, adminToken)
  }

  function reportFinished(songId, adminToken) {
    return reportPlaybackFinished(songId, venueSlug, adminToken)
  }

  function updatePlaybackStatus(status, adminToken) {
    return setPlaybackStatus(status, adminToken)
  }

  return {
    song, fallbackActive, fallbackSongs, fallbackPlayed, playingFallback, fallbackPaused,
    playbackStatus, queue, started, dailyPin, bannerText, venueName, venueLogo,
    venueLogoLight, venueLogoDark, showBrand, pendingUserSong, showQr, qrSize,
    syncNowPlaying, fetchDailyPin, fetchNowPlaying, playFallback, nextFallback,
    startPendingUserSong, handleFallbackSkip, fetchQueuePreview, hideBannerAutomatically,
    showBanner, reportError, reportFinished, updatePlaybackStatus,
  }
}
