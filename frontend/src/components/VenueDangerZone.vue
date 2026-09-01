<template>
  <Card title="ZONA DE PELIGRO" class="danger-card">
    <div class="danger-actions">
      <button class="btn-venue-toggle" @click="toggleVenue">
        {{ active ? 'Desactivar bar' : 'Activar bar' }}
      </button>
      <button class="btn-delete" @click="handleDeleteVenue">
        Eliminar bar permanentemente
      </button>
    </div>
  </Card>
</template>

<script setup>
import { useRouter } from 'vue-router'
import Card from './ui/Card.vue'
import { useConfirmModal } from '../composables/useConfirmModal.js'
import { deleteVenue, updateVenue } from '../services/superadmin.js'

const props = defineProps({
  venueId: { type: String, required: true },
  active: { type: Boolean, default: true },
})

const emit = defineEmits(['refresh'])
const router = useRouter()
const { confirm } = useConfirmModal()

async function toggleVenue() {
  await updateVenue(props.venueId, { active: !props.active })
  emit('refresh')
}

async function handleDeleteVenue() {
  const ok = await confirm({
    title: 'Eliminar bar',
    message: '¿ELIMINAR PERMANENTEMENTE este bar y todos sus datos? Esta acción es irreversible.',
    danger: true,
    confirmText: 'Eliminar bar',
  })
  if (!ok) return
  await deleteVenue(props.venueId)
  router.push({ name: 'superadmin' })
}
</script>

<style scoped>
/* =========================================
   CSS GENERAL
   ========================================= */
.danger-card {
  border-color: var(--danger-soft);
}

.danger-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.btn-venue-toggle {
  width: 100%;
  padding: 10px;
  border-radius: var(--radius-sm, 8px);
  background: var(--bg-elevated);
  border: 1px solid var(--warning);
  color: var(--warning);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-venue-toggle:hover {
  background: var(--warning);
  color: var(--bg);
}

.btn-delete {
  width: 100%;
  padding: 10px;
  border-radius: var(--radius-sm, 8px);
  background: var(--danger-soft);
  border: 1px solid var(--danger);
  color: var(--danger);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-delete:hover {
  background: var(--danger);
  color: var(--text-on-primary, #FFFFFF);
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
  .btn-venue-toggle,
  .btn-delete {
    font-size: 12px;
    padding: 8px;
  }
}
</style>
