<script setup>
import { computed, inject, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { getVenueUsers } from '../../services/superadmin.js'
import VenueUsersToolbar from '../../components/VenueUsersToolbar.vue'
import VenueUsersList from '../../components/VenueUsersList.vue'

const route = useRoute()
const venueDetailState = inject('venueDetail', null)
const venueId = computed(() => route.params.venueId || venueDetailState?.detail?.value?.venue?.id)

const users = ref([])
const loading = ref(true)
const error = ref('')
const search = ref('')
const recurringFilter = ref('all') // 'all', 'recurring', 'first_time'

async function fetchUsers() {
  if (!venueId.value) return
  loading.value = true
  error.value = ''
  try {
    const data = await getVenueUsers(venueId.value)
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
    <VenueUsersToolbar
      :total-count="users.length"
      :recurring-count="recurringCount"
      :first-time-count="firstTimeCount"
      :recurring-filter="recurringFilter"
      :search="search"
      @update:recurring-filter="recurringFilter = $event"
      @update:search="search = $event"
    />

    <!-- Error State -->
    <div v-if="error" class="error-banner" role="alert">
      <span>{{ error }}</span>
      <button class="retry-btn" type="button" @click="fetchUsers">Reintentar</button>
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
    <VenueUsersList v-else :users="filteredUsers" />
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

/* =========================================
   BREAKPOINT 850px
   ========================================= */
@media (min-width: 850px) {
  .venue-users-container {
    padding: 24px;
  }
}

/* =========================================
   BREAKPOINT 360px
   ========================================= */
@media (max-width: 360px) {
  .venue-users-container {
    padding: 12px 8px;
  }
}
</style>
