<script setup>
import { useRouter } from 'vue-router'
import { formatDuration, thumbFallback } from '../utils/youtube.js'
import AdminHeader from '../components/AdminHeader.vue'
import AdminSidebar from '../components/AdminSidebar.vue'
import NowPlaying from '../components/NowPlaying.vue'
import SubscriptionGate from '../components/SubscriptionGate.vue'
import AdminBrandingPanel from '../components/AdminBrandingPanel.vue'
import AdminAnalyticsPanel from '../components/AdminAnalyticsPanel.vue'
import AdminSongSearch from '../components/AdminSongSearch.vue'
import AdminQrCard from '../components/AdminQrCard.vue'
import AdminVolumeControl from '../components/AdminVolumeControl.vue'
import AdminStatsBar from '../components/AdminStatsBar.vue'
import AdminTablesCard from '../components/AdminTablesCard.vue'
import AdminTablesView from '../components/AdminTablesView.vue'
import { useAdminDashboard } from '../composables/useAdminDashboard.js'

const router = useRouter()
const {
  venueSlug,
  auth,
  adminToast,
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
  fetchTables,
  fetchAnalytics,
  fetchFallbackPlaylist,
  fetchLibrary,
  startPlayback,
  nextSong,
  pausePlayback,
  resumePlayback,
  playFallbackNow,
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
} = useAdminDashboard()

document.title = `${auth.adminInfo?.venue_name || venueSlug} - Admin`

function logout() {
  auth.adminLogout()
  router.push({ name: 'admin-login', params: { venueSlug } })
}
</script>

<template>
  <div class="admin">
    <SubscriptionGate />

    <!-- Toast -->
    <Transition name="fade">
      <div v-if="adminToast" class="toast">{{ adminToast }}</div>
    </Transition>

    <!-- HEADER -->
    <AdminHeader
      :venue-name="auth.adminInfo?.venue_name || venueSlug"
      :logo-url="auth.adminInfo?.logo_url"
      :logo-url-light="auth.adminInfo?.logo_url_light"
      :logo-url-dark="auth.adminInfo?.logo_url_dark"
      @toggle-sidebar="sidebarOpen = !sidebarOpen"
      @logout="logout"
    />

    <!-- MOBILE SIDEBAR OVERLAY -->
    <Transition name="drawer">
      <div v-if="sidebarOpen" class="sidebar-overlay" @click="sidebarOpen = false"></div>
    </Transition>

    <!-- TWO COLUMN LAYOUT -->
    <div class="admin-layout">

      <!-- ===== LEFT: BAR INFO ===== -->
      <AdminSidebar
      :venue-name="auth.adminInfo?.venue_name"
      :logo-url="auth.adminInfo?.logo_url"
      :logo-url-light="auth.adminInfo?.logo_url_light"
      :logo-url-dark="auth.adminInfo?.logo_url_dark"
        :active-users="tables.length"
        :queued-count="queue.length"
        :venue-slug="venueSlug"
        :open="sidebarOpen"
        @close="sidebarOpen = false"
      >

        <!-- QR Code -->
        <AdminQrCard
          :venue-slug="venueSlug"
          :venue-name="auth.adminInfo?.venue_name"
          :qr-code-url="qrCodeUrl"
          :registro-url="registroUrl"
          @download="downloadQR"
          @print="printQR"
        />

        <!-- Tables -->
        <AdminTablesCard
          :tables="tables"
          :loading-reset-limit="loadingResetLimit"
          :loading-kick="loadingKick"
          @reset-limit="resetTableLimit"
          @kick-table="kickTable"
        />

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
      </AdminSidebar>

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
        <AdminStatsBar
          :playback-badge="playbackBadge"
          :queue-count="queue.length"
          :total-duration="totalDuration"
          :ws-state="wsState"
        />

        <!-- Now Playing (unified: user song or fallback) -->
        <NowPlaying
          :song="nowPlaying"
          :fallback="!nowPlaying && fallbackSongs.length > 0"
          :playback-status="playbackStatus"
          :queue-length="queue.length"
        >
          <template #controls>
            <button v-if="playbackStatus === 'playing'" class="ctrl-labeled ctrl-pause" @click="pausePlayback" :disabled="loadingPause">
              <span class="ctrl-icon">&#10074;&#10074;</span><span class="ctrl-text">{{ loadingPause ? '...' : 'Pausar' }}</span>
            </button>
            <button v-else class="ctrl-labeled ctrl-play" @click="resumePlayback" :disabled="loadingResume">
              <span class="ctrl-icon">&#9654;</span><span class="ctrl-text">{{ loadingResume ? '...' : 'Reanudar' }}</span>
            </button>
            <button class="ctrl-labeled ctrl-skip" @click="nextSong" :disabled="loadingSkip || loadingFallbackSkip">
              <span class="ctrl-icon">&#9197;</span><span class="ctrl-text">{{ (loadingSkip || loadingFallbackSkip) ? '...' : 'Siguiente' }}</span>
            </button>
          </template>
          <template #empty>
            <p class="empty-text" v-if="!queue.length">Sin reproduccion &mdash; agrega una cancion</p>
            <div v-else class="np-start">
              <p class="empty-text">{{ queue.length }} {{ queue.length === 1 ? 'cancion en cola' : 'canciones en cola' }}</p>
              <button class="ctrl-btn-lg ctrl-play" @click="startPlayback" :disabled="loadingStart">{{ loadingStart ? 'Iniciando...' : '&#9654; REPRODUCIR' }}</button>
            </div>
          </template>
        </NowPlaying>

        <!-- Volume -->
        <AdminVolumeControl
          v-model:volume="volume"
          :muted="muted"
          @change="changeVolume"
          @toggle-mute="toggleMute"
        />

        <!-- Kiosk Controls -->
        <AdminBrandingPanel :show-brand="showBrand" :loading-brand="loadingBrand" :show-qr="showQr" :loading-qr="loadingQr" :qr-size="qrSize" :loading-qr-size="loadingQrSize" v-model:banner-text="bannerText" :banner-active="bannerActive" :loading-banner="loadingBanner" @toggle-brand="toggleBrand" @toggle-qr="toggleQr" @set-qr-size="setQrSize" @activate-banner="activateBanner" @deactivate-banner="deactivateBanner" />

        <!-- Add Song -->
        <AdminSongSearch
          :library="library"
          :loading-add="loadingAddFromLib"
          :add-error="addError"
          @add-song="addFromLibrary"
          @fetch-library="fetchLibrary"
        />

        <!-- Queue -->
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <p class="section-title">COLA ({{ queue.length }})</p>
            <button v-if="queue.length" class="q-btn-label q-btn-remove" style="font-size:11px;" @click="clearQueue" :disabled="loadingClearQueue">{{ loadingClearQueue ? 'Vaciando...' : 'Vaciar cola' }}</button>
          </div>
          <div class="q-list">
            <div v-for="(song, idx) in queue.slice(0, queueLimit)" :key="song.id" class="q-item"
              :class="{ 'q-dragging': dragIdx === idx, 'q-drop-above': dropIdx === idx && dropIdx < dragIdx, 'q-drop-below': dropIdx === idx && dropIdx > dragIdx }"
              draggable="true" @dragstart="onDragStart(idx, $event)" @dragover.prevent="onDragOver(idx)"
              @dragleave="onDragLeave" @drop.prevent="onDrop(idx)" @dragend="onDragEnd">
              <div class="q-handle">&#9776;</div>
              <span class="q-pos">{{ idx + 1 }}</span>
              <img :src="`https://i.ytimg.com/vi/${song.youtube_id}/mqdefault.jpg`" class="q-thumb" />
              <div class="q-info">
                <p class="q-title">{{ song.title }}</p>
                <p class="q-meta">{{ song.user_name }} &middot; #{{ song.table_number }} &middot; {{ formatDuration(song.duration_sec) }}</p>
              </div>
              <button class="q-btn-label q-btn-play" @click="playNow(song.id)" :disabled="loadingPlayNow[song.id]">{{ loadingPlayNow[song.id] ? '...' : '&#9654; Play' }}</button>
              <button class="q-btn-label q-btn-remove" @click="removeSong(song.id)" :disabled="loadingRemove[song.id]">{{ loadingRemove[song.id] ? '...' : '&#10005; Quitar' }}</button>
            </div>
          </div>
          <button v-if="queue.length > queueLimit" class="load-more-btn" @click="queueLimit += 15">
            Ver {{ Math.min(15, queue.length - queueLimit) }} más ({{ queue.length - queueLimit }} restantes)
          </button>
          <p v-if="!queue.length" class="text-muted">Cola vacia</p>
        </div>

        <!-- Played -->
        <div class="card">
          <p class="section-title">YA SONARON ({{ played.length }})</p>
          <div class="q-list" v-if="played.length">
            <div v-for="song in played.slice(0, playedLimit)" :key="song.id" class="q-item q-item-played">
              <img :src="`https://i.ytimg.com/vi/${song.youtube_id}/mqdefault.jpg`" class="q-thumb" />
              <div class="q-info">
                <p class="q-title">{{ song.title }}</p>
                <p class="q-meta">{{ song.user_name }} &middot; {{ song.played_at_label }}</p>
              </div>
              <button class="q-btn-label q-btn-requeue" @click="requeueSong(song.youtube_id)" :disabled="loadingAddFromLib[song.youtube_id]">{{ loadingAddFromLib[song.youtube_id] ? '...' : '&#8634; Encolar' }}</button>
              <button class="q-btn-label q-btn-fallback"
                @click="addToFallback(song.youtube_id)"
                :disabled="fallbackYoutubeIds.has(song.youtube_id) || loadingAddToFallback[song.youtube_id]"
                :title="fallbackYoutubeIds.has(song.youtube_id) ? 'Ya en playlist' : 'Agregar a playlist de respaldo'">
                {{ loadingAddToFallback[song.youtube_id] ? '...' : fallbackYoutubeIds.has(song.youtube_id) ? '&#10003;' : '+ Respaldo' }}
              </button>
            </div>
          </div>
          <button v-if="played.length > playedLimit" class="load-more-btn" @click="playedLimit += 15">
            Ver {{ Math.min(15, played.length - playedLimit) }} más ({{ played.length - playedLimit }} restantes)
          </button>
          <p v-if="!played.length" class="text-muted">Sin historial de hoy</p>
        </div>

        <!-- Fallback Playlist -->
        <div class="card">
          <div class="fb-header">
            <p class="section-title">PLAYLIST DE RESPALDO ({{ fallbackSongs.length }})</p>
            <div class="fb-btns" v-if="fallbackSongs.length">
              <button class="fb-toggle fb-play-now" @click="playFallbackNow" v-if="!nowPlaying && queue.length === 0" :disabled="loadingFallbackPlay">
                {{ loadingFallbackPlay ? '...' : '&#9654; Reproducir' }}
              </button>
              <button class="fb-toggle" :class="fallbackPaused ? 'fb-paused' : 'fb-playing'" @click="toggleFallback" :disabled="loadingFallbackToggle">
                {{ loadingFallbackToggle ? '...' : (fallbackPaused ? '&#9654; Activar' : '&#10074;&#10074; Pausar') }}
              </button>
            </div>
          </div>
          <p class="text-hint">{{ fallbackPaused ? 'Playlist pausada — no suena cuando la cola esta vacia' : 'Suena automaticamente cuando no hay canciones de las mesas' }}</p>
          <div class="fb-scroll" v-if="fallbackSongs.length">
            <div v-for="song in fallbackSongs" :key="song.id" class="q-item" :class="{ 'q-item-played': !song.active }">
              <img :src="song.thumbnail_url" class="q-thumb" @error="thumbFallback" />
              <div class="q-info">
                <p class="q-title">{{ song.title }}</p>
                <p class="q-meta">{{ formatDuration(song.duration_sec) }}</p>
              </div>
              <button class="q-btn-label q-btn-remove"
                @click="deleteFallbackSong(song.id)"
                :disabled="loadingDeleteFallback[song.id]"
                title="Eliminar de la playlist">
                {{ loadingDeleteFallback[song.id] ? '...' : '&#10005; Quitar' }}
              </button>
            </div>
          </div>
          <p v-else class="text-muted">Sin playlist. Configurala desde el Super Admin.</p>
        </div>

        </template>

        <!-- ========== TABLES TAB ========== -->
        <AdminTablesView
          v-if="rightTab === 'tables'"
          :tables="tables"
          :selected-table="selectedTable"
          :loading-reset-limit="loadingResetLimit"
          :loading-kick="loadingKick"
          @select-table="t => selectedTable = t"
          @back="selectedTable = null"
          @reset-limit="resetTableLimit"
          @kick-table="tableNumber => { kickTable(tableNumber); selectedTable = null }"
        />

        <!-- ========== ANALYTICS TAB ========== -->
        <AdminAnalyticsPanel
          v-if="rightTab === 'analytics'"
          :analytics="analytics"
          :analytics-period="analyticsPeriod"
          :fallback-youtube-ids="fallbackYoutubeIds"
          :loading-add-to-fallback="loadingAddToFallback"
          @period="p => { analyticsPeriod = p; fetchAnalytics() }"
          @add-fallback="addToFallback"
        />

      </main>
    </div>
  </div>
</template>

<style scoped>
/* ===== ROOT ===== */
.admin {
  width: 100%;
  min-height: 100vh;
  min-height: 100dvh;
  overflow-x: hidden;
}

.sidebar-overlay { display: none; }

/* ===== TWO COLUMN LAYOUT ===== */
.admin-layout {
  display: grid; grid-template-columns: 320px 1fr;
  gap: 20px; max-width: 1200px;
  margin: 0 auto; padding: 16px;
  min-width: 0;
}

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
.music-col { display: flex; flex-direction: column; gap: 14px; min-width: 0; }

/* Control Buttons */
.ctrl-btn-lg {
  display: flex; align-items: center; gap: 8px;
  padding: 14px 32px; border-radius: 12px;
  font-size: 16px; font-weight: 700; border: 2px solid;
  background: var(--success-soft); border-color: var(--success); color: var(--success);
}
.ctrl-btn-lg:hover { background: var(--success); color: #000; }

/* Control Buttons */
.ctrl-labeled {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: 12px 20px; border-radius: 12px; font-weight: 700; border: 2px solid;
  transition: all 0.15s; min-width: 88px;
}
.ctrl-icon { font-size: 20px; }
.ctrl-text { font-size: 11px; text-transform: uppercase; letter-spacing: 0.3px; }
.ctrl-pause { background: var(--warning-soft); border-color: var(--warning); color: var(--warning); }
.ctrl-pause .ctrl-icon { font-size: 14px; letter-spacing: -2px; }
.ctrl-pause:hover { background: var(--warning); color: #000; }
.ctrl-play { background: var(--success-soft); border-color: var(--success); color: var(--success); }
.ctrl-play:hover { background: var(--success); color: #000; }
.ctrl-skip { background: var(--primary-soft); border-color: var(--primary); color: var(--primary); }
.ctrl-skip:hover { background: var(--primary); color: white; }

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
  padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600;
  white-space: nowrap; border: 1px solid var(--border);
  background: var(--bg-card); color: var(--text-muted); flex-shrink: 0;
  transition: all 0.15s;
}
.q-btn-play:hover { background: var(--success); color: #000; border-color: var(--success); }
.q-btn-requeue:hover { background: var(--primary); color: white; border-color: var(--primary); }
.q-btn-remove:hover { background: var(--danger); color: white; border-color: var(--danger); }
.q-btn-fallback { border-color: var(--secondary); color: var(--secondary); }
.q-btn-fallback:hover:not(:disabled) { background: var(--secondary); color: #000; }
.q-btn-fallback:disabled { opacity: 0.5; cursor: default; }
.q-item-played { opacity: 0.7; }
.q-item-played:hover { opacity: 1; }

/* Load more button */
.load-more-btn {
  width: 100%; margin-top: 10px; padding: 10px;
  border-radius: 8px; border: 1px dashed var(--border);
  background: transparent; color: var(--text-muted);
  font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s;
}
.load-more-btn:hover { border-color: var(--primary); color: var(--primary); }

/* Fallback playlist */
.fb-scroll {
  max-height: 520px; overflow-y: auto;
  display: flex; flex-direction: column; gap: 6px;
  padding-right: 2px;
}
.fb-scroll::-webkit-scrollbar { width: 4px; }
.fb-scroll::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
.text-hint { font-size: 12px; color: var(--text-muted); margin-bottom: 8px; }
.fb-header { display: flex; justify-content: space-between; align-items: center; }
.fb-btns { display: flex; gap: 6px; }
.fb-play-now { background: var(--primary-soft); border-color: var(--primary); color: var(--primary); }
.fb-play-now:hover { background: var(--primary); color: white; }
.fb-toggle {
  padding: 5px 12px; border-radius: 6px; font-size: 12px; font-weight: 600;
  border: 1px solid; cursor: pointer; transition: all 0.15s;
}
.fb-playing { background: var(--warning-soft); border-color: var(--warning); color: var(--warning); }
.fb-playing:hover { background: var(--warning); color: #000; }
.fb-paused { background: var(--success-soft); border-color: var(--success); color: var(--success); }
.fb-paused:hover { background: var(--success); color: #000; }
.fb-status { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; flex-shrink: 0; }
.fb-status.active { background: var(--success-soft); color: var(--success); }
.fb-status.inactive { background: var(--border-soft); color: var(--text-muted); }

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

/* Common */
.text-muted { color: var(--text-muted); font-size: 14px; }

/* ===== RESPONSIVE ===== */
@media (max-width: 900px) {
  .admin-layout { grid-template-columns: 1fr; padding: 12px; gap: 12px; }
  .sidebar-overlay {
    display: block; position: fixed; inset: 0; z-index: 99;
    background: rgba(0,0,0,0.5);
  }
  .ctrl-labeled { flex: 1; min-width: 0; }
  .q-item { padding: 10px 8px; }
  .q-handle { display: none; }
  .q-pos { display: none; }
  .q-thumb { width: 40px; height: 30px; }
  .q-btn-label { font-size: 10px; padding: 3px 8px; }
  .fb-header { flex-direction: column; align-items: flex-start; gap: 8px; }
  .fb-btns { width: 100%; }
  .fb-toggle { flex: 1; text-align: center; }
}

@media (max-width: 480px) {
  .admin-layout { padding: 8px; gap: 8px; }
  .q-item { gap: 6px; }
  .q-info { font-size: 12px; }
  .q-title { font-size: 12px; }
  .q-meta { font-size: 10px; }
  .q-btn-label { font-size: 9px; padding: 2px 6px; }
  .song-pill { max-width: 120px; }
  .section-title { font-size: 11px; }
}

/* Drawer transition */
.drawer-enter-active, .drawer-leave-active { transition: opacity 0.25s ease; }
.drawer-enter-from, .drawer-leave-to { opacity: 0; }

</style>
