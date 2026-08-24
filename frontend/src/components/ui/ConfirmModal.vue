<script setup>
import { onMounted, onUnmounted, watch } from 'vue'
import { useConfirmModal } from '../../composables/useConfirmModal.js'
import Button from './Button.vue'

const { isOpen, modalOptions, handleConfirm, handleCancel } = useConfirmModal()

function handleKeydown(e) {
  if (e.key === 'Escape' && isOpen.value) {
    handleCancel()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

watch(isOpen, (val) => {
  if (val) {
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = ''
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="isOpen"
        class="modal-backdrop"
        role="dialog"
        aria-modal="true"
        :aria-label="modalOptions.title"
        @click.self="handleCancel"
      >
        <div class="modal-card">
          <div class="modal-header">
            <div class="icon-wrap" :class="{ 'icon-danger': modalOptions.danger }">
              <svg v-if="modalOptions.danger" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <svg v-else viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h3 class="modal-title">{{ modalOptions.title }}</h3>
          </div>

          <p v-if="modalOptions.message" class="modal-body">
            {{ modalOptions.message }}
          </p>

          <div class="modal-actions">
            <Button
              type="button"
              variant="secondary"
              class="action-btn"
              @click="handleCancel"
            >
              {{ modalOptions.cancelText || 'Cancelar' }}
            </Button>
            <Button
              type="button"
              :variant="modalOptions.danger ? 'danger' : 'primary'"
              class="action-btn"
              @click="handleConfirm"
            >
              {{ modalOptions.confirmText || 'Confirmar' }}
            </Button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* =========================================
   CSS GENERAL
   ========================================= */
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: rgba(4, 4, 7, 0.75);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.modal-card {
  width: 100%;
  max-width: 440px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg, 16px);
  padding: 24px;
  box-shadow: 0 16px 32px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.modal-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.icon-wrap {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--bg-elevated);
  color: var(--primary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.icon-danger {
  background: var(--danger-soft);
  color: var(--danger);
}

.modal-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
}

.modal-body {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-muted);
  word-break: break-word;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 8px;
}

.action-btn {
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
}

/* Animations */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-active .modal-card {
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.modal-fade-enter-from .modal-card {
  transform: scale(0.95);
}

/* =========================================
   BREAKPOINT 640px
   ========================================= */
@media (min-width: 640px) {
  .modal-card {
    padding: 24px;
  }
}

/* =========================================
   BREAKPOINT 360px
   ========================================= */
@media (max-width: 360px) {
  .modal-card {
    padding: 16px;
  }

  .modal-actions {
    flex-direction: column-reverse;
  }

  .action-btn {
    width: 100%;
  }
}
</style>
