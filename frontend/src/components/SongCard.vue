<script setup>
import { formatDuration } from '../utils/youtube.js'

defineProps({
  song: { type: Object, required: true },
})
</script>

<template>
  <div class="song-card">
    <span class="position">{{ song.position }}.</span>
    <img v-if="song.thumbnail_url" :src="song.thumbnail_url" class="thumb" />
    <div class="info">
      <p class="title">{{ song.title }}</p>
      <p class="meta">
        <span v-if="song.added_by">{{ song.added_by }}</span>
        <span v-if="song.table_number"> &middot; #{{ song.table_number }}</span>
        <span v-if="song.duration_sec"> &middot; {{ formatDuration(song.duration_sec) }}</span>
      </p>
    </div>
  </div>
</template>

<style scoped>
.song-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
}
.song-card:last-child {
  border-bottom: none;
}
.position {
  font-weight: 700;
  font-size: 14px;
  color: var(--text-muted);
  min-width: 24px;
}
.thumb {
  width: 48px;
  height: 36px;
  border-radius: 4px;
  object-fit: cover;
}
.info {
  flex: 1;
  min-width: 0;
}
.title {
  font-size: 14px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.meta {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}
</style>
