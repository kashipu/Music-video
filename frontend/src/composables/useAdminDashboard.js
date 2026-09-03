import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import { useWebSocket } from '../composables/useWebSocket.js'
import { useTheme } from '../composables/useTheme.js'
import { useToast } from '../composables/useToast.js'
import { trackAdminAction } from '../utils/analytics.js'
import {
  getNowPlaying,
  getQueue,
  getPlayed,
  getTables,
  getPlaylist,
  getAnalytics,
  getLibrary,
  startPlayback as apiStartPlayback,
  skipQueueSong,
  pausePlayback as apiPausePlayback,
  resumePlayback as apiResumePlayback,
  setFallbackStatus,
  playFallback as apiPlayFallback,
  skipFallback as apiSkipFallback,
  setVolume as apiSetVolume,
  setBanner as apiSetBanner,
  setQr as apiSetQr,
  playSongNow,
  removeQueueSong,
  reorderQueueSong,
  addQueueSong,
  kickTable as apiKickTable,
  resetTableLimit as apiResetTableLimit,
  addFallbackSong,
  removeFallbackSong,
} from '../services/admin.js'

export function useAdminDashboard() {
  const toast = useToast()
  const route = useRoute()
  const auth = useAuthStore()
  const { applyVenueTheme } = useTheme()

  const venueSlug = route?.params?.venueSlug || auth.adminInfo?.venue_slug || 'default'

  // State
  const adminToast = ref('')
  let toastTimer = null
  function showAdminToast(msg) {
    adminToast.value = msg
    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = setTimeout(() => { adminToast.value = '' }, 3000)
  }

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
  const analyticsPeriod = ref('week')
  const fallbackSongs = ref([])
  const fallbackPaused = ref(false)
  const bannerText = ref('')
  const bannerActive = ref(false)
  const showBrand = ref(true)
  const rightTab = ref('music')
  const selectedTable = ref(null)
  const addError = ref('')

  // Loading states
  const loadingSkip = ref(false)
  const loadingPause = ref(false)
  const loadingResume = ref(false)
  const loadingStart = ref(false)
  const loadingPlayNow = ref({})
  const loadingRemove = ref({})
  const loadingClearQueue = ref(false)
  const loadingKick = ref({})
  const loadingResetLimit = ref({})
  const loadingFallbackPlay = ref(false)
  const loadingFallbackToggle = ref(false)
  const loadingFallbackSkip = ref(false)
  const loadingBanner = ref(false)
  const loadingBrand = ref(false)
  const loadingQr = ref(false)
  const showQr = ref(false)
  const qrSize = ref('M')
  const loadingQrSize = ref(false)
  const loadingAddFromLib = ref({})
  const loadingDeleteFallback = ref({})
  const loadingAddToFallback = ref({})
  const queueLimit = ref(15)
  const playedLimit = ref(15)
  const dragIdx = ref(null)
  const dropIdx = ref(null)
  let ignoreNextReorder = false
  const sidebarOpen = ref(false)

  // Computed
  const fallbackYoutubeIds = computed(() => new Set(fallbackSongs.value.map(s => s.youtube_id)))

  const totalDuration = computed(() => {
    const secs = queue.value.reduce((sum, s) => sum + (s.duration_sec || 0), 0)
    return `${Math.floor(secs / 60)} min`
  })

  const registroUrl = computed(() => {
    if (auth.adminInfo?.qr_url) return auth.adminInfo.qr_url
    // /a, no /registro: nginx lo redirige anadiendo utm_source=panel. Ver specs/utm-qr-panel-y-pantalla.md
    if (typeof window !== 'undefined') return `${window.location.origin}/${venueSlug}/a`
    return `/${venueSlug}/a`
  })

  const qrCodeUrl = computed(() =>
    `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(registroUrl.value)}`
  )

  // WebSocket
  const { onEvent, onReconnect, connected: wsConnected } = useWebSocket(venueSlug)

  const wsState = computed(() => {
    if (wsConnected.value) return { label: 'Conectado', cls: 'ws-ok', dotCls: 'ws-dot-ok' }
    return { label: 'Reconectando…', cls: 'ws-bad', dotCls: 'ws-dot-bad' }
  })

  let wsHadDrop = false
  watch(wsConnected, (connected) => {
    if (!connected) {
      wsHadDrop = true
      toast.warn('Conexión perdida — reintentando…')
    } else if (wsHadDrop) {
      toast.success('Conexión restaurada')
    }
  })

  const playbackBadge = computed(() => {
    if (!wsConnected.value) return { label: 'SIN CONEXIÓN', cls: 'badge-offline' }
    if (playbackStatus.value === 'paused') return { label: 'PAUSADO', cls: 'badge-paused' }
    if (nowPlaying.value && !nowPlaying.value.is_fallback) return { label: 'SONANDO USUARIO', cls: 'badge-user' }
    if (nowPlaying.value && nowPlaying.value.is_fallback) {
      if (fallbackPaused.value) return { label: 'PLAYLIST PAUSADA', cls: 'badge-paused' }
      return { label: 'SONANDO PLAYLIST', cls: 'badge-fallback' }
    }
    if (queue.value.length > 0) return { label: 'LISTA PARA EMPEZAR', cls: 'badge-ready' }
    if (fallbackSongs.value.length > 0 && !fallbackPaused.value) return { label: 'SIN COLA — ESPERANDO PLAYLIST', cls: 'badge-idle' }
    return { label: 'SIN REPRODUCCIÓN', cls: 'badge-idle' }
  })

  onReconnect(() => {
    fetchQueue()
    fetchTables()
    fetchAnalytics()
    fetchFallbackPlaylist()
  })

  onEvent((event) => {
    if (event.event === 'queue_reordered') {
      if (ignoreNextReorder) { ignoreNextReorder = false; return }
      fetchQueue()
    } else if (event.event === 'now_playing_changed') {
      if (event.data.fallback_active && event.data.song?.is_fallback) {
        nowPlaying.value = event.data.song
      } else {
        fetchQueue()
      }
      fetchTables()
    } else if (['song_added', 'song_removed'].includes(event.event)) {
      fetchQueue()
      fetchTables()
    } else if (event.event === 'table_registered') {
      fetchTables()
    } else if (event.event === 'playback_status_changed') {
      playbackStatus.value = event.data.status
    } else if (event.event === 'song_error') {
      showAdminToast(`Error de video: ${event.data.title || 'desconocido'} (codigo ${event.data.error_code})`)
      fetchQueue()
    } else if (event.event === 'volume_changed') {
      volume.value = event.data.volume
      muted.value = event.data.volume === 0
      if (event.data.volume > 0) volumeBeforeMute.value = event.data.volume
    } else if (event.event === 'fallback_status_changed') {
      fallbackPaused.value = event.data.paused
    } else if (event.event === 'banner_changed') {
      bannerText.value = event.data.banner_text || ''
      bannerActive.value = !!event.data.banner_text
      if (event.data.show_brand !== undefined) showBrand.value = event.data.show_brand
    } else if (event.event === 'qr_visibility_changed') {
      showQr.value = event.data.show_qr
      if (event.data.qr_size) qrSize.value = event.data.qr_size
    }
  })

  let adminPoll = null

  async function refreshAdminInfo() {
    try {
      const data = await getNowPlaying(venueSlug)
      if (data && !data.error && data.venue_logo !== undefined && auth.adminInfo) {
        auth.adminInfo.logo_url = data.venue_logo
        auth.adminInfo.logo_url_light = data.venue_logo_light
        auth.adminInfo.logo_url_dark = data.venue_logo_dark
        try { localStorage.setItem('bq_admin', JSON.stringify(auth.adminInfo)) } catch { /* */ }
      }
    } catch { /* */ }
  }

  async function fetchQueue() {
    const data = await getQueue(auth.adminHeaders())
    if (!data || data.error) return
    nowPlaying.value = data.now_playing || data.fallback_now_playing || null
    queue.value = data.queue
    playbackStatus.value = data.playback_status
    fetchPlayed()
  }

  async function fetchPlayed() {
    const data = await getPlayed(auth.adminHeaders())
    if (data && !data.error) played.value = data.songs
  }

  async function fetchTables() {
    const data = await getTables(auth.adminHeaders())
    if (!data || data.error) return
    tables.value = data.tables
    if (selectedTable.value) {
      const updated = data.tables.find(t => t.table_number === selectedTable.value.table_number)
      selectedTable.value = updated || null
    }
  }

  async function fetchAnalytics() {
    const data = await getAnalytics(analyticsPeriod.value, auth.adminHeaders())
    if (data && !data.error) analytics.value = data
  }

  async function fetchFallbackPlaylist() {
    const data = await getPlaylist(auth.adminHeaders())
    if (data && !data.error) fallbackSongs.value = data.songs
  }

  async function fetchLibrary(search = '') {
    const data = await getLibrary(search, auth.adminHeaders())
    if (data && !data.error) library.value = data.songs
  }

  async function startPlayback() {
    if (loadingStart.value) return
    loadingStart.value = true
    try {
      const res = await apiStartPlayback(auth.adminHeaders())
      if (res?.error) {
        toast.error(res.message || 'Error al iniciar reproducción')
      } else {
        trackAdminAction('start_playback')
        await fetchQueue()
      }
    } finally { loadingStart.value = false }
  }

  async function skipSong() {
    if (loadingSkip.value) return
    loadingSkip.value = true
    try {
      const res = await skipQueueSong(auth.adminHeaders())
      if (res && !res.error) {
        toast.success('Canción saltada')
        trackAdminAction('skip_song')
      } else {
        toast.error(res?.message || 'Saltar canción: error')
      }
      await fetchQueue()
    } finally { loadingSkip.value = false }
  }

  async function pausePlayback() {
    if (loadingPause.value) return
    loadingPause.value = true
    const prev = playbackStatus.value
    playbackStatus.value = 'paused'
    try {
      const res = await apiPausePlayback(auth.adminHeaders())
      if (res && !res.error) {
        toast.success('Pausado')
        trackAdminAction('pause_playback')
      } else {
        playbackStatus.value = prev
        toast.error(res?.message || 'Pausar: error')
      }
    } finally { loadingPause.value = false }
  }

  async function resumePlayback() {
    if (loadingResume.value) return
    loadingResume.value = true
    const prev = playbackStatus.value
    playbackStatus.value = 'playing'
    try {
      const res = await apiResumePlayback(auth.adminHeaders())
      if (res && !res.error) {
        toast.success('Reanudado')
        trackAdminAction('resume_playback')
      } else {
        playbackStatus.value = prev
        toast.error(res?.message || 'Reanudar: error')
      }
    } finally { loadingResume.value = false }
  }

  async function playFallbackNow() {
    if (loadingFallbackPlay.value) return
    loadingFallbackPlay.value = true
    try {
      fallbackPaused.value = false
      await setFallbackStatus(false, auth.adminHeaders())
      const res = await apiPlayFallback(auth.adminHeaders())
      if (res && !res.error) toast.success('Playlist iniciada')
      else toast.error(res?.message || 'Error al iniciar playlist')
    } finally { loadingFallbackPlay.value = false }
  }

  async function skipFallbackSong() {
    if (loadingFallbackSkip.value) return
    loadingFallbackSkip.value = true
    try {
      const res = await apiSkipFallback(auth.adminHeaders())
      if (res && !res.error) {
        toast.success('Siguiente canción')
        trackAdminAction('skip_fallback')
      } else {
        toast.error(res?.message || 'Siguiente: error')
      }
    } finally { loadingFallbackSkip.value = false }
  }

  async function nextSong() {
    if (loadingSkip.value || loadingFallbackSkip.value) return
    if (nowPlaying.value && !nowPlaying.value.is_fallback) {
      await skipSong()
    } else {
      await skipFallbackSong()
    }
  }

  async function toggleFallback() {
    if (loadingFallbackToggle.value) return
    loadingFallbackToggle.value = true
    fallbackPaused.value = !fallbackPaused.value
    try {
      const res = await setFallbackStatus(fallbackPaused.value, auth.adminHeaders())
      if (res && !res.error) {
        toast.success(fallbackPaused.value ? 'Playlist pausada' : 'Playlist reanudada')
      } else {
        fallbackPaused.value = !fallbackPaused.value
        toast.error(res?.message || 'Error al actualizar playlist')
      }
    } finally { loadingFallbackToggle.value = false }
  }

  let volumeDebounce = null
  function changeVolume() {
    muted.value = false
    if (volumeDebounce) clearTimeout(volumeDebounce)
    volumeDebounce = setTimeout(() => {
      apiSetVolume(volume.value, auth.adminHeaders())
    }, 150)
  }

  function toggleMute() {
    if (muted.value) {
      muted.value = false
      volume.value = volumeBeforeMute.value
    } else {
      volumeBeforeMute.value = volume.value
      muted.value = true
      volume.value = 0
    }
    apiSetVolume(volume.value, auth.adminHeaders())
  }

  async function activateBanner() {
    if (!bannerText.value || loadingBanner.value) return
    loadingBanner.value = true
    try {
      bannerActive.value = true
      await apiSetBanner(bannerText.value, undefined, auth.adminHeaders())
      showAdminToast('Banner activado (3 min)')
    } finally { loadingBanner.value = false }
  }

  async function deactivateBanner() {
    if (loadingBanner.value) return
    loadingBanner.value = true
    try {
      bannerActive.value = false
      await apiSetBanner('', undefined, auth.adminHeaders())
      showAdminToast('Banner desactivado')
    } finally { loadingBanner.value = false }
  }

  async function toggleQr() {
    if (loadingQr.value) return
    loadingQr.value = true
    try {
      showQr.value = !showQr.value
      await apiSetQr(`show=${showQr.value}`, auth.adminHeaders())
      showAdminToast(showQr.value ? 'QR visible en pantalla' : 'QR oculto')
    } finally { loadingQr.value = false }
  }

  async function setQrSize(size) {
    if (size === qrSize.value || loadingQrSize.value) return
    loadingQrSize.value = true
    try {
      qrSize.value = size
      await apiSetQr(`size=${size}`, auth.adminHeaders())
    } finally { loadingQrSize.value = false }
  }

  async function toggleBrand() {
    if (loadingBrand.value) return
    loadingBrand.value = true
    try {
      showBrand.value = !showBrand.value
      await apiSetBanner(bannerActive.value ? bannerText.value : '', showBrand.value, auth.adminHeaders())
      showAdminToast(showBrand.value ? 'Logo visible' : 'Logo oculto')
    } finally { loadingBrand.value = false }
  }

  async function playNow(songId) {
    if (loadingPlayNow.value[songId]) return
    loadingPlayNow.value = { ...loadingPlayNow.value, [songId]: true }
    try {
      const res = await playSongNow(songId, auth.adminHeaders())
      if (res && !res.error) {
        toast.success('Canción promovida')
        trackAdminAction('play_now', { song_id: songId })
      } else {
        toast.error(res?.message || 'Reproducir ahora: error')
      }
      await fetchQueue()
    } finally { loadingPlayNow.value = { ...loadingPlayNow.value, [songId]: false } }
  }

  async function clearQueue() {
    if (loadingClearQueue.value) return
    if (!confirm('Vaciar toda la cola?')) return
    loadingClearQueue.value = true
    try {
      const count = queue.value.length
      const results = await Promise.all(queue.value.map(song =>
        removeQueueSong(song.id, auth.adminHeaders())
      ))
      const okCount = results.filter(r => r && !r.error).length
      if (okCount === count) toast.success(`Cola vaciada (${count} canciones)`)
      else toast.warn(`Vaciado parcial: ${okCount}/${count}`)
      trackAdminAction('clear_queue', { songs_cleared: okCount })
      await fetchQueue()
    } finally { loadingClearQueue.value = false }
  }

  async function removeSong(songId) {
    if (loadingRemove.value[songId]) return
    loadingRemove.value = { ...loadingRemove.value, [songId]: true }
    try {
      const res = await removeQueueSong(songId, auth.adminHeaders())
      if (res && !res.error) {
        toast.success('Canción quitada')
        trackAdminAction('remove_song', { song_id: songId })
      } else {
        toast.error(res?.message || 'Quitar canción: error')
      }
      await fetchQueue()
    } finally { loadingRemove.value = { ...loadingRemove.value, [songId]: false } }
  }

  async function moveSong(songId, newPosition) {
    const fromIdx = queue.value.findIndex(s => s.id === songId)
    const toIdx = queue.value.findIndex(s => s.position === newPosition)
    if (fromIdx !== -1 && toIdx !== -1) {
      const [moved] = queue.value.splice(fromIdx, 1)
      queue.value.splice(toIdx, 0, moved)
      queue.value.forEach((s, i) => { s.position = i + 1 })
    }

    ignoreNextReorder = true
    await reorderQueueSong(songId, newPosition, auth.adminHeaders())
    await fetchQueue()
  }

  async function addFromLibrary(youtubeId) {
    if (loadingAddFromLib.value[youtubeId]) return
    loadingAddFromLib.value = { ...loadingAddFromLib.value, [youtubeId]: true }
    addError.value = ''
    try {
      const data = await addQueueSong(youtubeId, auth.adminHeaders())
      if (!data || data.error) {
        addError.value = data?.message || 'Error al agregar'
        setTimeout(() => { addError.value = '' }, 3000)
      } else {
        await fetchQueue()
      }
    } catch {
      addError.value = 'Error al agregar'
      setTimeout(() => { addError.value = '' }, 3000)
    } finally { loadingAddFromLib.value = { ...loadingAddFromLib.value, [youtubeId]: false } }
  }

  async function requeueSong(youtubeId) {
    await addFromLibrary(youtubeId)
  }

  async function kickTable(tableNumber) {
    if (loadingKick.value[tableNumber]) return
    if (!confirm(`Expulsar al usuario de la mesa #${tableNumber}? Sus canciones pendientes serán removidas.`)) return
    loadingKick.value = { ...loadingKick.value, [tableNumber]: true }
    try {
      const res = await apiKickTable(tableNumber, auth.adminHeaders())
      if (res && !res.error) {
        toast.success(`Usuario de mesa #${tableNumber} expulsado`)
        trackAdminAction('kick_table', { table_number: tableNumber })
      } else {
        toast.error(res?.message || `Expulsar mesa #${tableNumber}: error`)
      }
      await fetchTables()
    } finally { loadingKick.value = { ...loadingKick.value, [tableNumber]: false } }
  }

  async function resetTableLimit(tableNumber) {
    if (loadingResetLimit.value[tableNumber]) return
    loadingResetLimit.value = { ...loadingResetLimit.value, [tableNumber]: true }
    try {
      const res = await apiResetTableLimit(tableNumber, auth.adminHeaders())
      if (res && !res.error) {
        toast.success(`Límite de mesa #${tableNumber} reseteado`)
        trackAdminAction('reset_limit', { table_number: tableNumber })
      } else {
        toast.error(res?.message || `Resetear límite #${tableNumber}: error`)
      }
      await fetchTables()
    } finally { loadingResetLimit.value = { ...loadingResetLimit.value, [tableNumber]: false } }
  }

  function downloadQR() {
    if (typeof document === 'undefined') return
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const padding = 40
      const textHeight = 80
      canvas.width = img.width + padding * 2
      canvas.height = img.height + padding * 2 + textHeight
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, padding, padding)
      ctx.fillStyle = '#000000'
      ctx.font = 'bold 24px Inter, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(auth.adminInfo?.venue_name || venueSlug, canvas.width / 2, img.height + padding + 35)
      ctx.font = '14px Inter, sans-serif'
      ctx.fillStyle = '#666666'
      ctx.fillText(registroUrl.value, canvas.width / 2, img.height + padding + 60)
      const link = document.createElement('a')
      link.download = `qr-${venueSlug}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    }
    img.src = qrCodeUrl.value
  }

  function printQR() {
    if (typeof window === 'undefined') return
    const printWin = window.open('', '_blank', 'width=500,height=600')
    if (!printWin) return
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

  async function addToFallback(youtubeId) {
    if (loadingAddToFallback.value[youtubeId]) return
    loadingAddToFallback.value = { ...loadingAddToFallback.value, [youtubeId]: true }
    try {
      const res = await addFallbackSong(youtubeId, auth.adminHeaders())
      if (!res || res.error) { showAdminToast(res?.message || 'Error al agregar'); return }
      showAdminToast('Canción agregada a la playlist de respaldo')
      await fetchFallbackPlaylist()
    } catch { showAdminToast('Error de conexión') }
    finally { loadingAddToFallback.value = { ...loadingAddToFallback.value, [youtubeId]: false } }
  }

  async function deleteFallbackSong(songId) {
    if (loadingDeleteFallback.value[songId]) return
    loadingDeleteFallback.value = { ...loadingDeleteFallback.value, [songId]: true }
    try {
      const res = await removeFallbackSong(songId, auth.adminHeaders())
      if (!res || res.error) { showAdminToast(res?.message || 'Error al eliminar'); return }
      showAdminToast('Canción eliminada de la playlist')
      await fetchFallbackPlaylist()
    } catch { showAdminToast('Error de conexión') }
    finally { loadingDeleteFallback.value = { ...loadingDeleteFallback.value, [songId]: false } }
  }

  // Drag & drop
  function onDragStart(idx, event) { dragIdx.value = idx; event.dataTransfer.effectAllowed = 'move' }
  function onDragOver(idx) { if (dragIdx.value !== null && dragIdx.value !== idx) dropIdx.value = idx }
  function onDragLeave() { dropIdx.value = null }
  async function onDrop(idx) {
    if (dragIdx.value === null || dragIdx.value === idx) return
    const song = queue.value[dragIdx.value]
    const target = queue.value[idx]
    if (song && target) await moveSong(song.id, target.position)
    dragIdx.value = null
    dropIdx.value = null
  }
  function onDragEnd() { dragIdx.value = null; dropIdx.value = null }

  onMounted(async () => {
    applyVenueTheme(auth.adminInfo?.config)
    try {
      const cfg = typeof auth.adminInfo?.config === 'string' ? JSON.parse(auth.adminInfo.config) : auth.adminInfo?.config
      bannerText.value = cfg?.banner_text || ''
      showBrand.value = cfg?.show_brand !== false
      showQr.value = cfg?.show_qr === true
      qrSize.value = cfg?.qr_size || 'M'
    } catch { /* */ }
    await Promise.all([fetchQueue(), fetchTables(), fetchAnalytics(), fetchFallbackPlaylist(), refreshAdminInfo()])
    adminPoll = setInterval(() => {
      fetchQueue()
      fetchTables()
    }, 30000)
  })

  onUnmounted(() => {
    if (adminPoll) clearInterval(adminPoll)
    if (toastTimer) clearTimeout(toastTimer)
    if (volumeDebounce) clearTimeout(volumeDebounce)
  })

  return {
    venueSlug,
    auth,
    adminToast,
    showAdminToast,
    nowPlaying,
    queue,
    played,
    playbackStatus,
    volume,
    muted,
    tables,
    analytics,
    library,
    analyticsPeriod,
    fallbackSongs,
    fallbackPaused,
    bannerText,
    bannerActive,
    showBrand,
    showQr,
    qrSize,
    selectedTable,
    rightTab,
    addError,
    queueLimit,
    playedLimit,
    dragIdx,
    dropIdx,
    sidebarOpen,
    fallbackYoutubeIds,
    totalDuration,
    registroUrl,
    qrCodeUrl,
    wsConnected,
    wsState,
    playbackBadge,
    loadingSkip,
    loadingPause,
    loadingResume,
    loadingStart,
    loadingPlayNow,
    loadingRemove,
    loadingClearQueue,
    loadingKick,
    loadingResetLimit,
    loadingFallbackPlay,
    loadingFallbackToggle,
    loadingFallbackSkip,
    loadingBanner,
    loadingBrand,
    loadingQr,
    loadingQrSize,
    loadingAddFromLib,
    loadingDeleteFallback,
    loadingAddToFallback,
    fetchQueue,
    fetchPlayed,
    fetchTables,
    fetchAnalytics,
    fetchFallbackPlaylist,
    fetchLibrary,
    startPlayback,
    skipSong,
    pausePlayback,
    resumePlayback,
    playFallbackNow,
    skipFallbackSong,
    nextSong,
    toggleFallback,
    changeVolume,
    toggleMute,
    activateBanner,
    deactivateBanner,
    toggleQr,
    setQrSize,
    toggleBrand,
    playNow,
    clearQueue,
    removeSong,
    moveSong,
    addFromLibrary,
    requeueSong,
    kickTable,
    resetTableLimit,
    downloadQR,
    printQR,
    addToFallback,
    deleteFallbackSong,
    onDragStart,
    onDragOver,
    onDragLeave,
    onDrop,
    onDragEnd,
  }
}
