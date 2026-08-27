<template>
  <div class="card">
    <p class="section-title">CONFIGURACIÓN DEL BAR</p>
    <form class="form-stack" @submit.prevent="saveVenue">
      <FormField id="venue-name" label="Nombre">
        <Input id="venue-name" v-model="editName" required />
      </FormField>
      <div class="logo-config-section">
        <label class="field-label">Logos del bar</label>
        <div class="logo-preview-row">
          <div class="logo-preview-box">
            <span class="preview-box-label">Tema claro</span>
            <div class="logo-canvas canvas-light">
              <VenueLogo :url="editLogoUrlLight" :name="editName" variant="light" size="large" />
            </div>
            <label class="btn-subir-logo" :class="{ disabled: uploadingLogo }">
              <input type="file" accept="image/*" class="file-input-hidden" @change="uploadLogo($event, 'light')" />
              {{ uploadingLogo && uploadingVariant === 'light' ? 'Subiendo...' : (editLogoUrlLight ? 'Cambiar logo' : 'Subir logo') }}
            </label>
          </div>
          <div class="logo-preview-box">
            <span class="preview-box-label">Tema oscuro</span>
            <div class="logo-canvas canvas-dark">
              <VenueLogo :url="editLogoUrlDark" :name="editName" variant="dark" size="large" />
            </div>
            <label class="btn-subir-logo" :class="{ disabled: uploadingLogo }">
              <input type="file" accept="image/*" class="file-input-hidden" @change="uploadLogo($event, 'dark')" />
              {{ uploadingLogo && uploadingVariant === 'dark' ? 'Subiendo...' : (editLogoUrlDark ? 'Cambiar logo' : 'Subir logo') }}
            </label>
          </div>
        </div>
        <span class="field-hint">PNG, JPG, SVG o WebP. Máximo 2MB.</span>
      </div>
      <FormField id="venue-qr" label="URL del QR">
        <Input
          id="venue-qr"
          v-model="editQrUrl"
          :placeholder="`Por defecto: ${appUrl}/v/${venue?.slug || ''}`"
        />
      </FormField>
      <div class="field-group">
        <label class="field-label">Tema del bar</label>
        <div class="preset-grid">
          <button
            v-for="p in THEME_PRESETS"
            :key="p.id"
            type="button"
            class="preset-card"
            :class="{ selected: selectedPreset === p.id }"
            @click="applyPreset(p)"
          >
            <div class="preset-swatches">
              <span class="swatch" :style="{ background: p.theme.primary_color }" />
              <span class="swatch" :style="{ background: p.theme.accent_color }" />
              <span class="swatch" :style="{ background: p.theme.bg_dark }" />
            </div>
            <span class="preset-name">{{ p.name }}</span>
          </button>
        </div>
      </div>
      <div class="btn-row">
        <Button variant="primary" type="submit">Guardar cambios</Button>
        <span v-if="saveMsg" class="save-msg">{{ saveMsg }}</span>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import Button from './ui/Button.vue'
import FormField from './ui/FormField.vue'
import Input from './ui/Input.vue'
import VenueLogo from './VenueLogo.vue'
import { updateVenue, uploadVenueLogo } from '../services/superadmin.js'

const THEME_PRESETS = [
  {
    id: 'indigo',
    name: 'Índigo (Por defecto)',
    theme: { primary_color: '#6366f1', accent_color: '#818cf8', bg_dark: '#0f172a' },
  },
  {
    id: 'amber',
    name: 'Ámbar Cálido',
    theme: { primary_color: '#f59e0b', accent_color: '#fbbf24', bg_dark: '#1c1917' },
  },
  {
    id: 'emerald',
    name: 'Esmeralda',
    theme: { primary_color: '#10b981', accent_color: '#34d399', bg_dark: '#064e3b' },
  },
  {
    id: 'rose',
    name: 'Rosa Neón',
    theme: { primary_color: '#f43f5e', accent_color: '#fb7185', bg_dark: '#18181b' },
  },
  {
    id: 'violet',
    name: 'Violeta Eléctrico',
    theme: { primary_color: '#8b5cf6', accent_color: '#a78bfa', bg_dark: '#1e1b4b' },
  },
  {
    id: 'cyan',
    name: 'Cian Futurista',
    theme: { primary_color: '#06b6d4', accent_color: '#22d3ee', bg_dark: '#083344' },
  },
]

const props = defineProps({
  venueId: { type: String, required: true },
  venue: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['refresh'])

const editName = ref('')
const editLogoUrlLight = ref('')
const editLogoUrlDark = ref('')
const editQrUrl = ref('')
const selectedPreset = ref('indigo')
const editTheme = ref({})
const uploadingLogo = ref(false)
const uploadingVariant = ref(null)
const saveMsg = ref('')

const appUrl = computed(() => (typeof window !== 'undefined' ? window.location.origin : ''))

function initFromVenue(v) {
  if (!v) return
  editName.value = v.name || ''
  editLogoUrlLight.value = v.logo_url_light || ''
  editLogoUrlDark.value = v.logo_url_dark || ''
  editQrUrl.value = v.qr_url || ''
  const t = v.theme || {}
  editTheme.value = { ...t }
  const match = THEME_PRESETS.find(p => p.theme.primary_color === t.primary_color)
  selectedPreset.value = match ? match.id : 'custom'
}

watch(() => props.venue, initFromVenue, { immediate: true, deep: true })

function applyPreset(preset) {
  selectedPreset.value = preset.id
  editTheme.value = { ...preset.theme }
}

async function uploadLogo(event, variant) {
  const file = event.target.files?.[0]
  if (!file) return
  uploadingLogo.value = true
  uploadingVariant.value = variant
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
  } catch {
    saveMsg.value = 'Error de conexión al subir logo'
  } finally {
    uploadingLogo.value = false
    uploadingVariant.value = null
  }
}

async function saveVenue() {
  const body = {
    name: editName.value,
    logo_url_light: editLogoUrlLight.value,
    logo_url_dark: editLogoUrlDark.value,
    qr_url: editQrUrl.value || null,
    theme: editTheme.value,
  }
  const res = await updateVenue(props.venueId, body)
  if (res.ok) {
    saveMsg.value = 'Guardado'
    emit('refresh')
    setTimeout(() => { saveMsg.value = '' }, 2000)
  }
}
</script>

<style scoped>
/* =========================================
   CSS GENERAL
   ========================================= */
.card {
  background: var(--bg-card, #1e293b);
  border: 1px solid var(--border-color, #334155);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--text-muted, #64748b);
  text-transform: uppercase;
}

.form-stack {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.field-label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary, #94a3b8);
  margin-bottom: 6px;
}

.field-hint {
  font-size: 12px;
  color: var(--text-muted, #64748b);
  display: block;
}

.logo-config-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.logo-preview-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.logo-preview-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preview-box-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary, #94a3b8);
}

.logo-canvas {
  height: 80px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  border: 1px dashed var(--border-color, #334155);
  overflow: hidden;
}

.canvas-light {
  background: #ffffff;
}

.canvas-dark {
  background: #0f172a;
}

.btn-subir-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 6px;
  background: var(--bg-hover, #334155);
  color: var(--text-primary, #f8fafc);
  cursor: pointer;
  text-align: center;
  transition: background 0.15s;
}

.btn-subir-logo:hover {
  background: var(--border-color, #475569);
}

.btn-subir-logo.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.file-input-hidden {
  display: none;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preset-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.preset-card {
  background: var(--bg-hover, #0f172a);
  border: 1px solid var(--border-color, #334155);
  border-radius: 8px;
  padding: 10px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-start;
  transition: border-color 0.15s;
}

.preset-card:hover {
  border-color: var(--color-primary, #6366f1);
}

.preset-card.selected {
  border-color: var(--color-primary, #6366f1);
  background: rgba(99, 102, 241, 0.08);
}

.preset-swatches {
  display: flex;
  gap: 4px;
}

.swatch {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  display: inline-block;
}

.preset-name {
  font-size: 12px;
  color: var(--text-secondary, #94a3b8);
}

.btn-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.save-msg {
  font-size: 13px;
  color: var(--color-success, #22c55e);
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
  .preset-grid {
    grid-template-columns: 1fr;
  }
}
</style>
