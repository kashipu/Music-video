<script setup>
import { computed } from 'vue'
import FormField from './ui/FormField.vue'

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
    <FormField id="venue-max-duration" label="Máxima duración en minutos" hint="Cuánto puede durar cada canción que se reproduce en el bar." v-slot="{ id }"><input :id="id" v-model.number="maxDurationMinutes" type="number" class="input-field" min="1" max="120" /></FormField>
    <FormField id="venue-max-songs" label="Canciones por ventana" hint="Cuántas canciones puede pedir un mismo usuario dentro de la ventana de tiempo." v-slot="{ id }"><input :id="id" :value="maxSongs" type="number" class="input-field" min="1" max="50" @input="emit('update:maxSongs', Number($event.target.value))" /></FormField>
    <FormField id="venue-window-minutes" label="Ventana en minutos" hint="Cada cuántos minutos se reinicia ese límite de canciones por usuario." v-slot="{ id }"><input :id="id" :value="windowMinutes" type="number" class="input-field" min="1" max="720" @input="emit('update:windowMinutes', Number($event.target.value))" /></FormField>
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
