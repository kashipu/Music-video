<script setup>
import { useRouter } from 'vue-router'
import AdminHeader from '../components/AdminHeader.vue'
import AdminSidebar from '../components/AdminSidebar.vue'
import SubscriptionGate from '../components/SubscriptionGate.vue'
import AdminQrCard from '../components/AdminQrCard.vue'
import AdminTablesCard from '../components/AdminTablesCard.vue'
import AdminSidebarSummary from '../components/AdminSidebarSummary.vue'
import AdminRightTabs from '../components/AdminRightTabs.vue'
import AdminMusicPanel from '../components/AdminMusicPanel.vue'
import AdminTablesView from '../components/AdminTablesView.vue'
import AdminAnalyticsPanel from '../components/AdminAnalyticsPanel.vue'
import { useAdminDashboard } from '../composables/useAdminDashboard.js'

const router = useRouter()
const {
  venueSlug, auth, adminToast, nowPlaying, queue, played, playbackStatus,
  volume, muted, tables, analytics, library, analyticsPeriod, fallbackSongs,
  fallbackPaused, bannerText, bannerActive, showBrand, showQr, qrSize,
  selectedTable, rightTab, addError, queueLimit, playedLimit, dragIdx,
  dropIdx, sidebarOpen, fallbackYoutubeIds, totalDuration, registroUrl,
  qrCodeUrl, wsState, playbackBadge, loadingSkip, loadingPause, loadingResume,
  loadingStart, loadingPlayNow, loadingRemove, loadingClearQueue, loadingKick,
  loadingResetLimit, loadingFallbackPlay, loadingFallbackToggle, loadingFallbackSkip,
  loadingBanner, loadingBrand, loadingQr, loadingQrSize, loadingAddFromLib,
  loadingDeleteFallback, loadingAddToFallback, fetchTables, fetchAnalytics,
  fetchLibrary, startPlayback, nextSong, pausePlayback, resumePlayback,
  playFallbackNow, toggleFallback, changeVolume, toggleMute, activateBanner,
  deactivateBanner, toggleQr, setQrSize, toggleBrand, playNow, clearQueue,
  removeSong, addFromLibrary, requeueSong, kickTable, resetTableLimit,
  downloadQR, printQR, addToFallback, deleteFallbackSong,
  onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd,
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
        <AdminQrCard
          :venue-slug="venueSlug"
          :venue-name="auth.adminInfo?.venue_name"
          :qr-code-url="qrCodeUrl"
          :registro-url="registroUrl"
          @download="downloadQR"
          @print="printQR"
        />

        <AdminTablesCard
          :tables="tables"
          :loading-reset-limit="loadingResetLimit"
          :loading-kick="loadingKick"
          @reset-limit="resetTableLimit"
          @kick-table="kickTable"
        />

        <AdminSidebarSummary :analytics="analytics" />
      </AdminSidebar>

      <!-- ===== RIGHT COLUMN ===== -->
      <main class="music-col">
        <!-- Right Tabs -->
        <AdminRightTabs
          v-model="rightTab"
          @change="tab => { if (tab === 'tables') fetchTables(); if (tab === 'analytics') fetchAnalytics(); }"
        />

        <!-- ========== MUSIC TAB ========== -->
        <AdminMusicPanel
          v-if="rightTab === 'music'"
          v-model:volume="volume"
          v-model:banner-text="bannerText"
          :playback-badge="playbackBadge"
          :queue="queue"
          :total-duration="totalDuration"
          :ws-state="wsState"
          :now-playing="nowPlaying"
          :fallback-songs="fallbackSongs"
          :playback-status="playbackStatus"
          :loading-pause="loadingPause"
          :loading-resume="loadingResume"
          :loading-skip="loadingSkip"
          :loading-fallback-skip="loadingFallbackSkip"
          :loading-start="loadingStart"
          :muted="muted"
          :show-brand="showBrand"
          :loading-brand="loadingBrand"
          :show-qr="showQr"
          :loading-qr="loadingQr"
          :qr-size="qrSize"
          :loading-qr-size="loadingQrSize"
          :banner-active="bannerActive"
          :loading-banner="loadingBanner"
          :library="library"
          :loading-add-from-lib="loadingAddFromLib"
          :add-error="addError"
          :queue-limit="queueLimit"
          :drag-idx="dragIdx"
          :drop-idx="dropIdx"
          :loading-play-now="loadingPlayNow"
          :loading-remove="loadingRemove"
          :loading-clear-queue="loadingClearQueue"
          :played="played"
          :played-limit="playedLimit"
          :fallback-youtube-ids="fallbackYoutubeIds"
          :loading-add-to-fallback="loadingAddToFallback"
          :fallback-paused="fallbackPaused"
          :loading-fallback-play="loadingFallbackPlay"
          :loading-fallback-toggle="loadingFallbackToggle"
          :loading-delete-fallback="loadingDeleteFallback"
          @pause="pausePlayback"
          @resume="resumePlayback"
          @next="nextSong"
          @start="startPlayback"
          @change-volume="changeVolume"
          @toggle-mute="toggleMute"
          @toggle-brand="toggleBrand"
          @toggle-qr="toggleQr"
          @set-qr-size="setQrSize"
          @activate-banner="activateBanner"
          @deactivate-banner="deactivateBanner"
          @add-from-library="addFromLibrary"
          @fetch-library="fetchLibrary"
          @clear-queue="clearQueue"
          @play-now="playNow"
          @remove-song="removeSong"
          @load-more-queue="queueLimit += 15"
          @drag-start="onDragStart"
          @drag-over="onDragOver"
          @drag-leave="onDragLeave"
          @drop="onDrop"
          @drag-end="onDragEnd"
          @requeue-song="requeueSong"
          @add-to-fallback="addToFallback"
          @load-more-played="playedLimit += 15"
          @play-fallback-now="playFallbackNow"
          @toggle-fallback="toggleFallback"
          @delete-fallback-song="deleteFallbackSong"
        />

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
/* =========================================
   CSS GENERAL
   ========================================= */
.admin {
  width: 100%;
  min-height: 100vh;
  min-height: 100dvh;
  overflow-x: hidden;
}

.sidebar-overlay {
  display: none;
}

.admin-layout {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 20px;
  max-width: 1200px;
  margin: 0 auto;
  padding: 16px;
  min-width: 0;
}

.music-col {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

/* Drawer transition */
.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 0.25s ease;
}

.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}

/* =========================================
   BREAKPOINT 900px
   ========================================= */
@media (max-width: 900px) {
  .admin-layout {
    grid-template-columns: 1fr;
    padding: 12px;
    gap: 12px;
  }

  .sidebar-overlay {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 99;
    background: rgba(0, 0, 0, 0.5);
  }
}

/* =========================================
   BREAKPOINT 480px
   ========================================= */
@media (max-width: 480px) {
  .admin-layout {
    padding: 8px;
    gap: 8px;
  }
}
</style>
