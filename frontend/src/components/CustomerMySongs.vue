<script setup>
import Card from './ui/Card.vue'

defineProps({
  songs: {
    type: Array,
    required: true,
  },
  cancelLoading: {
    type: Object,
    default: () => ({}),
  },
})

defineEmits(['cancel-song'])
</script>

<template>
  <Card v-if="songs.length" title="&#127911; Tus canciones" class="section">
    <div v-for="song in songs" :key="song.id" class="my-item">
      <img :src="`https://i.ytimg.com/vi/${song.youtube_id}/mqdefault.jpg`" class="my-thumb" alt="" />
      <div class="my-info">
        <p class="my-title">{{ song.title }}</p>
        <div class="my-status">
          <template v-if="song.status === 'playing'">
            <span class="status-pill playing">&#9654; Sonando</span>
          </template>
          <template v-else>
            <span class="status-pill pending">#{{ song.position }} en cola</span>
          </template>
        </div>
      </div>
      <button
        v-if="song.status === 'pending'"
        type="button"
        class="cancel-btn"
        :disabled="cancelLoading[song.id]"
        title="Quitar de la cola"
        @click="$emit('cancel-song', song.id)"
      >
        {{ cancelLoading[song.id] ? '...' : '&#10005;' }}
      </button>
    </div>
  </Card>
</template>

<style scoped>
/* =========================================
   CSS GENERAL
   ========================================= */
.section {
  margin-top: 14px;
}

.my-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
}

.my-item + .my-item {
  border-top: 1px solid var(--border-soft);
}

.my-thumb {
  width: 52px;
  height: 39px;
  border-radius: 6px;
  object-fit: cover;
  flex-shrink: 0;
}

.my-info {
  flex: 1;
  min-width: 0;
}

.my-title {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.my-status {
  margin-top: 5px;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
}

.status-pill.playing {
  background: var(--success-soft);
  color: var(--success);
}

.status-pill.pending {
  background: var(--warning-soft);
  color: var(--warning);
}

.cancel-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--danger-soft);
  border: none;
  color: var(--danger);
  font-size: 13px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.cancel-btn:hover {
  background: var(--danger);
  color: white;
}
</style>
