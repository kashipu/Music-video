<script setup>
import AdminStatsBar from './AdminStatsBar.vue'
import AdminNowPlayingCard from './AdminNowPlayingCard.vue'
import AdminVolumeControl from './AdminVolumeControl.vue'
import AdminBrandingPanel from './AdminBrandingPanel.vue'
import AdminSongSearch from './AdminSongSearch.vue'
import AdminQueueCard from './AdminQueueCard.vue'
import AdminPlayedCard from './AdminPlayedCard.vue'
import AdminFallbackCard from './AdminFallbackCard.vue'

defineProps({
  playbackBadge: { type: Object, required: true },
  queue: { type: Array, default: () => [] },
  totalDuration: { type: String, default: '0 min' },
  wsState: { type: Object, required: true },
  nowPlaying: { type: Object, default: null },
  fallbackSongs: { type: Array, default: () => [] },
  playbackStatus: { type: String, default: 'playing' },
  loadingPause: { type: Boolean, default: false },
  loadingResume: { type: Boolean, default: false },
  loadingSkip: { type: Boolean, default: false },
  loadingFallbackSkip: { type: Boolean, default: false },
  loadingStart: { type: Boolean, default: false },
  volume: { type: Number, default: 80 },
  muted: { type: Boolean, default: false },
  showBrand: { type: Boolean, default: true },
  loadingBrand: { type: Boolean, default: false },
  showQr: { type: Boolean, default: true },
  loadingQr: { type: Boolean, default: false },
  qrSize: { type: String, default: 'M' },
  loadingQrSize: { type: Boolean, default: false },
  bannerText: { type: String, default: '' },
  bannerActive: { type: Boolean, default: false },
  loadingBanner: { type: Boolean, default: false },
  library: { type: Array, default: () => [] },
  loadingAddFromLib: { type: Object, default: () => ({}) },
  addError: { type: String, default: '' },
  queueLimit: { type: Number, default: 15 },
  dragIdx: { type: Number, default: null },
  dropIdx: { type: Number, default: null },
  loadingPlayNow: { type: Object, default: () => ({}) },
  loadingRemove: { type: Object, default: () => ({}) },
  loadingClearQueue: { type: Boolean, default: false },
  played: { type: Array, default: () => [] },
  playedLimit: { type: Number, default: 15 },
  fallbackYoutubeIds: { type: Object, default: () => new Set() },
  loadingAddToFallback: { type: Object, default: () => ({}) },
  fallbackPaused: { type: Boolean, default: false },
  loadingFallbackPlay: { type: Boolean, default: false },
  loadingFallbackToggle: { type: Boolean, default: false },
  loadingDeleteFallback: { type: Object, default: () => ({}) },
})

defineEmits([
  'update:volume',
  'update:banner-text',
  'pause',
  'resume',
  'next',
  'start',
  'change-volume',
  'toggle-mute',
  'toggle-brand',
  'toggle-qr',
  'set-qr-size',
  'activate-banner',
  'deactivate-banner',
  'add-from-library',
  'fetch-library',
  'clear-queue',
  'play-now',
  'remove-song',
  'load-more-queue',
  'drag-start',
  'drag-over',
  'drag-leave',
  'drop',
  'drag-end',
  'requeue-song',
  'add-to-fallback',
  'load-more-played',
  'play-fallback-now',
  'toggle-fallback',
  'delete-fallback-song',
])
</script>

<template>
  <div class="music-panel">
    <!-- Stats Bar -->
    <AdminStatsBar
      :playback-badge="playbackBadge"
      :queue-count="queue.length"
      :total-duration="totalDuration"
      :ws-state="wsState"
    />

    <!-- Now Playing -->
    <AdminNowPlayingCard
      :now-playing="nowPlaying"
      :fallback-songs="fallbackSongs"
      :playback-status="playbackStatus"
      :queue-length="queue.length"
      :loading-pause="loadingPause"
      :loading-resume="loadingResume"
      :loading-skip="loadingSkip"
      :loading-fallback-skip="loadingFallbackSkip"
      :loading-start="loadingStart"
      @pause="$emit('pause')"
      @resume="$emit('resume')"
      @next="$emit('next')"
      @start="$emit('start')"
    />

    <!-- Volume -->
    <AdminVolumeControl
      :volume="volume"
      :muted="muted"
      @update:volume="$emit('update:volume', $event)"
      @change="$emit('change-volume')"
      @toggle-mute="$emit('toggle-mute')"
    />

    <!-- Kiosk Controls -->
    <AdminBrandingPanel
      :show-brand="showBrand"
      :loading-brand="loadingBrand"
      :show-qr="showQr"
      :loading-qr="loadingQr"
      :qr-size="qrSize"
      :loading-qr-size="loadingQrSize"
      :banner-text="bannerText"
      :banner-active="bannerActive"
      :loading-banner="loadingBanner"
      @update:banner-text="$emit('update:banner-text', $event)"
      @toggle-brand="$emit('toggle-brand')"
      @toggle-qr="$emit('toggle-qr')"
      @set-qr-size="$emit('set-qr-size', $event)"
      @activate-banner="$emit('activate-banner')"
      @deactivate-banner="$emit('deactivate-banner')"
    />

    <!-- Add Song -->
    <AdminSongSearch
      :library="library"
      :loading-add="loadingAddFromLib"
      :add-error="addError"
      @add-song="$emit('add-from-library', $event)"
      @fetch-library="$emit('fetch-library')"
    />

    <!-- Queue -->
    <AdminQueueCard
      :queue="queue"
      :queue-limit="queueLimit"
      :drag-idx="dragIdx"
      :drop-idx="dropIdx"
      :loading-play-now="loadingPlayNow"
      :loading-remove="loadingRemove"
      :loading-clear-queue="loadingClearQueue"
      @clear-queue="$emit('clear-queue')"
      @play-now="$emit('play-now', $event)"
      @remove-song="$emit('remove-song', $event)"
      @load-more="$emit('load-more-queue')"
      @drag-start="(idx, ev) => $emit('drag-start', idx, ev)"
      @drag-over="idx => $emit('drag-over', idx)"
      @drag-leave="$emit('drag-leave')"
      @drop="idx => $emit('drop', idx)"
      @drag-end="$emit('drag-end')"
    />

    <!-- Played -->
    <AdminPlayedCard
      :played="played"
      :played-limit="playedLimit"
      :fallback-youtube-ids="fallbackYoutubeIds"
      :loading-add-from-lib="loadingAddFromLib"
      :loading-add-to-fallback="loadingAddToFallback"
      @requeue-song="$emit('requeue-song', $event)"
      @add-to-fallback="$emit('add-to-fallback', $event)"
      @load-more="$emit('load-more-played')"
    />

    <!-- Fallback Playlist -->
    <AdminFallbackCard
      :fallback-songs="fallbackSongs"
      :fallback-paused="fallbackPaused"
      :now-playing="nowPlaying"
      :queue-length="queue.length"
      :loading-fallback-play="loadingFallbackPlay"
      :loading-fallback-toggle="loadingFallbackToggle"
      :loading-delete-fallback="loadingDeleteFallback"
      @play-now="$emit('play-fallback-now')"
      @toggle-fallback="$emit('toggle-fallback')"
      @delete-song="$emit('delete-fallback-song', $event)"
    />
  </div>
</template>

<style scoped>
/* =========================================
   CSS GENERAL
   ========================================= */
.music-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}
</style>
