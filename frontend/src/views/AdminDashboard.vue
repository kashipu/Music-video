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
        <div class="card">
          <p class="section-title">MESAS ({{ tables.length }})</p>
          <div v-if="tables.length" class="tables-list">
            <div v-for="table in tables" :key="table.table_number" class="table-item">
              <div class="table-top">
                <span class="table-num">#{{ table.table_number }}</span>
                <span class="table-user">{{ table.user_name }}</span>
                <span class="table-count">{{ table.songs.length }}</span>
              </div>
              <div class="table-status-row" v-if="table.songs.length">
                <span v-if="table.songs_playing" class="ts-badge ts-playing">{{ table.songs_playing }} sonando</span>
                <span v-if="table.songs_pending" class="ts-badge ts-pending">{{ table.songs_pending }} en cola</span>
                <span v-if="table.songs_played" class="ts-badge ts-played">{{ table.songs_played }} reproducidas</span>
              </div>
              <div class="table-btns">
                <button class="t-btn t-btn-reset" @click="resetTableLimit(table.table_number)" :disabled="loadingResetLimit[table.table_number]">{{ loadingResetLimit[table.table_number] ? '...' : 'Resetear' }}</button>
                <button class="t-btn t-btn-kick" @click="kickTable(table.table_number)" :disabled="loadingKick[table.table_number]">{{ loadingKick[table.table_number] ? '...' : 'Expulsar' }}</button>
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
        <div class="stats-bar">
          <!-- Unified playback state badge — single source of truth -->
          <div class="stat-pill stat-state" :class="playbackBadge.cls" :title="`Estado: ${playbackBadge.label}`">
            <span class="state-dot"></span>
            {{ playbackBadge.label }}
          </div>
          <div class="stat-pill"><span>&#9835;</span> <strong>{{ queue.length }}</strong> en cola</div>
          <div class="stat-pill"><span>&#9201;</span> {{ totalDuration }}</div>
          <!-- WebSocket connection indicator -->
          <div class="stat-pill ws-pill" :class="wsState.cls" :title="`WebSocket: ${wsState.label}`">
            <span class="ws-dot" :class="wsState.dotCls"></span>
            {{ wsState.label }}
          </div>
        </div>

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
        <template v-if="rightTab === 'tables'">
          <div v-if="!selectedTable">
            <div v-if="!tables.length" class="card"><p class="text-muted">Sin mesas activas</p></div>
            <div v-for="table in tables" :key="table.table_number" class="card table-detail-card" @click="selectedTable = table" style="cursor:pointer;">
              <div class="td-row">
                <div>
                  <span class="td-num">#{{ table.table_number }}</span>
                  <span class="td-user">{{ table.user_name }} ({{ table.user_phone }})</span>
                </div>
                <span class="td-count">{{ table.songs.length }}</span>
              </div>
              <div class="td-status-row" v-if="table.songs.length">
                <span v-if="table.songs_playing" class="ts-badge ts-playing">{{ table.songs_playing }} sonando</span>
                <span v-if="table.songs_pending" class="ts-badge ts-pending">{{ table.songs_pending }} en cola</span>
                <span v-if="table.songs_played" class="ts-badge ts-played">{{ table.songs_played }} reproducidas</span>
              </div>
            </div>
          </div>

          <!-- Table detail -->
          <div v-else>
            <button class="back-btn" @click="selectedTable = null">&#8592; Volver a mesas</button>
            <div class="card" style="margin-top:10px;">
              <div class="td-header">
                <div>
                  <h3>Usuario #{{ selectedTable.table_number }}</h3>
                  <p class="td-user-detail">{{ selectedTable.user_name }} &middot; {{ selectedTable.user_phone }}</p>
                </div>
                <div class="td-actions">
                  <button class="t-btn t-btn-reset" @click="resetTableLimit(selectedTable.table_number)" :disabled="loadingResetLimit[selectedTable.table_number]">{{ loadingResetLimit[selectedTable.table_number] ? '...' : 'Resetear limite' }}</button>
                  <button class="t-btn t-btn-kick" @click="kickTable(selectedTable.table_number); selectedTable = null" :disabled="loadingKick[selectedTable.table_number]">{{ loadingKick[selectedTable.table_number] ? '...' : 'Expulsar' }}</button>
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

/* Tables in sidebar */
.tables-list { display: flex; flex-direction: column; gap: 8px; max-height: 400px; overflow-y: auto; }
.table-item {
  padding: 8px; background: var(--bg-elevated);
  border-radius: 8px; border: 1px solid var(--border);
  min-width: 0;
}
.table-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; gap: 8px; min-width: 0; }
.table-num { font-weight: 700; font-size: 13px; white-space: nowrap; flex-shrink: 0; }
.table-user { font-size: 11px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; flex: 1; }
.table-count {
  font-size: 12px; font-weight: 700; color: var(--primary);
  background: var(--primary-soft); padding: 2px 8px; border-radius: 10px;
  flex-shrink: 0;
}
.table-status-row, .td-status-row { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 6px; }
.ts-badge {
  font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 4px;
}
.ts-playing { background: var(--success-soft); color: var(--success); }
.ts-pending { background: var(--warning-soft); color: var(--warning); }
.ts-played { background: var(--border-soft); color: var(--text-muted); }
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
.music-col { display: flex; flex-direction: column; gap: 14px; min-width: 0; }

/* Stats Bar */
.stats-bar { display: flex; gap: 8px; flex-wrap: wrap; }
.stat-pill {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 14px; border-radius: 20px;
  background: var(--bg-card); border: 1px solid var(--border);
  font-size: 13px;
}
.stat-live { background: var(--success-soft); border-color: var(--success); color: var(--success); font-weight: 700; }
.stat-paused { background: var(--danger-soft); border-color: var(--danger); color: var(--danger); font-weight: 700; }
.stat-fallback { background: var(--primary-soft); border-color: var(--primary); color: var(--primary); font-weight: 700; font-size: 12px; }

/* Unified state badge */
.stat-state { font-weight: 700; font-size: 12px; letter-spacing: 0.4px; text-transform: uppercase; }
.stat-state .state-dot { width: 8px; height: 8px; border-radius: 50%; }
.badge-user      { background: var(--success-soft); border-color: var(--success); color: var(--success); }
.badge-user .state-dot      { background: var(--success); animation: pulse-dot 2s infinite; }
.badge-fallback  { background: var(--primary-soft); border-color: var(--primary); color: var(--primary); }
.badge-fallback .state-dot  { background: var(--primary); animation: pulse-dot 2s infinite; }
.badge-paused    { background: var(--warning-soft, rgba(245,158,11,0.15)); border-color: var(--warning, #f59e0b); color: var(--warning, #f59e0b); }
.badge-paused .state-dot    { background: var(--warning, #f59e0b); }
.badge-ready     { background: var(--success-soft); border-color: var(--success); color: var(--success); }
.badge-ready .state-dot     { background: var(--success); }
.badge-idle      { background: var(--bg-elevated, rgba(255,255,255,0.05)); border-color: var(--border); color: var(--text-muted); }
.badge-idle .state-dot      { background: var(--text-muted); }
.badge-offline   { background: var(--danger-soft); border-color: var(--danger); color: var(--danger); }
.badge-offline .state-dot   { background: var(--danger); animation: pulse-dot 1s infinite; }

/* WebSocket indicator */
.ws-pill { font-size: 11px; }
.ws-pill .ws-dot { width: 7px; height: 7px; border-radius: 50%; }
.ws-ok { color: var(--text-muted); }
.ws-ok .ws-dot-ok { background: #22c55e; box-shadow: 0 0 0 2px rgba(34,197,94,0.2); }
.ws-bad { background: var(--danger-soft); border-color: var(--danger); color: var(--danger); font-weight: 700; }
.ws-bad .ws-dot-bad { background: var(--danger); animation: pulse-dot 1s infinite; }
@keyframes pulse-dot { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }

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

/* Volume */
.volume-card { padding: 14px 16px; }
.volume-row { display: flex; align-items: center; gap: 12px; }
.mute-btn {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 16px; border-radius: 10px; font-size: 14px; flex-shrink: 0;
  background: var(--bg-elevated); border: 1px solid var(--border);
  color: var(--text); cursor: pointer;
}
.mute-icon { font-size: 20px; }
.mute-text { font-size: 12px; font-weight: 700; text-transform: uppercase; }
.mute-btn.muted { background: var(--danger-soft); border-color: var(--danger); color: var(--danger); }
.volume-value { font-size: 13px; font-weight: 700; color: var(--primary); min-width: 44px; text-align: right; }
.volume-value.muted { color: var(--danger); }
.volume-slider {
  flex: 1; height: 6px; outline: none;
  -webkit-appearance: none; appearance: none;
  background: var(--bg-elevated); border-radius: 3px;
  cursor: pointer;
}
.volume-slider:disabled { opacity: 0.3; cursor: not-allowed; }
/* Webkit (Safari, Chrome) track */
.volume-slider::-webkit-slider-runnable-track {
  height: 6px; border-radius: 3px;
  background: var(--bg-elevated);
}
/* Webkit thumb */
.volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none;
  width: 20px; height: 20px;
  background: var(--primary); border-radius: 50%;
  cursor: pointer; margin-top: -7px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.3);
}
/* Firefox track */
.volume-slider::-moz-range-track {
  height: 6px; border-radius: 3px;
  background: var(--bg-elevated); border: none;
}
/* Firefox thumb */
.volume-slider::-moz-range-thumb {
  width: 20px; height: 20px;
  background: var(--primary); border-radius: 50%;
  border: none; cursor: pointer;
  box-shadow: 0 1px 4px rgba(0,0,0,0.3);
}

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

/* Tables Tab */
.table-detail-card { transition: border-color 0.15s; }
.table-detail-card:hover { border-color: var(--primary); }
.td-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; min-width: 0; }
.td-row > div { min-width: 0; flex: 1; }
.td-num { font-weight: 700; font-size: 15px; margin-right: 8px; white-space: nowrap; }
.td-user { font-size: 12px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.td-count { font-size: 13px; color: var(--primary); font-weight: 600; white-space: nowrap; flex-shrink: 0; }
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

/* Common */
.text-muted { color: var(--text-muted); font-size: 14px; }

/* ===== RESPONSIVE ===== */
@media (max-width: 900px) {
  .admin-layout { grid-template-columns: 1fr; padding: 12px; gap: 12px; }
  .sidebar-overlay {
    display: block; position: fixed; inset: 0; z-index: 99;
    background: rgba(0,0,0,0.5);
  }
  .tables-list { max-height: none; }
  .ctrl-labeled { flex: 1; min-width: 0; }
  .stats-bar { flex-wrap: wrap; }
  .stat-pill { font-size: 12px; padding: 5px 10px; }
  .volume-row { flex-wrap: wrap; }
  .volume-slider { width: 100%; order: 3; }
  .q-item { padding: 10px 8px; }
  .q-handle { display: none; }
  .q-pos { display: none; }
  .q-thumb { width: 40px; height: 30px; }
  .q-btn-label { font-size: 10px; padding: 3px 8px; }
  .fb-header { flex-direction: column; align-items: flex-start; gap: 8px; }
  .fb-btns { width: 100%; }
  .fb-toggle { flex: 1; text-align: center; }
  .table-item { padding: 6px; }
  .table-btns { flex-wrap: wrap; }
  .table-songs-mini { max-height: none; }
  .td-header { flex-direction: column; }
  .td-actions { width: 100%; }
  .td-actions .t-btn { flex: 1; text-align: center; }
}

@media (max-width: 480px) {
  .admin-layout { padding: 8px; gap: 8px; }
  .q-item { gap: 6px; }
  .q-info { font-size: 12px; }
  .q-title { font-size: 12px; }
  .q-meta { font-size: 10px; }
  .q-btn-label { font-size: 9px; padding: 2px 6px; }
  .td-row { flex-direction: column; align-items: flex-start; gap: 4px; }
  .td-count { align-self: flex-end; }
  .song-pill { max-width: 120px; }
  .section-title { font-size: 11px; }
}

/* Drawer transition */
.drawer-enter-active, .drawer-leave-active { transition: opacity 0.25s ease; }
.drawer-enter-from, .drawer-leave-to { opacity: 0; }

</style>
