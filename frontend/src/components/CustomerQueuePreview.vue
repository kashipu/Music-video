<script setup>
import Card from './ui/Card.vue'

defineProps({
  queue: {
    type: Array,
    required: true,
  },
  totalInQueue: {
    type: Number,
    default: 0,
  },
})
</script>

<template>
  <Card v-if="queue.length" :title="`&#9654; Siguiente · ${totalInQueue} en cola`" class="section">
    <div v-for="(song, i) in queue" :key="song.id" class="q-item">
      <span class="q-pos">{{ i + 1 }}</span>
      <img :src="song.thumbnail_url || `https://i.ytimg.com/vi/${song.youtube_id}/mqdefault.jpg`" class="q-thumb" alt="" />
      <div class="q-info">
        <p class="q-title">{{ song.title }}</p>
        <p class="q-meta">{{ song.added_by }}</p>
      </div>
    </div>
    <p v-if="totalInQueue > queue.length" class="more-text">
      + {{ totalInQueue - queue.length }} mas en la cola
    </p>
  </Card>
</template>

<style scoped>
/* =========================================
   CSS GENERAL
   ========================================= */
.section {
  margin-top: 14px;
}

.q-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 0;
}

.q-item + .q-item {
  border-top: 1px solid var(--border-soft);
}

.q-pos {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--bg-elevated);
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.q-thumb {
  width: 48px;
  height: 36px;
  border-radius: 6px;
  object-fit: cover;
  flex-shrink: 0;
}

.q-info {
  flex: 1;
  min-width: 0;
}

.q-title {
  font-size: 13px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.q-meta {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
}

.more-text {
  font-size: 12px;
  color: var(--text-muted);
  text-align: center;
  padding: 10px 0 2px;
  opacity: 0.6;
}
</style>
