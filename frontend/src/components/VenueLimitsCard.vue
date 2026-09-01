<template>
  <Card title="LÍMITES DE PEDIDOS">
    <VenueLimitsForm
      v-model:max-duration-sec="editConfig.max_duration_sec"
      v-model:max-songs="editConfig.max_songs_per_window"
      v-model:window-minutes="editConfig.window_minutes"
    />
    <FormError :message="configError" />
    <div class="form-row limits-actions">
      <Button :disabled="savingConfig" @click="saveConfig">
        {{ savingConfig ? 'Guardando...' : 'Guardar límites' }}
      </Button>
      <span v-if="configSaveMsg" class="save-msg">{{ configSaveMsg }}</span>
    </div>
  </Card>
</template>

<script setup>
import { ref, watch } from 'vue'
import Card from './ui/Card.vue'
import VenueLimitsForm from './VenueLimitsForm.vue'
import Button from './ui/Button.vue'
import FormError from './ui/FormError.vue'
import { updateVenue } from '../services/superadmin.js'

const props = defineProps({
  venueId: { type: String, required: true },
  config: { type: [Object, String], default: () => ({}) },
})

const emit = defineEmits(['refresh'])

const editConfig = ref({ max_duration_sec: 600, max_songs_per_window: 3, window_minutes: 20 })
const savingConfig = ref(false)
const configSaveMsg = ref('')
const configError = ref('')

watch(() => props.config, (cfgRaw) => {
  try {
    const cfg = typeof cfgRaw === 'string' ? JSON.parse(cfgRaw || '{}') : (cfgRaw || {})
    editConfig.value = {
      max_duration_sec: cfg.max_duration_sec != null ? Number(cfg.max_duration_sec) : 600,
      max_songs_per_window: cfg.max_songs_per_window != null ? Number(cfg.max_songs_per_window) : 3,
      window_minutes: cfg.window_minutes != null ? Number(cfg.window_minutes) : 20,
    }
  } catch { /* */ }
}, { immediate: true, deep: true })

async function saveConfig() {
  configError.value = ''
  configSaveMsg.value = ''

  const maxSongs = Number(editConfig.value.max_songs_per_window)
  const windowMins = Number(editConfig.value.window_minutes)
  const maxDuration = Number(editConfig.value.max_duration_sec)

  if (!Number.isInteger(maxSongs) || maxSongs < 1 || maxSongs > 50) {
    configError.value = 'Las canciones por ventana deben ser un número entero entre 1 y 50'
    return
  }
  if (!Number.isInteger(windowMins) || windowMins < 1 || windowMins > 720) {
    configError.value = 'Los minutos de ventana deben ser un número entero entre 1 y 720 (máx. 12 horas)'
    return
  }
  if (!Number.isInteger(maxDuration) || maxDuration < 30 || maxDuration > 7200) {
    configError.value = 'La duración máxima debe ser entre 30 y 7200 segundos (máx. 2 horas)'
    return
  }

  savingConfig.value = true
  try {
    const res = await updateVenue(props.venueId, {
      max_duration_sec: maxDuration,
      max_songs_per_window: maxSongs,
      window_minutes: windowMins,
    })
    if (res.ok) {
      configSaveMsg.value = 'Guardado'
      emit('refresh')
      setTimeout(() => { configSaveMsg.value = '' }, 2000)
    } else {
      const err = await res.json().catch(() => ({}))
      configError.value = err.detail || 'Error al guardar límites'
    }
  } catch (e) {
    configError.value = e.message || 'Error al guardar límites'
  } finally {
    savingConfig.value = false
  }
}
</script>

<style scoped>
/* =========================================
   CSS GENERAL
   ========================================= */
.form-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 4px;
}

.limits-actions {
  margin-top: 14px;
}

.save-msg {
  font-size: 13px;
  color: var(--success);
  font-weight: 600;
}

/* =========================================
   BREAKPOINT 850px
   ========================================= */
@media (min-width: 850px) {
  .card {
    padding: 20px;
  }
}

/* =========================================
   BREAKPOINT 360px
   ========================================= */
@media (max-width: 360px) {
  .form-row {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
