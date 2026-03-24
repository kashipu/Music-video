<script setup>
import { formatDuration } from '../utils/youtube.js'

defineProps({
  song: { type: Object, default: null },
})
</script>

<template>
  <div class="card now-playing" v-if="song">
    <p class="section-title">Sonando Ahora</p>
    <div class="np-content">
      <img :src="song.thumbnail_url" class="np-thumb" />
      <div class="np-info">
        <p class="np-title">{{ song.title }}</p>
        <p class="np-meta">
          <span v-if="song.duration_sec">{{ formatDuration(song.duration_sec) }}</span>
          <span v-if="song.added_by"> &middot; Pedida por {{ song.added_by }}</span>
        </p>
      </div>
    </div>
  </div>
  <div v-else class="card now-playing-empty">
    <p class="section-title">Sonando Ahora</p>
    <p class="empty-text">No hay nada sonando. Pide una cancion!</p>
  </div>
</template>

<style scoped>
.now-playing {
  margin-top: 16px;
  border-left: 3px solid var(--primary);
}
.now-playing-empty {
  margin-top: 16px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
}
.np-content {
  display: flex;
  gap: 12px;
  align-items: center;
}
.np-thumb {
  width: 80px;
  height: 60px;
  border-radius: 6px;
  object-fit: cover;
}
.np-title {
  font-weight: 600;
  font-size: 15px;
  line-height: 1.3;
}
.np-meta {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
}
.empty-text {
  color: var(--text-muted);
  font-size: 14px;
}
</style>
