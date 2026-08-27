<script setup>
import NowPlaying from './NowPlaying.vue'

defineProps({
  nowPlaying: {
    type: Object,
    default: null,
  },
  fallbackSongs: {
    type: Array,
    default: () => [],
  },
  playbackStatus: {
    type: String,
    default: 'playing',
  },
  queueLength: {
    type: Number,
    default: 0,
  },
  loadingPause: {
    type: Boolean,
    default: false,
  },
  loadingResume: {
    type: Boolean,
    default: false,
  },
  loadingSkip: {
    type: Boolean,
    default: false,
  },
  loadingFallbackSkip: {
    type: Boolean,
    default: false,
  },
  loadingStart: {
    type: Boolean,
    default: false,
  },
})

defineEmits(['pause', 'resume', 'next', 'start'])
</script>

<template>
  <NowPlaying
    :song="nowPlaying"
    :fallback="!nowPlaying && fallbackSongs.length > 0"
    :playback-status="playbackStatus"
    :queue-length="queueLength"
  >
    <template #controls>
      <button
        v-if="playbackStatus === 'playing'"
        class="ctrl-labeled ctrl-pause"
        @click="$emit('pause')"
        :disabled="loadingPause"
      >
        <span class="ctrl-icon">&#10074;&#10074;</span>
        <span class="ctrl-text">{{ loadingPause ? '...' : 'Pausar' }}</span>
      </button>
      <button
        v-else
        class="ctrl-labeled ctrl-play"
        @click="$emit('resume')"
        :disabled="loadingResume"
      >
        <span class="ctrl-icon">&#9654;</span>
        <span class="ctrl-text">{{ loadingResume ? '...' : 'Reanudar' }}</span>
      </button>
      <button
        class="ctrl-labeled ctrl-skip"
        @click="$emit('next')"
        :disabled="loadingSkip || loadingFallbackSkip"
      >
        <span class="ctrl-icon">&#9197;</span>
        <span class="ctrl-text">{{ (loadingSkip || loadingFallbackSkip) ? '...' : 'Siguiente' }}</span>
      </button>
    </template>

    <template #empty>
      <p class="empty-text" v-if="!queueLength">Sin reproducción &mdash; agrega una canción</p>
      <div v-else class="np-start">
        <p class="empty-text">{{ queueLength }} {{ queueLength === 1 ? 'canción en cola' : 'canciones en cola' }}</p>
        <button
          class="ctrl-btn-lg ctrl-play"
          @click="$emit('start')"
          :disabled="loadingStart"
        >
          {{ loadingStart ? 'Iniciando...' : '&#9654; REPRODUCIR' }}
        </button>
      </div>
    </template>
  </NowPlaying>
</template>

<style scoped>
/* =========================================
   CSS GENERAL
   ========================================= */
.ctrl-btn-lg {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 32px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 700;
  border: 2px solid;
  background: var(--success-soft);
  border-color: var(--success);
  color: var(--success);
  cursor: pointer;
  transition: all 0.15s;
}

.ctrl-btn-lg:hover {
  background: var(--success);
  color: #000;
}

.ctrl-labeled {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 20px;
  border-radius: 12px;
  font-weight: 700;
  border: 2px solid;
  transition: all 0.15s;
  min-width: 88px;
  cursor: pointer;
}

.ctrl-icon {
  font-size: 20px;
}

.ctrl-text {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.ctrl-pause {
  background: var(--warning-soft);
  border-color: var(--warning);
  color: var(--warning);
}

.ctrl-pause .ctrl-icon {
  font-size: 14px;
  letter-spacing: -2px;
}

.ctrl-pause:hover {
  background: var(--warning);
  color: #000;
}

.ctrl-play {
  background: var(--success-soft);
  border-color: var(--success);
  color: var(--success);
}

.ctrl-play:hover {
  background: var(--success);
  color: #000;
}

.ctrl-skip {
  background: var(--primary-soft);
  border-color: var(--primary);
  color: var(--primary);
}

.ctrl-skip:hover {
  background: var(--primary);
  color: white;
}

.empty-text {
  color: var(--text-muted);
  font-size: 14px;
}

.np-start {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

/* =========================================
   BREAKPOINT 900px
   ========================================= */
@media (max-width: 900px) {
  .ctrl-labeled {
    flex: 1;
    min-width: 0;
  }
}
</style>
