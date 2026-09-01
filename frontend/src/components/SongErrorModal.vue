<script setup>
import FormError from './ui/FormError.vue'

defineProps({
  error: {
    type: Object,
    default: null,
  },
})

defineEmits(['dismiss'])
</script>

<template>
  <Transition name="fade">
    <div v-if="error" class="error-overlay" @click.self="$emit('dismiss')">
      <div class="error-modal">
        <div class="error-icon">&#9888;</div>
        <p class="error-title">No se pudo reproducir</p>
        <p class="error-song-name">{{ error.title }}</p>
        <FormError message="Este video tiene restricciones de derechos de autor y no puede reproducirse en este momento." />
        <p class="error-hint">Busca otra version o una cancion diferente. Tu turno fue liberado.</p>
        <button type="button" class="error-btn" @click="$emit('dismiss')">Buscar otra cancion</button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* =========================================
   CSS GENERAL
   ========================================= */
.error-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  -webkit-backdrop-filter: blur(4px);
  backdrop-filter: blur(4px);
}

.error-modal {
  background: var(--bg-card);
  border-radius: 16px;
  padding: 28px 24px;
  max-width: 340px;
  width: 100%;
  text-align: center;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.error-icon {
  font-size: 40px;
  margin-bottom: 8px;
  color: var(--warning);
}

.error-title {
  font-size: 17px;
  font-weight: 700;
  margin-bottom: 6px;
}

.error-song-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-muted);
  margin-bottom: 14px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.error-hint {
  font-size: 13px;
  color: var(--success);
  font-weight: 600;
  margin-bottom: 20px;
}

.error-btn {
  width: 100%;
  padding: 13px;
  border: none;
  border-radius: 10px;
  background: var(--primary);
  color: white;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s;
}

.error-btn:active {
  opacity: 0.8;
}
</style>
