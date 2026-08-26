<script setup>
import { computed } from 'vue'
import { formatDuration, thumbFallback, getThumbnailUrl } from '../utils/youtube.js'

const props = defineProps({
  song: { type: Object, default: null },
  mine: { type: Boolean, default: false },
  fallback: { type: Boolean, default: false },
  playbackStatus: { type: String, default: 'playing' },
  queueLength: { type: Number, default: 0 },
})

const isFallback = computed(() => props.fallback || !!props.song?.is_fallback)

const thumb = computed(() => {
  if (props.song?.thumbnail_url) return props.song.thumbnail_url
  if (props.song?.youtube_id) return getThumbnailUrl(props.song.youtube_id)
  return ''
})

const headerLabel = computed(() => {
  if (isFallback.value) {
    return props.playbackStatus === 'playing' ? 'PLAYLIST DE RESPALDO' : 'PAUSADO'
  }
  if (props.mine) {
    return 'TU CANCIÓN SUENA'
  }
  return 'SONANDO AHORA'
})

const displayTitle = computed(() => {
  if (isFallback.value && !props.song?.title) {
    return 'Sonando automáticamente'
  }
  return props.song?.title || ''
})

const displayMeta = computed(() => {
  if (isFallback.value) {
    if (props.queueLength) {
      return `${props.queueLength} ${props.queueLength === 1 ? 'canción en cola' : 'canciones en cola'}`
    }
    return ''
  }
  if (!props.song) return ''
  if (props.song.user_name && props.song.table_number !== undefined) {
    return `${props.song.user_name} · #${props.song.table_number}`
  }
  if (props.song.duration_sec && props.song.added_by) {
    return `${formatDuration(props.song.duration_sec)} · Pedida por ${props.song.added_by}`
  }
  if (props.song.added_by) {
    return `por ${props.song.added_by}`
  }
  if (props.song.duration_sec) {
    return formatDuration(props.song.duration_sec)
  }
  return ''
})
</script>

<template>
  <div
    v-if="song || fallback"
    class="card now-playing np-card"
    :class="{
      'np-mine': mine,
      'np-fallback': isFallback && playbackStatus === 'playing',
      'np-fallback-paused': isFallback && playbackStatus === 'paused',
    }"
  >
    <div class="np-left np-content">
      <div v-if="isFallback && !thumb" class="np-fallback-icon">
        <span v-if="playbackStatus === 'playing'">&#9835;</span>
        <span v-else>&#9646;&#9646;</span>
      </div>
      <img
        v-else-if="thumb"
        :src="thumb"
        class="np-thumb"
        @error="thumbFallback"
      />
      <div class="np-info">
        <div class="np-label-row">
          <span class="np-dot" v-if="mine || !isFallback"></span>
          <p class="section-title np-label">{{ headerLabel }}</p>
        </div>
        <p class="np-title">{{ displayTitle }}</p>
        <p class="np-meta" v-if="displayMeta">{{ displayMeta }}</p>
      </div>
    </div>

    <!-- Optional controls slot (e.g. for admin) -->
    <div class="np-controls" v-if="$slots.controls">
      <slot name="controls" />
    </div>
  </div>

  <div v-else class="card now-playing-empty np-empty">
    <slot name="empty">
      <p class="section-title">Sonando Ahora</p>
      <p class="empty-text np-empty-text">No hay nada sonando. Pide una canción!</p>
    </slot>
  </div>
</template>

<style scoped>
.now-playing {
  margin-top: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-left: 3px solid var(--primary);
}
.np-mine {
  border-left-color: var(--success);
  border-color: var(--success);
  background: linear-gradient(135deg, color-mix(in srgb, var(--success) 8%, var(--bg-card)), var(--bg-card));
}
.np-fallback {
  border-left-color: var(--warning);
}
.np-fallback-paused {
  border-left-color: var(--border);
  opacity: 0.8;
}
.now-playing-empty {
  margin-top: 16px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
  text-align: center;
}
.now-playing-empty .section-title {
  margin-bottom: 8px;
}
.np-content {
  display: flex;
  gap: 12px;
  align-items: center;
  flex: 1;
  min-width: 0;
}
.np-thumb {
  width: 80px;
  height: 60px;
  border-radius: 6px;
  object-fit: cover;
  flex-shrink: 0;
}
.np-info {
  flex: 1;
  min-width: 0;
}
.np-label-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}
.np-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--primary);
  animation: pulse 2s infinite;
}
.np-mine .np-dot {
  background: var(--success);
}
.section-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--text-muted);
  margin-bottom: 0;
}
.np-mine .section-title {
  color: var(--success);
}
.np-title {
  font-weight: 600;
  font-size: 15px;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.np-meta {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
}
.np-fallback-icon {
  font-size: 32px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 60px;
}
.np-controls {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
.empty-text {
  color: var(--text-muted);
  font-size: 14px;
}
.np-start {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
    box-shadow: 0 0 0 0 var(--primary-soft);
  }
  50% {
    opacity: 0.6;
    box-shadow: 0 0 0 5px rgba(0, 0, 0, 0);
  }
}

@media (max-width: 768px) {
  .now-playing {
    flex-direction: column;
    align-items: stretch;
  }
  .np-controls {
    justify-content: center;
    flex-wrap: wrap;
  }
}
</style>
