<script setup>
import { formatDuration, thumbFallback } from '../utils/youtube.js'

defineProps({
  fallbackSongs: {
    type: Array,
    default: () => [],
  },
  fallbackPaused: {
    type: Boolean,
    default: false,
  },
  nowPlaying: {
    type: Object,
    default: null,
  },
  queueLength: {
    type: Number,
    default: 0,
  },
  loadingFallbackPlay: {
    type: Boolean,
    default: false,
  },
  loadingFallbackToggle: {
    type: Boolean,
    default: false,
  },
  loadingDeleteFallback: {
    type: Object,
    default: () => ({}),
  },
})

defineEmits(['play-now', 'toggle-fallback', 'delete-song'])
</script>

<template>
  <div class="card">
    <div class="fb-header">
      <p class="section-title">PLAYLIST DE RESPALDO ({{ fallbackSongs.length }})</p>
      <div class="fb-btns" v-if="fallbackSongs.length">
        <button
          class="fb-toggle fb-play-now"
          @click="$emit('play-now')"
          v-if="!nowPlaying && queueLength === 0"
          :disabled="loadingFallbackPlay"
        >
          {{ loadingFallbackPlay ? '...' : '&#9654; Reproducir' }}
        </button>
        <button
          class="fb-toggle"
          :class="fallbackPaused ? 'fb-paused' : 'fb-playing'"
          @click="$emit('toggle-fallback')"
          :disabled="loadingFallbackToggle"
        >
          {{ loadingFallbackToggle ? '...' : (fallbackPaused ? '&#9654; Activar' : '&#10074;&#10074; Pausar') }}
        </button>
      </div>
    </div>
    <p class="text-hint">
      {{ fallbackPaused ? 'Playlist pausada — no suena cuando la cola está vacía' : 'Suena automáticamente cuando no hay canciones de las mesas' }}
    </p>
    <div class="fb-scroll" v-if="fallbackSongs.length">
      <div v-for="song in fallbackSongs" :key="song.id" class="q-item" :class="{ 'q-item-played': !song.active }">
        <img :src="song.thumbnail_url" class="q-thumb" @error="thumbFallback" />
        <div class="q-info">
          <p class="q-title">{{ song.title }}</p>
          <p class="q-meta">{{ formatDuration(song.duration_sec) }}</p>
        </div>
        <button
          class="q-btn-label q-btn-remove"
          @click="$emit('delete-song', song.id)"
          :disabled="loadingDeleteFallback[song.id]"
          title="Eliminar de la playlist"
        >
          {{ loadingDeleteFallback[song.id] ? '...' : '&#10005; Quitar' }}
        </button>
      </div>
    </div>
    <p v-else class="text-muted">Sin playlist. Configúrala desde el Super Admin.</p>
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

.section-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-muted);
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.fb-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.fb-header .section-title {
  margin-bottom: 0;
}

.fb-btns {
  display: flex;
  gap: 6px;
}

.fb-toggle {
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid;
  cursor: pointer;
  transition: all 0.15s;
}

.fb-play-now {
  background: var(--success-soft);
  border-color: var(--success);
  color: var(--success);
}

.fb-play-now:hover {
  background: var(--success);
  color: #000;
}

.fb-playing {
  background: var(--warning-soft);
  border-color: var(--warning);
  color: var(--warning);
}

.fb-playing:hover {
  background: var(--warning);
  color: #000;
}

.fb-paused {
  background: var(--success-soft);
  border-color: var(--success);
  color: var(--success);
}

.fb-paused:hover {
  background: var(--success);
  color: #000;
}

.text-hint {
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 10px;
}

.fb-scroll {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 250px;
  overflow-y: auto;
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

.q-btn-remove:hover {
  background: var(--danger);
  color: white;
  border-color: var(--danger);
}

.text-muted {
  color: var(--text-muted);
  font-size: 14px;
}

/* =========================================
   BREAKPOINT 900px
   ========================================= */
@media (max-width: 900px) {
  .fb-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .fb-btns {
    width: 100%;
  }

  .fb-toggle {
    flex: 1;
    text-align: center;
  }

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
