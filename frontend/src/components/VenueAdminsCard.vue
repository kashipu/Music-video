<template>
  <div class="card">
    <p class="section-title">ADMINISTRADORES DEL BAR</p>
    <div class="admin-list">
      <div v-for="a in admins" :key="a.id" class="admin-item">
        <span class="admin-name">{{ a.username }}</span>
        <button class="v-btn v-btn-danger" :aria-label="`Quitar administrador ${a.username}`" @click="handleRemoveAdmin(a.id)">Quitar</button>
      </div>
      <p v-if="!admins?.length" class="text-muted">Sin administradores asignados.</p>
    </div>
    <div class="add-row">
      <Input v-model="newAdmin.username" placeholder="Usuario..." aria-label="Usuario nuevo administrador" />
      <PasswordInput v-model="newAdmin.password" placeholder="Contraseña..." aria-label="Contraseña nuevo administrador" />
      <Button class="add-btn" :disabled="adding" @click="handleAddAdmin">
        {{ adding ? 'Agregando...' : 'Agregar' }}
      </Button>
    </div>
    <p v-if="adminError" class="admin-error">{{ adminError }}</p>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import Input from './ui/Input.vue'
import PasswordInput from './ui/PasswordInput.vue'
import Button from './ui/Button.vue'
import { addVenueAdmin, removeVenueAdmin } from '../services/superadmin.js'

const props = defineProps({
  venueId: { type: String, required: true },
  admins: { type: Array, default: () => [] },
})

const emit = defineEmits(['refresh'])

const newAdmin = ref({ username: '', password: '' })
const adding = ref(false)
const adminError = ref('')

async function handleAddAdmin() {
  if (!newAdmin.value.username || !newAdmin.value.password) return
  adding.value = true
  adminError.value = ''
  try {
    const res = await addVenueAdmin(props.venueId, newAdmin.value)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      adminError.value = err.detail || 'Error al agregar administrador'
      return
    }
    newAdmin.value = { username: '', password: '' }
    emit('refresh')
  } catch (e) {
    adminError.value = e.message || 'Error al agregar administrador'
  } finally {
    adding.value = false
  }
}

async function handleRemoveAdmin(adminId) {
  await removeVenueAdmin(props.venueId, adminId)
  emit('refresh')
}
</script>

<style scoped>
/* =========================================
   CSS GENERAL
   ========================================= */
.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg, 12px);
  padding: 16px;
}

.section-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 12px 0;
}

.admin-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
}

.admin-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
}

.admin-name {
  font-weight: 600;
}

.add-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.admin-error {
  font-size: 12px;
  color: var(--danger);
  margin-top: 8px;
}

.v-btn {
  padding: 5px 12px;
  border-radius: var(--radius-sm, 8px);
  font-size: 12px;
  font-weight: 600;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  color: var(--text);
  cursor: pointer;
  transition: all 0.15s ease;
}

.v-btn-danger {
  border-color: var(--danger);
  color: var(--danger);
}

.v-btn-danger:hover {
  background: var(--danger);
  color: var(--text-on-primary, #FFFFFF);
}

.text-muted {
  color: var(--text-muted);
  font-size: 13px;
}

/* =========================================
   BREAKPOINT 850px
   ========================================= */
@media (min-width: 850px) {
  .card {
    padding: 20px;
  }

  .add-row {
    flex-direction: row;
    align-items: center;
  }

  .add-row :deep(.input-field),
  .add-row :deep(.password-field) {
    flex: 1;
  }

  .add-btn {
    width: auto;
    white-space: nowrap;
  }
}

/* =========================================
   BREAKPOINT 360px
   ========================================= */
@media (max-width: 360px) {
  .admin-item {
    font-size: 12px;
  }
}
</style>
