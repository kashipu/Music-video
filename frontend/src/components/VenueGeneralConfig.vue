<template>
  <Card title="CONFIGURACIÓN DEL BAR">
    <div class="form-stack">
      <FormField label="Nombre" v-slot="{ id }">
        <Input :id="id" v-model="editName" />
      </FormField>
      <FormField label="Logos del bar" hint="PNG, JPG o SVG. Máx. 2 MB por archivo. Si falta una variante, se usa la disponible.">
        <div class="logo-upload">
          <img v-if="editLogoUrlLight" :src="editLogoUrlLight.startsWith('/') ? API + editLogoUrlLight : editLogoUrlLight" class="logo-preview" alt="Vista previa para tema claro" />
          <div class="logo-actions">
            <label class="logo-btn">
              {{ uploadingLogo === 'light' ? 'Subiendo...' : 'Subir para tema claro' }}
              <input type="file" accept=".png,.jpg,.jpeg,.svg" hidden :disabled="!!uploadingLogo" aria-label="Subir logo para tema claro" @change="uploadLogo($event, 'light')" />
            </label>
            <p class="logo-hint">Se muestra sobre fondos claros.</p>
          </div>
        </div>
        <div class="logo-upload">
          <img v-if="editLogoUrlDark" :src="editLogoUrlDark.startsWith('/') ? API + editLogoUrlDark : editLogoUrlDark" class="logo-preview" alt="Vista previa para tema oscuro" />
          <div class="logo-actions">
            <label class="logo-btn">
              {{ uploadingLogo === 'dark' ? 'Subiendo...' : 'Subir para tema oscuro' }}
              <input type="file" accept=".png,.jpg,.jpeg,.svg" hidden :disabled="!!uploadingLogo" aria-label="Subir logo para tema oscuro" @change="uploadLogo($event, 'dark')" />
            </label>
            <p class="logo-hint">Se muestra sobre fondos oscuros.</p>
          </div>
        </div>
      </FormField>
      <FormField label="URL del QR (dejar vacío para automática)" v-slot="{ id }">
        <Input :id="id" v-model="editQrUrl" :placeholder="defaultQrUrl" />
      </FormField>
      <FormField label="Tema del bar">
        <div class="preset-grid">
          <div
            v-for="preset in THEME_PRESETS"
            :key="preset.id"
            class="preset-card"
            :class="{ selected: selectedPreset === preset.id }"
            role="button"
            :aria-pressed="selectedPreset === preset.id"
            tabindex="0"
            @click="selectedPreset = preset.id"
            @keydown.enter="selectedPreset = preset.id"
            @keydown.space.prevent="selectedPreset = preset.id"
          >
            <div class="preset-swatches">
              <div class="ps" :style="{ background: preset.colors.bg }" />
              <div class="ps ps-accent" :style="{ background: preset.accent }" />
              <div class="ps" :style="{ background: preset.colors.text }" />
            </div>
            <span class="preset-name">{{ preset.name }}</span>
            <span class="preset-mode">{{ preset.mode === 'dark' ? '&#9790;' : '&#9728;' }}</span>
          </div>
        </div>
      </FormField>
      <div class="form-row">
        <Button :disabled="saving" @click="saveVenue">
          {{ saving ? 'Guardando...' : 'Guardar cambios' }}
        </Button>
        <span v-if="saveMsg" class="save-msg">{{ saveMsg }}</span>
      </div>
    </div>
  </Card>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import Card from './ui/Card.vue'
import { THEME_PRESETS } from '../constants/themePresets.js'
import Button from './ui/Button.vue'
import Input from './ui/Input.vue'
import FormField from './ui/FormField.vue'
import { updateVenue, uploadVenueLogo } from '../services/superadmin.js'

const props = defineProps({
  venueId: { type: String, required: true },
  venue: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['refresh'])

const API = import.meta.env.VITE_API_URL || ''
const editName = ref('')
const editLogoUrlLight = ref('')
const editLogoUrlDark = ref('')
const uploadingLogo = ref('')
const editQrUrl = ref('')
const selectedPreset = ref('purple-night')
const saving = ref(false)
const saveMsg = ref('')

const defaultQrUrl = computed(() => {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/${props.venue?.slug || ''}/registro`
})

watch(() => props.venue, (v) => {
  if (!v) return
  editName.value = v.name || ''
  editLogoUrlLight.value = v.logo_url_light || ''
  editLogoUrlDark.value = v.logo_url_dark || ''
  editQrUrl.value = v.qr_url || ''
  try {
    const cfg = typeof v.config === 'string' ? JSON.parse(v.config || '{}') : (v.config || {})
    selectedPreset.value = cfg.theme?.preset || 'purple-night'
  } catch { /* */ }
}, { immediate: true, deep: true })

async function uploadLogo(event, variant) {
  const file = event.target.files?.[0]
  if (!file) return
  const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml']
  if (!allowed.includes(file.type)) {
    saveMsg.value = 'Solo PNG, JPG o SVG'
    return
  }
  if (file.size > 2 * 1024 * 1024) {
    saveMsg.value = 'Max 2MB'
    return
  }
  uploadingLogo.value = variant
  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('variant', variant)
    const res = await uploadVenueLogo(props.venueId, formData)
    if (res.ok) {
      const data = await res.json()
      if (variant === 'light') editLogoUrlLight.value = data.logo_url_light
      else editLogoUrlDark.value = data.logo_url_dark
      emit('refresh')
      saveMsg.value = `Logo para tema ${variant === 'light' ? 'claro' : 'oscuro'} actualizado`
      setTimeout(() => { saveMsg.value = '' }, 2000)
    } else {
      const err = await res.json().catch(() => ({}))
      saveMsg.value = err.detail || 'Error al subir logo'
    }
  } finally {
    uploadingLogo.value = ''
  }
}

async function saveVenue() {
  saving.value = true
  saveMsg.value = ''
  try {
    const p = THEME_PRESETS.find(t => t.id === selectedPreset.value) || THEME_PRESETS[0]
    const theme = { preset: p.id, accent: p.accent, mode: p.mode, bg: p.colors.bg, text: p.colors.text }
    if (p.tokens) theme.tokens = p.tokens
    const body = {
      name: editName.value,
      logo_url_light: editLogoUrlLight.value || null,
      logo_url_dark: editLogoUrlDark.value || null,
      qr_url: editQrUrl.value || null,
      theme,
    }
    const res = await updateVenue(props.venueId, body)
    if (res.ok) {
      saveMsg.value = 'Guardado'
      emit('refresh')
      setTimeout(() => { saveMsg.value = '' }, 2000)
    }
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
/* =========================================
   CSS GENERAL
   ========================================= */
.form-stack { display: flex; flex-direction: column; gap: 12px; }
.logo-upload { display: flex; align-items: center; gap: 16px; margin-top: 4px; }
.logo-preview { width: 64px; height: 64px; border-radius: var(--radius-sm, 8px); object-fit: cover; flex-shrink: 0; border: 1px solid var(--border); }
.logo-actions { display: flex; flex-direction: column; gap: 4px; }
.logo-btn { display: inline-flex; align-items: center; justify-content: center; padding: 8px 16px; font-size: 13px; font-weight: 600; border-radius: var(--radius-sm, 8px); background: var(--bg-elevated); border: 1px solid var(--border); color: var(--text); width: auto; cursor: pointer; transition: all 0.15s ease; }
.logo-btn:hover { border-color: var(--primary); color: var(--primary); }
.logo-hint { font-size: 11px; color: var(--text-muted); }
.preset-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
.preset-card { display: flex; align-items: center; gap: 8px; padding: 10px; border-radius: var(--radius-sm, 8px); background: var(--bg-elevated); border: 2px solid transparent; cursor: pointer; transition: all 0.15s ease; }
.preset-card:hover { border-color: var(--border); }
.preset-card.selected { border-color: var(--primary); background: var(--primary-soft); }
.preset-swatches { display: flex; gap: 3px; flex-shrink: 0; }
.ps { width: 18px; height: 18px; border-radius: 50%; border: 1px solid var(--border); }
.ps-accent { width: 22px; height: 22px; }
.preset-name { font-size: 12px; font-weight: 600; flex: 1; }
.preset-mode { font-size: 14px; }
.form-row { display: flex; align-items: center; gap: 12px; margin-top: 4px; }
.save-msg { font-size: 13px; color: var(--success); font-weight: 600; }

/* =========================================
   BREAKPOINT 850px
   ========================================= */
@media (min-width: 850px) {
  .card { padding: 20px; }
}

/* =========================================
   BREAKPOINT 360px
   ========================================= */
@media (max-width: 360px) {
  .preset-grid { grid-template-columns: 1fr; }
}
</style>

