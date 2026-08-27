<script setup>
defineProps({
  song: Object,
  playingFallback: Boolean,
  queue: Array,
  pendingUserSong: Object,
  fallbackPlayed: Object,
  fallbackSongs: Array,
})
</script>

<template>
  <div class="bottom-bar" :class="{ 'bottom-fallback': playingFallback }">
    <div class="bottom-left">
      <span class="bottom-dot" :class="{ 'dot-fallback': playingFallback }"></span>
      <span v-if="playingFallback" class="bottom-badge">PLAYLIST</span>
      <span class="bottom-title">{{ song.title }}</span>
    </div>
    <div class="bottom-right">
      <span v-if="queue.length || pendingUserSong" class="bottom-next">Siguiente: {{ queue[0]?.title || pendingUserSong?.title }}</span>
      <span v-else-if="playingFallback" class="bottom-next">{{ fallbackPlayed.size }}/{{ fallbackSongs.length }} reproducidas</span>
    </div>
  </div>
</template>

<style scoped>
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
</style>
