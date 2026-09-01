<script setup>
import Card from './ui/Card.vue'

defineProps({
  played: {
    type: Array,
    default: () => [],
  },
  playedLimit: {
    type: Number,
    default: 15,
  },
  fallbackYoutubeIds: {
    type: Object,
    default: () => new Set(),
  },
  loadingAddFromLib: {
    type: Object,
    default: () => ({}),
  },
  loadingAddToFallback: {
    type: Object,
    default: () => ({}),
  },
})

defineEmits(['requeue-song', 'add-to-fallback', 'load-more'])
</script>

<template>
  <Card :title="`YA SONARON (${played.length})`">
    <div class="q-list" v-if="played.length">
      <div v-for="song in played.slice(0, playedLimit)" :key="song.id" class="q-item q-item-played">
        <img :src="`https://i.ytimg.com/vi/${song.youtube_id}/mqdefault.jpg`" class="q-thumb" />
        <div class="q-info">
          <p class="q-title">{{ song.title }}</p>
          <p class="q-meta">{{ song.user_name }} &middot; {{ song.played_at_label }}</p>
        </div>
        <button
          class="q-btn-label q-btn-requeue"
          @click="$emit('requeue-song', song.youtube_id)"
          :disabled="loadingAddFromLib[song.youtube_id]"
        >
          {{ loadingAddFromLib[song.youtube_id] ? '...' : '&#8634; Encolar' }}
        </button>
        <button
          class="q-btn-label q-btn-fallback"
          @click="$emit('add-to-fallback', song.youtube_id)"
          :disabled="fallbackYoutubeIds.has(song.youtube_id) || loadingAddToFallback[song.youtube_id]"
          :title="fallbackYoutubeIds.has(song.youtube_id) ? 'Ya en playlist' : 'Agregar a playlist de respaldo'"
        >
          {{ loadingAddToFallback[song.youtube_id] ? '...' : fallbackYoutubeIds.has(song.youtube_id) ? '&#10003;' : '+ Respaldo' }}
        </button>
      </div>
    </div>
    <button
      v-if="played.length > playedLimit"
      class="load-more-btn"
      @click="$emit('load-more')"
    >
      Ver {{ Math.min(15, played.length - playedLimit) }} más ({{ played.length - playedLimit }} restantes)
    </button>
    <p v-if="!played.length" class="text-muted">Sin historial de hoy</p>
  </Card>
</template>

<style scoped>
/* =========================================
   CSS GENERAL
   ========================================= */
.q-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.q-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--bg-elevated);
  border: 1px solid transparent;
  transition: all 0.2s;
}

.q-item:hover {
  border-color: var(--border);
}

.q-item-played {
  opacity: 0.7;
}

.q-item-played:hover {
  opacity: 1;
}

.q-thumb {
  width: 48px;
  height: 36px;
  border-radius: 4px;
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
}

.q-btn-label {
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  border: 1px solid var(--border);
  background: var(--bg-card);
  color: var(--text-muted);
  flex-shrink: 0;
  transition: all 0.15s;
  cursor: pointer;
}

.q-btn-requeue:hover {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

.q-btn-fallback {
  border-color: var(--secondary);
  color: var(--secondary);
}

.q-btn-fallback:hover:not(:disabled) {
  background: var(--secondary);
  color: #000;
}

.q-btn-fallback:disabled {
  opacity: 0.5;
  cursor: default;
}

.load-more-btn {
  width: 100%;
  padding: 10px;
  margin-top: 8px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--primary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.load-more-btn:hover {
  background: var(--primary-soft);
}

/* =========================================
   BREAKPOINT 900px
   ========================================= */
@media (max-width: 900px) {
  .q-item {
    padding: 10px 8px;
  }

  .q-thumb {
    width: 40px;
    height: 30px;
  }

  .q-btn-label {
    font-size: 10px;
    padding: 3px 8px;
  }
}

/* =========================================
   BREAKPOINT 480px
   ========================================= */
@media (max-width: 480px) {
  .q-item {
    gap: 6px;
  }

  .q-info {
    font-size: 12px;
  }

  .q-title {
    font-size: 12px;
  }

  .q-meta {
    font-size: 10px;
  }

  .q-btn-label {
    font-size: 9px;
    padding: 2px 6px;
  }
}
</style>
