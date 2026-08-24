<script setup>
import { computed } from 'vue'

const props = defineProps({
  maxDurationSec: { type: Number, default: 600 },
  maxSongs: { type: Number, default: 3 },
  windowMinutes: { type: Number, default: 20 },
})

const emit = defineEmits(['update:maxDurationSec', 'update:maxSongs', 'update:windowMinutes'])

const maxDurationMinutes = computed({
  get: () => props.maxDurationSec / 60,
  set: value => emit('update:maxDurationSec', Number(value) * 60),
})
</script>

<template>
  <div class="limits-grid">
    <div class="form-group">
      <label for="venue-max-duration">Máxima duración en minutos</label>
      <input id="venue-max-duration" v-model.number="maxDurationMinutes" type="number" class="input-field" min="1" max="120" />
      <small class="field-help">Cuánto puede durar cada canción que se reproduce en el bar.</small>
    </div>
    <div class="form-group">
      <label for="venue-max-songs">Canciones por ventana</label>
      <input id="venue-max-songs" :value="maxSongs" type="number" class="input-field" min="1" max="50" @input="emit('update:maxSongs', Number($event.target.value))" />
      <small class="field-help">Cuántas canciones puede pedir un mismo usuario dentro de la ventana de tiempo.</small>
    </div>
    <div class="form-group">
      <label for="venue-window-minutes">Ventana en minutos</label>
      <input id="venue-window-minutes" :value="windowMinutes" type="number" class="input-field" min="1" max="720" @input="emit('update:windowMinutes', Number($event.target.value))" />
      <small class="field-help">Cada cuántos minutos se reinicia ese límite de canciones por usuario.</small>
    </div>
  </div>
</template>

<style scoped>
/* =========================================
   CSS GENERAL
   ========================================= */
.limits-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
}

.field-help {
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.35;
}

/* =========================================
   BREAKPOINT 640px
   ========================================= */
@media (min-width: 640px) {
  .limits-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
  }
}

/* =========================================
   BREAKPOINT 360px
   ========================================= */
@media (max-width: 360px) {
  .limits-grid {
    gap: 10px;
  }
}
</style>
