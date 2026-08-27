<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import UiInput from '../components/ui/Input.vue'
import SuperAdminHeader from '../components/SuperAdminHeader.vue'

const router = useRouter()
const API = import.meta.env.VITE_API_URL || ''
const venues = ref([])
const kpis = ref({})
const selectedPeriod = ref('today')
const filter = ref('all')
const search = ref('')

function headers() { return { Authorization: `Bearer ${localStorage.getItem('bq_super_token')}` } }
function daysSince(date) {
  if (!date) return null
  const value = new Date(date.replace(' ', 'T'))
  const today = new Date()
  return Math.max(0, Math.floor((new Date(today.getFullYear(), today.getMonth(), today.getDate()) - new Date(value.getFullYear(), value.getMonth(), value.getDate())) / 86400000))
}
function relativeDate(date) {
  const days = daysSince(date)
  if (days === null) return 'Nunca'
  if (days === 0) return 'Hoy'
  if (days === 1) return 'Ayer'
  return `hace ${days} días`
}
const currentKpis = computed(() => kpis.value[selectedPeriod.value] || {})

function daysUntil(date) {
  if (!date) return null
  const value = new Date(`${date.slice(0, 10)}T00:00:00`)
  const today = new Date()
  return Math.round((value - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000)
}
function isUpcoming(date) { const days = daysUntil(date); return days >= 1 && days <= 5 }

// ponytail: client-side venue name search combined with status indicator filter
// Ceiling: in-memory list filtering; if venue list grows to 1000+, switch to debounced backend search endpoint
// ponytail: "Pagos hoy" aproxima la fecha de pago con vencimiento=hoy; usar payments cuando exista esa tabla
const filteredVenues = computed(() => {
  const query = search.value.trim().toLowerCase()
  return venues.value.filter(v => {
    let matchesIndicator = true
    if (filter.value === 'active') matchesIndicator = v.active
    else if (filter.value === 'trial') matchesIndicator = v.on_trial
    else if (filter.value === 'overdue') matchesIndicator = v.payment_status === 'overdue'
    else if (filter.value === 'upcoming') matchesIndicator = isUpcoming(v.paid_until)
    else if (filter.value === 'paid-today') matchesIndicator = daysUntil(v.paid_until) === 0

    if (!matchesIndicator) return false
    if (!query) return true
    return (v.name || '').toLowerCase().includes(query)
  })
})

onMounted(fetchVenues)
async function fetchVenues() {
  const res = await fetch(`${API}/api/superadmin/venues`, { headers: headers() })
  if (!res.ok) return forceLogout()
  const data = await res.json()
  venues.value = data.venues.sort((a, b) => (b.last_used_at || '').localeCompare(a.last_used_at || ''))
  kpis.value = data.kpis ?? {}
}
function forceLogout() { localStorage.removeItem('bq_super_token'); localStorage.removeItem('bq_super_admin'); router.push({ name: 'superadmin-login' }) }
</script>

<template>
  <div class="sa">
    <SuperAdminHeader badge="Administración" @logout="forceLogout" />
    <main class="sa-content">
      <section class="indicators" aria-label="Indicadores de la plataforma">
        <div class="period-tabs" role="tablist" aria-label="Periodo de indicadores">
          <button role="tab" :aria-selected="selectedPeriod === 'today'" :class="{ selected: selectedPeriod === 'today' }" @click="selectedPeriod = 'today'">Hoy</button>
          <button role="tab" :aria-selected="selectedPeriod === 'week'" :class="{ selected: selectedPeriod === 'week' }" @click="selectedPeriod = 'week'">Semana</button>
          <button role="tab" :aria-selected="selectedPeriod === 'month'" :class="{ selected: selectedPeriod === 'month' }" @click="selectedPeriod = 'month'">Mes</button>
        </div>
        <div class="indicator-list">
          <article><strong>{{ currentKpis.admins_online ?? 0 }}</strong><span>Admins en línea</span></article>
          <article><strong>{{ currentKpis.users_online ?? 0 }}</strong><span>Usuarios en línea</span></article>
          <article><strong>{{ currentKpis.queued_songs ?? 0 }}</strong><span>Canciones en Cola</span></article>
          <article><strong>{{ currentKpis.active_venues ?? 0 }}</strong><span>Bares activos</span></article>
          <article><strong>{{ currentKpis.expiring ?? 0 }}</strong><span>Bares próximos a vencer</span></article>
        </div>
      </section>

      <div class="search-box">
        <UiInput
          v-model="search"
          type="search"
          placeholder="Buscar bar por nombre..."
          aria-label="Buscar bar por nombre"
        />
      </div>

      <div class="filter-pills" aria-label="Filtrar bares por estado">
        <button :class="{ selected: filter === 'active' }" :aria-pressed="filter === 'active'" @click="filter = filter === 'active' ? 'all' : 'active'">Activos</button>
        <button :class="{ selected: filter === 'trial' }" :aria-pressed="filter === 'trial'" @click="filter = filter === 'trial' ? 'all' : 'trial'">En prueba</button>
        <button :class="{ selected: filter === 'overdue' }" :aria-pressed="filter === 'overdue'" @click="filter = filter === 'overdue' ? 'all' : 'overdue'">Vencidos</button>
        <button :class="{ selected: filter === 'upcoming' }" :aria-pressed="filter === 'upcoming'" @click="filter = filter === 'upcoming' ? 'all' : 'upcoming'">Próximos a vencer</button>
        <button :class="{ selected: filter === 'paid-today' }" :aria-pressed="filter === 'paid-today'" @click="filter = filter === 'paid-today' ? 'all' : 'paid-today'">Pagos hoy</button>
      </div>

      <div class="list-header"><h2>Listado</h2><RouterLink class="btn btn-primary create-button" :to="{ name: 'superadmin-create-venue' }">+ Crear bar</RouterLink></div>

      <section class="venue-grid">
        <article v-for="venue in filteredVenues" :key="venue.id" class="venue-card" :class="{ inactive: !venue.active }">
          <div class="venue-card-header">
            <RouterLink class="venue-name" :to="{ name: 'superadmin-venue', params: { venueId: venue.id } }">{{ venue.name }}</RouterLink>
            <div class="card-badges">
              <span v-if="venue.queue_count > 0 || venue.active_sessions > 0" class="activity-dot" role="img" aria-label="Actividad actual" title="Actividad actual"></span>
              <span v-if="venue.payment_status === 'overdue'" class="payment-badge payment-overdue">Vencido</span>
              <span v-else-if="venue.on_trial" class="payment-badge payment-trial">Prueba</span>
              <span v-else-if="isUpcoming(venue.paid_until)" class="payment-badge payment-upcoming">Vencimiento</span>
              <span v-else class="payment-badge payment-paid">Pago</span>
            </div>
          </div>
          <p><span>Último log admin</span>{{ relativeDate(venue.last_admin_login) }}</p>
          <p><span>Último log usuario</span>{{ relativeDate(venue.last_used_at) }}</p>
          <p><span>Días restantes</span><strong :class="{ expired: daysUntil(venue.paid_until) < 0 }">{{ daysUntil(venue.paid_until) ?? '—' }}</strong></p>
          <UiButton class="detail-button" @click="router.push({ name: 'superadmin-venue', params: { venueId: venue.id } })">Ver detalle</UiButton>
        </article>
        <p v-if="!filteredVenues.length" class="empty">No hay bares en este filtro.</p>
      </section>
    </main>
  </div>
</template>

<style scoped>
/* =========================================
   CSS GENERAL
   ========================================= */
.sa-content { max-width:1100px; margin:auto; padding:16px 12px; }.indicators { margin:-16px -12px 20px; padding:14px 12px; background:var(--bg-card); border-bottom:1px solid var(--border); }.indicators h2,.list-header h2 { margin:0; font-size:18px; }.period-tabs { display:flex; gap:4px; margin-bottom:12px; }.period-tabs button { padding:6px 12px; border:0; border-radius:var(--radius); background:transparent; color:var(--text-muted); font:inherit; font-size:13px; cursor:pointer; }.period-tabs button.selected,.period-tabs button:hover { background:var(--primary); color:var(--text-on-primary); }.indicator-list { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:12px; }.indicator-list article { display:flex; flex-direction:column; min-width:0; padding:12px; border:1px solid var(--border-soft); border-radius:var(--radius); background:var(--bg-card); color:var(--text-muted); }.indicator-list strong { color:var(--text); font-size:24px; line-height:1; }.indicator-list span { margin-top:6px; font-size:13px; overflow-wrap:anywhere; }
.search-box { margin-bottom:12px; }.filter-pills { display:flex; gap:8px; margin-bottom:20px; overflow-x:auto; padding-bottom:2px; }.filter-pills button { flex:none; padding:7px 12px; border:1px solid var(--border-soft); border-radius:999px; background:var(--bg-card); color:var(--text-muted); font:inherit; font-size:13px; cursor:pointer; }.filter-pills button.selected,.filter-pills button:hover { border-color:var(--primary); background:var(--primary); color:var(--text-on-primary); }
.list-header { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:16px; }.create-button,.detail-button { width:auto; white-space:nowrap; }.create-button { text-decoration:none; }
.venue-grid { display:grid; grid-template-columns:1fr; gap:12px; }.venue-card { display:flex; flex-direction:column; gap:8px; padding:16px; border:1px solid var(--border-soft); border-radius:var(--radius); background:var(--bg-card); min-width:0; }.venue-card.inactive { opacity:.6; }.venue-card-header { display:flex; justify-content:space-between; align-items:center; gap:8px; }.venue-name { min-width:0; color:var(--text); font-size:17px; font-weight:700; overflow-wrap:anywhere; }.venue-name:hover { color:var(--primary); }.card-badges { display:flex; flex:none; align-items:center; gap:6px; }.activity-dot { width:8px; height:8px; border-radius:50%; background:var(--success); }.payment-badge { padding:2px 7px; border:1px solid currentColor; border-radius:999px; font-size:11px; font-weight:600; }.payment-overdue { color:var(--danger); }.payment-trial { color:var(--text-muted); }.payment-upcoming { color:var(--warning); }.payment-paid { color:var(--success); }.venue-card p { display:flex; justify-content:space-between; gap:12px; margin:0; font-size:14px; }.venue-card p span { color:var(--text-muted); }.venue-card p strong { font-weight:600; }.venue-card p .expired { color:var(--danger); }.detail-button { align-self:flex-start; margin-top:4px; }.empty { color:var(--text-muted); text-align:center; }

/* =========================================
   BREAKPOINT 640px
   ========================================= */
@media (min-width:640px) { .sa-content { padding:24px; }.indicators { margin:-24px -24px 24px; padding:16px 24px; }.indicator-list { grid-template-columns:repeat(5, minmax(0, 1fr)); }.venue-grid { grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); } }
</style>
