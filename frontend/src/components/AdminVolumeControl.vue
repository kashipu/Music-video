<script setup>
import Card from './ui/Card.vue'

defineProps({
  volume: {
    type: Number,
    default: 80,
  },
  muted: {
    type: Boolean,
    default: false,
  },
})

defineEmits(['update:volume', 'change', 'toggle-mute'])
</script>

<template>
  <Card class="volume-card">
    <div class="volume-row">
      <button class="mute-btn" :class="{ muted }" @click="$emit('toggle-mute')">
        <span class="mute-icon" v-if="muted">&#128263;</span>
        <span class="mute-icon" v-else-if="volume < 50">&#128265;</span>
        <span class="mute-icon" v-else>&#128266;</span>
        <span class="mute-text">{{ muted ? 'Unmute' : 'Mute' }}</span>
      </button>
      <input
        type="range"
        min="0"
        max="100"
        :value="volume"
        class="volume-slider"
        :disabled="muted"
        @input="e => { $emit('update:volume', Number(e.target.value)); $emit('change', Number(e.target.value)) }"
      />
      <span class="volume-value" :class="{ muted }">{{ muted ? 'MUTE' : volume + '%' }}</span>
    </div>
  </Card>
</template>

<style scoped>
/* =========================================
   CSS GENERAL
   ========================================= */
.volume-card {
  padding: 14px 16px;
}

.volume-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.mute-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 10px;
  font-size: 14px;
  flex-shrink: 0;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  color: var(--text);
  cursor: pointer;
}

.mute-icon {
  font-size: 20px;
}

.mute-text {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
}

.mute-btn.muted {
  background: var(--danger-soft);
  border-color: var(--danger);
  color: var(--danger);
}

.volume-value {
  font-size: 13px;
  font-weight: 700;
  color: var(--primary);
  min-width: 44px;
  text-align: right;
}

.volume-value.muted {
  color: var(--danger);
}

.volume-slider {
  flex: 1;
  height: 6px;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
  background: var(--bg-elevated);
  border-radius: 3px;
  cursor: pointer;
}

.volume-slider:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

/* Webkit (Safari, Chrome) track */
.volume-slider::-webkit-slider-runnable-track {
  height: 6px;
  border-radius: 3px;
  background: var(--bg-elevated);
}

/* Webkit thumb */
.volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  background: var(--primary);
  border-radius: 50%;
  cursor: pointer;
  margin-top: -7px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
}

/* Firefox track */
.volume-slider::-moz-range-track {
  height: 6px;
  border-radius: 3px;
  background: var(--bg-elevated);
  border: none;
}

/* Firefox thumb */
.volume-slider::-moz-range-thumb {
  width: 20px;
  height: 20px;
  background: var(--primary);
  border-radius: 50%;
  border: none;
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
}

/* =========================================
   BREAKPOINT 900px
   ========================================= */
@media (max-width: 900px) {
  .volume-row {
    flex-wrap: wrap;
  }

  .volume-slider {
    width: 100%;
    order: 3;
  }
}
</style>
