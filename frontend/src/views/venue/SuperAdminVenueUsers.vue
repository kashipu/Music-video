<script setup>
import { computed, inject, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const venueDetailState = inject('venueDetail', null)
const venueId = computed(() => route.params.venueId || venueDetailState?.detail?.value?.venue?.id)

const API = import.meta.env.VITE_API_URL || ''
const users = ref([])
const loading = ref(true)
const error = ref('')
const search = ref('')
const recurringFilter = ref('all') // 'all', 'recurring', 'first_time'

function headers() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('bq_super_token')}`,
  }
}

function daysSince(dateStr) {
  if (!dateStr) return null
  const value = new Date(dateStr.replace(' ', 'T'))
  if (isNaN(value.getTime())) return null
  const today = new Date()
  const d1 = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const d2 = new Date(value.getFullYear(), value.getMonth(), value.getDate())
  return Math.max(0, Math.floor((d1 - d2) / 86400000))
}

function relativeDate(dateStr) {
  const days = daysSince(dateStr)
  if (days === null) return '—'
  if (days === 0) return 'Hoy'
  if (days === 1) return 'Ayer'
  return `hace ${days} días`
}

async function fetchUsers() {
  if (!venueId.value) return
  loading.value = true
  error.value = ''
  try {
    const res = await fetch(`${API}/api/superadmin/venues/${venueId.value}/users`, {
      headers: headers(),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'No se pudieron cargar los usuarios')
    }
    const data = await res.json()
    users.value = data.users || []
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

const recurringCount = computed(() => users.value.filter(u => u.is_recurring).length)
const firstTimeCount = computed(() => users.value.filter(u => !u.is_recurring).length)

const filteredUsers = computed(() => {
  const q = search.value.trim().toLowerCase()
  return users.value.filter(u => {
    if (recurringFilter.value === 'recurring' && !u.is_recurring) return false
    if (recurringFilter.value === 'first_time' && u.is_recurring) return false

    if (!q) return true
    const name = (u.display_name || '').toLowerCase()
    const phone = (u.phone || '').toLowerCase()
    return name.includes(q) || phone.includes(q)
  })
})

onMounted(fetchUsers)
</script>

<template>
  <div class="venue-users-container">
    <!-- Top toolbar & KPIs -->
    <div class="users-toolbar">
      <div class="toolbar-left">
        <div class="stats-pills">
          <button
            type="button"
            class="stat-pill"
            :class="{ active: recurringFilter === 'all' }"
            @click="recurringFilter = 'all'"
          >
            <span class="stat-label">Total</span>
            <span class="stat-count">{{ users.length }}</span>
          </button>
          <button
            type="button"
            class="stat-pill recurring"
            :class="{ active: recurringFilter === 'recurring' }"
            @click="recurringFilter = 'recurring'"
          >
            <span class="stat-label">Recurrentes</span>
            <span class="stat-count">{{ recurringCount }}</span>
          </button>
          <button
            type="button"
            class="stat-pill first-time"
            :class="{ active: recurringFilter === 'first_time' }"
            @click="recurringFilter = 'first_time'"
          >
            <span class="stat-label">Primera vez</span>
            <span class="stat-count">{{ firstTimeCount }}</span>
          </button>
        </div>
      </div>

      <div class="toolbar-right">
        <div class="search-box">
          <svg class="search-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            v-model="search"
            type="search"
            placeholder="Buscar por nombre o teléfono..."
            class="search-input"
            aria-label="Buscar usuarios"
          />
        </div>
      </div>
    </div>

    <!-- Error State -->
    <div v-if="error" class="error-banner" role="alert">
      <span>{{ error }}</span>
      <button class="retry-btn" @click="fetchUsers">Reintentar</button>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <div class="spinner" />
      <p>Cargando usuarios del bar...</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="!filteredUsers.length" class="empty-state">
      <p v-if="users.length">No hay usuarios que coincidan con la búsqueda.</p>
      <p v-else>Este bar aún no registra usuarios finales en sus sesiones.</p>
    </div>

    <!-- Users Content -->
    <div v-else class="users-content">
      <!-- Desktop Table View -->
      <div class="table-card">
        <table class="users-table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Teléfono</th>
              <th>Última conexión</th>
              <th>Primera visita</th>
              <th>Pedidos</th>
              <th>Recurrente</th>
              <th>Auth</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in filteredUsers" :key="u.id">
              <td>
                <span class="user-name">{{ u.display_name || 'Sin nombre' }}</span>
              </td>
              <td>
                <span class="user-phone-cell">{{ u.phone }}</span>
              </td>
              <td>
                <span class="date-value">{{ relativeDate(u.last_connection) }}</span>
              </td>
              <td>
                <span class="date-value text-muted">{{ relativeDate(u.first_seen_at_venue) }}</span>
              </td>
              <td>
                <span class="songs-pill">{{ u.songs_count }}</span>
              </td>
              <td>
                <span
                  class="badge-status"
                  :class="u.is_recurring ? 'badge-recurring' : 'badge-first'"
                >
                  {{ u.is_recurring ? 'Sí' : 'No' }}
                </span>
              </td>
              <td>
                <span
                  class="badge-status"
                  :class="u.data_consent ? 'badge-consent' : 'badge-noconsent'"
                >
                  {{ u.data_consent ? 'Sí' : 'No' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Mobile Cards View -->
      <div class="mobile-cards-list">
        <div v-for="u in filteredUsers" :key="`m-${u.id}`" class="user-card">
          <div class="user-card-header">
            <div class="user-title-wrap">
              <span class="user-card-name">{{ u.display_name || 'Sin nombre' }}</span>
              <span class="user-card-phone">{{ u.phone }}</span>
            </div>
            <div class="user-card-badges">
              <span
                class="badge-status"
                :class="u.is_recurring ? 'badge-recurring' : 'badge-first'"
              >
                {{ u.is_recurring ? 'Recurrente' : '1ra vez' }}
              </span>
            </div>
          </div>

          <div class="user-card-grid">
            <div class="grid-item">
              <span class="item-label">Última conexión</span>
              <span class="item-val">{{ relativeDate(u.last_connection) }}</span>
            </div>
            <div class="grid-item">
              <span class="item-label">Primera visita</span>
              <span class="item-val">{{ relativeDate(u.first_seen_at_venue) }}</span>
            </div>
            <div class="grid-item">
              <span class="item-label">Canciones pedidas</span>
              <span class="item-val">{{ u.songs_count }}</span>
            </div>
            <div class="grid-item full-row">
              <span class="item-label">Auth</span>
              <span class="item-val consent-val">
                <span class="dot-indicator" :class="u.data_consent ? 'dot-yes' : 'dot-no'" />
                {{ u.data_consent ? 'Autorizado (Registro)' : 'No' }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* =========================================
   CSS GENERAL
   ========================================= */
.venue-users-container {
  padding: 16px;
  max-width: 1100px;
  margin: 0 auto;
}

.users-toolbar {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 24px;
}

.stats-pills {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.stat-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 9999px;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.stat-pill:hover {
  border-color: var(--primary);
  color: var(--text);
}

.stat-pill.active {
  background: var(--bg-elevated);
  border-color: var(--primary);
  color: var(--text);
}

.stat-count {
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 10px;
  background: var(--bg-elevated);
  color: var(--text);
  font-size: 12px;
}

.stat-pill.recurring.active .stat-count {
  background: var(--success-soft);
  color: var(--success);
}

.stat-pill.first-time.active .stat-count {
  background: var(--primary-soft);
  color: var(--primary);
}

.search-box {
  position: relative;
  width: 100%;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: 10px 14px 10px 36px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm, 8px);
  color: var(--text);
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s ease;
}

.search-input:focus {
  border-color: var(--primary);
}

.loading-state,
.empty-state {
  padding: 48px 16px;
  text-align: center;
  color: var(--text-muted);
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg, 12px);
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 12px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  margin-bottom: 16px;
  background: var(--danger-soft);
  color: var(--danger);
  border: 1px solid var(--danger);
  border-radius: var(--radius-sm, 8px);
  font-size: 14px;
}

.retry-btn {
  background: transparent;
  border: 1px solid currentColor;
  color: inherit;
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

/* Mobile cards list is default (mobile-first) */
.table-card {
  display: none;
}

.mobile-cards-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.user-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg, 12px);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.user-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 10px;
}

.user-title-wrap {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.user-card-name {
  font-weight: 700;
  font-size: 15px;
  color: var(--text);
}

.user-card-phone {
  font-size: 13px;
  color: var(--text-muted);
}

.user-card-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 16px;
}

.grid-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.grid-item.full-row {
  grid-column: 1 / -1;
  border-top: 1px dashed var(--border);
  padding-top: 8px;
}

.item-label {
  font-size: 11px;
  text-transform: uppercase;
  color: var(--text-muted);
  font-weight: 600;
  letter-spacing: 0.3px;
}

.item-val {
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
}

.consent-val {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.dot-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.dot-yes {
  background-color: var(--success);
}

.dot-no {
  background-color: var(--text-muted);
}

.badge-status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 3px 9px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.badge-recurring {
  background: var(--success-soft);
  color: var(--success);
}

.badge-first {
  background: var(--bg-elevated);
  color: var(--text-muted);
}

.badge-consent {
  background: var(--success-soft);
  color: var(--success);
}

.badge-noconsent {
  background: var(--bg-elevated);
  color: var(--text-muted);
}

.songs-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 6px;
  background: var(--bg-elevated);
  border-radius: 12px;
  font-size: 12px;
  font-weight: 700;
  color: var(--primary);
}

/* =========================================
   BREAKPOINT 850px (Desktop Table)
   ========================================= */
@media (min-width: 850px) {
  .venue-users-container {
    padding: 24px;
  }

  .users-toolbar {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }

  .toolbar-right {
    width: 320px;
  }

  .mobile-cards-list {
    display: none;
  }

  .table-card {
    display: block;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg, 12px);
    overflow: hidden;
  }

  .users-table {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
    font-size: 13px;
  }

  .users-table th {
    background: var(--bg-elevated);
    padding: 12px 16px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--text-muted);
    letter-spacing: 0.5px;
    border-bottom: 1px solid var(--border);
  }

  .users-table td {
    padding: 14px 16px;
    border-bottom: 1px solid var(--border);
    color: var(--text);
  }

  .users-table tbody tr:last-child td {
    border-bottom: none;
  }

  .users-table tbody tr:hover {
    background: var(--bg-elevated);
  }

  .user-name {
    font-weight: 600;
    color: var(--text);
  }

  .user-phone-cell {
    color: var(--text-muted);
    font-family: monospace;
    font-size: 13px;
  }

  .date-value {
    white-space: nowrap;
  }
}

/* =========================================
   BREAKPOINT 360px
   ========================================= */
@media (max-width: 360px) {
  .venue-users-container {
    padding: 12px 8px;
  }

  .user-card-grid {
    grid-template-columns: 1fr;
  }
}
</style>
