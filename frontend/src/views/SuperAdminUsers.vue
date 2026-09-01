<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useConfirmModal } from '../composables/useConfirmModal.js'
import Button from '../components/ui/Button.vue'
import Input from '../components/ui/Input.vue'
import PasswordInput from '../components/ui/PasswordInput.vue'
import Select from '../components/ui/Select.vue'
import FormField from '../components/ui/FormField.vue'
import FormError from '../components/ui/FormError.vue'
import ThemeToggle from '../components/ui/ThemeToggle.vue'
import BackButton from '../components/ui/BackButton.vue'

const { confirm } = useConfirmModal()
const router = useRouter()
const API = import.meta.env.VITE_API_URL || ''

document.title = 'Repítela - Usuarios'

const admins = ref([])
const loading = ref(true)
const creating = ref(false)
const deletingId = ref(null)
const updatingRoleId = ref(null)

const newAdmin = ref({
  username: '',
  password: '',
  phone: '',
  email: '',
  role: 'vendedor',
})

const createError = ref('')
const createSuccess = ref('')
const actionError = ref('')
const actionSuccess = ref('')

const currentSuperAdmin = computed(() => {
  try {
    const raw = localStorage.getItem('bq_super_admin')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
})

function headers() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('bq_super_token')}`,
  }
}

function roleLabel(role) {
  switch (role) {
    case 'super_admin':
      return 'Super Admin'
    case 'vendedor':
      return 'Vendedor'
    case 'editor':
      return 'Administrador'
    default:
      return role || 'Admin'
  }
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function isCurrentAdmin(adm) {
  if (!currentSuperAdmin.value) return false
  if (currentSuperAdmin.value.id && adm.id === currentSuperAdmin.value.id) return true
  if (currentSuperAdmin.value.username && adm.username === currentSuperAdmin.value.username) return true
  return false
}

function isOnlySuperAdmin(adm) {
  if (adm.role !== 'super_admin') return false
  const superAdmins = admins.value.filter((a) => a.role === 'super_admin')
  return superAdmins.length <= 1
}

function getDeleteDisabledReason(adm) {
  if (isCurrentAdmin(adm)) return 'No puedes eliminar tu propia cuenta'
  if (isOnlySuperAdmin(adm)) return 'No se puede eliminar el único Super Admin'
  return 'Eliminar administrador'
}

async function fetchAdmins() {
  loading.value = true
  actionError.value = ''
  try {
    const res = await fetch(`${API}/api/superadmin/admins`, { headers: headers() })
    if (res.status === 401 || res.status === 403) {
      router.push({ name: 'superadmin-login' })
      return
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Error al cargar administradores')
    }
    const data = await res.json()
    admins.value = Array.isArray(data) ? data : data.admins || []
  } catch (e) {
    actionError.value = e.message || 'Error de conexión'
  } finally {
    loading.value = false
  }
}

async function createAdmin() {
  createError.value = ''
  createSuccess.value = ''
  if (!newAdmin.value.username.trim() || !newAdmin.value.password || !newAdmin.value.phone.trim() || !newAdmin.value.email.trim()) {
    createError.value = 'Completa usuario, contraseña, teléfono y correo electrónico'
    return
  }

  creating.value = true
  try {
    const res = await fetch(`${API}/api/superadmin/admins`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        username: newAdmin.value.username.trim(),
        password: newAdmin.value.password,
        phone: newAdmin.value.phone.trim(),
        email: newAdmin.value.email.trim(),
        role: newAdmin.value.role,
      }),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(data.detail || 'Error al crear administrador')
    }

    createSuccess.value = `Administrador "${newAdmin.value.username}" creado`
    newAdmin.value.username = ''
    newAdmin.value.password = ''
    newAdmin.value.phone = ''
    newAdmin.value.email = ''
    newAdmin.value.role = 'vendedor'

    await fetchAdmins()
    setTimeout(() => {
      createSuccess.value = ''
    }, 3500)
  } catch (e) {
    createError.value = e.message || 'Error al crear administrador'
  } finally {
    creating.value = false
  }
}

async function confirmDelete(adm) {
  if (isCurrentAdmin(adm)) {
    actionError.value = 'No puedes eliminar tu propia cuenta'
    return
  }
  if (isOnlySuperAdmin(adm)) {
    actionError.value = 'No se puede eliminar el último Super Admin restante'
    return
  }
  const ok = await confirm({
    title: 'Eliminar administrador',
    message: `¿Eliminar al administrador "${adm.username}"? Esta acción no se puede deshacer.`,
    danger: true,
    confirmText: 'Eliminar',
  })
  if (!ok) return

  deletingId.value = adm.id
  actionError.value = ''
  actionSuccess.value = ''
  try {
    const res = await fetch(`${API}/api/superadmin/admins/${adm.id}`, {
      method: 'DELETE',
      headers: headers(),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(data.detail || 'Error al eliminar')
    }
    actionSuccess.value = `Administrador "${adm.username}" eliminado`
    await fetchAdmins()
    setTimeout(() => {
      actionSuccess.value = ''
    }, 3500)
  } catch (e) {
    actionError.value = e.message || 'Error al eliminar administrador'
  } finally {
    deletingId.value = null
  }
}

async function changeRole(adm, newRole) {
  if (!newRole || newRole === adm.role) return
  if (adm.role === 'super_admin' && newRole !== 'super_admin' && isOnlySuperAdmin(adm)) {
    actionError.value = 'No se puede cambiar el rol del último Super Admin restante'
    return
  }

  updatingRoleId.value = adm.id
  actionError.value = ''
  actionSuccess.value = ''
  try {
    const res = await fetch(`${API}/api/superadmin/admins/${adm.id}`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify({ role: newRole }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(data.detail || 'Error al cambiar rol')
    }
    adm.role = newRole
    actionSuccess.value = `Rol de "${adm.username}" actualizado a ${roleLabel(newRole)}`
    setTimeout(() => {
      actionSuccess.value = ''
    }, 3500)
  } catch (e) {
    actionError.value = e.message || 'Error al cambiar rol'
    await fetchAdmins()
  } finally {
    updatingRoleId.value = null
  }
}

function goBack() {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push({ name: 'superadmin' })
  }
}

onMounted(() => {
  fetchAdmins()
})
</script>

<template>
  <div class="sau-view">
    <!-- Header -->
    <header class="sau-header">
      <div class="sau-header-left">
        <BackButton aria-label="Volver" @click="goBack">&#8592; Volver</BackButton>
        <h1>Usuarios</h1>
      </div>
      <ThemeToggle />
    </header>

    <main class="sau-content">
      <!-- Formulario para crear -->
      <section class="card form-card">
        <h2 class="card-title">Nuevo Usuario</h2>
        <form @submit.prevent="createAdmin" class="admin-form">
          <FormField label="Usuario" required v-slot="{ id }">
            <Input
              :id="id"
              v-model="newAdmin.username"
              type="text"
              placeholder="Ej: vendedor1"
              autocomplete="off"
              required
            />
          </FormField>

          <FormField label="Teléfono" required v-slot="{ id }">
            <Input
              :id="id"
              v-model="newAdmin.phone"
              type="tel"
              placeholder="Ej: +57 300 123 4567"
              required
            />
          </FormField>

          <FormField label="Correo electrónico" required v-slot="{ id }">
            <Input
              :id="id"
              v-model="newAdmin.email"
              type="email"
              placeholder="usuario@ejemplo.com"
              required
            />
          </FormField>

          <FormField label="Contraseña" required v-slot="{ id }">
            <PasswordInput
              :id="id"
              v-model="newAdmin.password"
              placeholder="Contraseña"
              required
            />
          </FormField>

          <FormField label="Rol" required v-slot="{ id }">
            <Select :id="id" v-model="newAdmin.role" required>
              <option value="vendedor">Vendedor</option>
              <option value="editor">Administrador</option>
              <option value="super_admin">Super Admin</option>
            </Select>
          </FormField>

          <FormError :message="createError" />
          <div v-if="createSuccess" class="msg-success">{{ createSuccess }}</div>

          <Button type="submit" :disabled="creating">
            {{ creating ? 'Creando...' : 'Crear Usuario' }}
          </Button>
        </form>
      </section>

      <!-- Lista de administradores -->
      <section class="card list-card">
        <div class="list-header">
          <h2 class="card-title">Usuarios Registrados</h2>
          <span class="count-badge">{{ admins.length }}</span>
        </div>

        <div v-if="loading" class="loading-state">Cargando usuarios...</div>
        <div v-else-if="admins.length === 0" class="empty-state">No hay usuarios registrados</div>

        <div v-else class="admin-cards">
          <article v-for="adm in admins" :key="adm.id" class="admin-card">
            <div class="admin-main-info">
              <div class="admin-header-row">
                <span class="admin-username">{{ adm.username }}</span>
                <span class="role-badge" :class="'role-' + adm.role">
                  {{ roleLabel(adm.role) }}
                </span>
              </div>
              <div class="admin-meta">
                <span>Tel: {{ adm.phone || '—' }}</span>
                <span>Correo: {{ adm.email || '—' }}</span>
                <span v-if="adm.created_at" class="created-at">
                  Creado: {{ formatDate(adm.created_at) }}
                </span>
                <span v-if="isCurrentAdmin(adm)" class="current-badge">Tú</span>
              </div>
            </div>

            <div class="admin-actions">
              <select
                class="role-select"
                :value="adm.role"
                :disabled="updatingRoleId === adm.id || (adm.role === 'super_admin' && isOnlySuperAdmin(adm))"
                :aria-label="`Cambiar rol de ${adm.username}`"
                @change="changeRole(adm, $event.target.value)"
              >
                <option value="vendedor">Vendedor</option>
                <option value="editor">Administrador</option>
                <option value="super_admin">Super Admin</option>
              </select>
              <Button
                variant="danger"
                class="btn-delete"
                :disabled="deletingId === adm.id || isCurrentAdmin(adm) || isOnlySuperAdmin(adm)"
                :title="getDeleteDisabledReason(adm)"
                :aria-label="`Eliminar administrador ${adm.username}`"
                @click="confirmDelete(adm)"
              >
                {{ deletingId === adm.id ? '...' : 'Eliminar' }}
              </Button>
            </div>
          </article>
        </div>

        <div v-if="actionError" class="msg-error list-error">{{ actionError }}</div>
        <div v-if="actionSuccess" class="msg-success list-success">{{ actionSuccess }}</div>
      </section>
    </main>
  </div>
</template>

<style scoped>
/* =========================================
   CSS GENERAL
   ========================================= */
.sau-view {
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--bg);
  color: var(--text);
  padding-bottom: 32px;
}

.sau-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 10;
}

.sau-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.sau-header h1 {
  font-size: 18px;
  font-weight: 700;
  margin: 0;
}

.theme-toggle {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  color: var(--text);
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  cursor: pointer;
}

.sau-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  max-width: 1000px;
  margin: 0 auto;
}

/* Tarjeta administrativa con borde sólido para agrupar el formulario. */
.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
}

.card-title {
  font-size: 15px;
  font-weight: 700;
  margin-bottom: 14px;
  color: var(--text);
}

.admin-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.count-badge {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-muted);
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 24px;
  color: var(--text-muted);
  font-size: 14px;
}

.admin-cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.admin-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
}

.admin-main-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.admin-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.admin-username {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  word-break: break-word;
}

.role-badge {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  padding: 3px 8px;
  border-radius: var(--radius-sm);
  letter-spacing: 0.5px;
  white-space: nowrap;
}

.role-super_admin {
  background: var(--primary-soft);
  color: var(--primary);
  border: 1px solid var(--primary);
}

.role-vendedor {
  background: var(--warning-soft);
  color: var(--warning);
  border: 1px solid var(--warning);
}

.role-editor {
  background: var(--secondary-soft);
  color: var(--secondary);
  border: 1px solid var(--secondary);
}

.admin-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 12px;
  color: var(--text-muted);
  overflow-wrap: anywhere;
}

.current-badge {
  background: var(--success-soft);
  color: var(--success);
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--success);
}

.admin-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.role-select {
  background: var(--bg-card);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 5px 8px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  outline: none;
  transition: border-color 0.15s, opacity 0.15s;
}

.role-select:focus-visible,
.role-select:focus {
  border-color: var(--primary);
}

.role-select:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-delete {
  width: auto;
  background: var(--danger-soft);
  border: 1px solid var(--danger);
  color: var(--danger);
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-delete:hover:not(:disabled) {
  background: var(--danger);
  color: var(--text-on-primary);
}

.btn-delete:disabled {
  opacity: 0.35;
  cursor: not-allowed;
  border-color: var(--border);
  color: var(--text-muted);
  background: transparent;
}

.msg-error {
  font-size: 13px;
  color: var(--danger);
  background: var(--danger-soft);
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--danger);
}

.msg-success {
  font-size: 13px;
  color: var(--success);
  background: var(--success-soft);
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--success);
}

.list-error,
.list-success {
  margin-top: 12px;
}

/* =========================================
   BREAKPOINT 850px
   ========================================= */
@media (min-width: 850px) {
  .sau-content {
    display: grid;
    grid-template-columns: 340px 1fr;
    gap: 20px;
    align-items: flex-start;
  }

  .admin-card {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
  }

  .admin-main-info {
    flex: 1;
    margin-right: 16px;
  }

  .admin-header-row {
    justify-content: flex-start;
    gap: 12px;
  }
}

/* =========================================
   BREAKPOINT 360px
   ========================================= */
@media (max-width: 360px) {
  .sau-header {
    padding: 10px 12px;
  }

  .sau-content {
    padding: 12px;
    gap: 12px;
  }

  .card {
    padding: 12px;
  }

  .admin-header-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .admin-actions {
    flex-wrap: wrap;
    justify-content: flex-start;
  }
}
</style>
