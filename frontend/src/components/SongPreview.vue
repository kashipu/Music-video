<script setup>
import { formatDuration } from '../utils/youtube.js'

const props = defineProps({
  preview: { type: Object, required: true },
})

const emit = defineEmits(['confirm', 'cancel'])
</script>

<template>
  <div class="card preview-card" style="margin-top: 16px;">
    <p class="preview-question">Quieres encolar esta cancion?</p>

    <div class="preview-content">
      <img :src="preview.thumbnail_url" class="preview-thumb" />
      <div class="preview-info">
        <p class="preview-title">{{ preview.title }}</p>
        <p class="preview-duration">Duracion: {{ preview.duration_formatted || formatDuration(preview.duration_sec) }}</p>
      </div>
    </div>

    <div v-if="preview.recently_played_by_user" class="repeat-warning">
      Ya pediste esta cancion hace {{ preview.recently_played_minutes_ago }} minutos. Seguro que quieres repetirla?
    </div>

    <div class="preview-actions">
      <button class="btn btn-secondary" @click="emit('cancel')">Cancelar</button>
      <button class="btn btn-primary" @click="emit('confirm', preview.youtube_id)">Confirmar</button>
    </div>
  </div>
</template>

<style scoped>
.preview-card {
  border: 1px solid var(--primary);
}
.preview-question {
  font-weight: 600;
  font-size: 16px;
  margin-bottom: 12px;
}
.preview-content {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 12px;
  min-width: 0;
}
.preview-thumb {
  width: 100px;
  height: 75px;
  border-radius: 8px;
  object-fit: cover;
  flex-shrink: 0;
}
.preview-title {
  font-weight: 600;
  font-size: 15px;
  line-height: 1.3;
}
.preview-duration {
  font-size: 13px;
  color: var(--text-muted);
  margin-top: 4px;
}
.repeat-warning {
  background: rgba(254, 202, 87, 0.15);
  border: 1px solid var(--warning);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  font-size: 13px;
  color: var(--warning);
  margin-bottom: 12px;
}
.preview-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
</style>
