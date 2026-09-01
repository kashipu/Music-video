<script setup>
import { formatDuration, thumbFallback } from '../utils/youtube.js'

defineProps({
  queue: {
    type: Array,
    default: () => [],
  },
  queueLimit: {
    type: Number,
    default: 15,
  },
  dragIdx: {
    type: Number,
    default: null,
  },
  dropIdx: {
    type: Number,
    default: null,
  },
  loadingPlayNow: {
    type: Object,
    default: () => ({}),
  },
  loadingRemove: {
    type: Object,
    default: () => ({}),
  },
  loadingClearQueue: {
    type: Boolean,
    default: false,
  },
})

defineEmits([
  'clear-queue',
  'play-now',
  'remove-song',
  'load-more',
  'drag-start',
  'drag-over',
  'drag-leave',
  'drop',
  'drag-end',
])
</script>

<template>
  <div class="card">
    <div class="queue-header">
      <p class="section-title">COLA ({{ queue.length }})</p>
      <button
        v-if="queue.length"
        class="q-btn-label q-btn-remove clear-btn"
        @click="$emit('clear-queue')"
        :disabled="loadingClearQueue"
      >
        {{ loadingClearQueue ? 'Vaciando...' : 'Vaciar cola' }}
      </button>
    </div>
    <div class="q-list">
      <div
        v-for="(song, idx) in queue.slice(0, queueLimit)"
        :key="song.id"
        class="q-item"
        :class="{
          'q-dragging': dragIdx === idx,
          'q-drop-above': dropIdx === idx && dropIdx < dragIdx,
          'q-drop-below': dropIdx === idx && dropIdx > dragIdx,
        }"
        draggable="true"
        @dragstart="$emit('drag-start', idx, $event)"
        @dragover.prevent="$emit('drag-over', idx)"
        @dragleave="$emit('drag-leave')"
        @drop.prevent="$emit('drop', idx)"
        @dragend="$emit('drag-end')"
      >
        <div class="q-handle">&#9776;</div>
        <span class="q-pos">{{ idx + 1 }}</span>
        <img :src="song.thumbnail_url || `https://i.ytimg.com/vi/${song.youtube_id}/mqdefault.jpg`" class="q-thumb" @error="thumbFallback" />
        <div class="q-info">
          <p class="q-title">{{ song.title }}</p>
          <p class="q-meta">{{ song.user_name }} &middot; #{{ song.table_number }} &middot; {{ formatDuration(song.duration_sec) }}</p>
        </div>
        <button
          class="q-btn-label q-btn-play"
          @click="$emit('play-now', song.id)"
          :disabled="loadingPlayNow[song.id]"
        >
          {{ loadingPlayNow[song.id] ? '...' : '&#9654; Play' }}
        </button>
        <button
          class="q-btn-label q-btn-remove"
          @click="$emit('remove-song', song.id)"
          :disabled="loadingRemove[song.id]"
        >
          {{ loadingRemove[song.id] ? '...' : '&#10005; Quitar' }}
        </button>
      </div>
    </div>
    <button
      v-if="queue.length > queueLimit"
      class="load-more-btn"
      @click="$emit('load-more')"
    >
      Ver {{ Math.min(15, queue.length - queueLimit) }} más ({{ queue.length - queueLimit }} restantes)
    </button>
    <p v-if="!queue.length" class="text-muted">Cola vacía</p>
  </div>
</template>

<style scoped>
/* =========================================
   CSS GENERAL
   ========================================= */
.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
}

.queue-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.section-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-muted);
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.clear-btn {
  font-size: 11px;
}

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

.q-dragging {
  opacity: 0.3;
}

.q-drop-above {
  border-top: 2px solid var(--primary);
}

.q-drop-below {
  border-bottom: 2px solid var(--primary);
}

.q-handle {
  cursor: grab;
  font-size: 14px;
  color: var(--text-muted);
  flex-shrink: 0;
  opacity: 0.5;
  user-select: none;
}

.q-handle:hover {
  opacity: 1;
}

.q-pos {
  font-weight: 700;
  font-size: 13px;
  color: var(--text-muted);
  width: 20px;
  text-align: center;
  flex-shrink: 0;
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

.q-btn-play:hover {
  background: var(--success);
  color: #000;
  border-color: var(--success);
}

.q-btn-remove:hover {
  background: var(--danger);
  color: white;
  border-color: var(--danger);
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

.text-muted {
  color: var(--text-muted);
  font-size: 14px;
}

/* =========================================
   BREAKPOINT 900px
   ========================================= */
@media (max-width: 900px) {
  .q-item {
    padding: 10px 8px;
  }

  .q-handle {
    display: none;
  }

  .q-pos {
    display: none;
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
