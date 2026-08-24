<script setup>
import { computed, inject, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import VenueActivityPanel from '../../components/VenueActivityPanel.vue'
import VenueBillingPanel from '../../components/VenueBillingPanel.vue'

const route = useRoute()
const API = import.meta.env.VITE_API_URL || ''
const venueId = route.params.venueId
const venueDetail = inject('venueDetail')
if (!venueDetail) throw new Error('venueDetail no disponible')
const { detail } = venueDetail

const dailyAnalytics = ref(null)
const bestDay = computed(() => {
  if (!dailyAnalytics.value?.days?.length) return null
  return dailyAnalytics.value.days.reduce(
    (best, day) => (!best || day.people > best.people ? day : best),
    null
  )
})

function headers() {
  return { Authorization: `Bearer ${localStorage.getItem('bq_super_token')}` }
}

function fullUrl(path) {
  return `${window.location.origin}${path}`
}

onMounted(fetchDailyAnalytics)

async function fetchDailyAnalytics() {
  const res = await fetch(`${API}/api/superadmin/venues/${venueId}/analytics`, { headers: headers() })
  if (res.ok) dailyAnalytics.value = await res.json()
}
</script>

<template>
  <div v-if="detail" class="vd-layout">
    <div class="card">
      <p class="section-title">RESUMEN</p>
      <div class="stat-grid">
        <div class="sg"><strong>{{ detail.stats.total_songs_played }}</strong><span>Reproducidas</span></div>
        <div class="sg"><strong>{{ detail.stats.total_users }}</strong><span>Usuarios</span></div>
        <div class="sg"><strong>{{ detail.stats.active_sessions }}</strong><span>Sesiones</span></div>
        <div class="sg"><strong>{{ detail.stats.songs_in_queue }}</strong><span>En cola</span></div>
      </div>
    </div>

    <VenueBillingPanel />

    <div class="vd-row">
      <VenueActivityPanel :daily-analytics="dailyAnalytics" :best-day="bestDay" />

      <div class="card">
        <p class="section-title">ENLACES DIRECTOS</p>
        <div class="url-list">
          <div
            v-for="u in [
              { label: 'Administración', path: `/${detail.venue.slug}/admin/login`, icon: '&#9881;' },
              { label: 'Pantalla Kiosk (Video)', path: `/${detail.venue.slug}/video`, icon: '&#127909;' },
              { label: 'App de Clientes (Mesa)', path: `/${detail.venue.slug}/usuario`, icon: '&#128241;' },
            ]"
            :key="u.label"
            class="url-item"
          >
            <span class="url-icon" v-html="u.icon" />
            <div class="url-info">
              <span class="url-label">{{ u.label }}</span>
              <a :href="u.path" target="_blank" rel="noopener noreferrer" class="url-value">{{ fullUrl(u.path) }}</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.vd-layout { display: flex; flex-direction: column; gap: 16px; max-width: 1100px; margin: 0 auto; padding: 16px; }
.vd-row { display: flex; flex-direction: column; gap: 16px; }
.card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 16px; }
.section-title { margin: 0 0 12px; color: var(--text-muted); font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; }
.stat-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.sg { min-width: 0; padding: 12px; border-radius: var(--radius-sm); background: var(--bg-elevated); text-align: center; }
.sg strong { display: block; color: var(--text); font-size: 20px; font-weight: 700; }
.sg span { color: var(--text-muted); font-size: 11px; overflow-wrap: anywhere; }
.url-list { display: flex; flex-direction: column; gap: 8px; }
.url-item { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border: 1px solid var(--border-soft); border-radius: var(--radius-sm); background: var(--bg-elevated); }
.url-icon { flex-shrink: 0; font-size: 18px; }
.url-info { flex: 1; min-width: 0; }
.url-label { display: block; margin-bottom: 2px; color: var(--text-muted); font-size: 12px; font-weight: 600; }
.url-value { display: block; overflow: hidden; color: var(--primary); font-family: monospace; font-size: 11px; text-decoration: none; text-overflow: ellipsis; white-space: nowrap; }
.url-value:hover { text-decoration: underline; }

@media (min-width: 850px) {
  .vd-layout { gap: 20px; padding: 24px; }
  .vd-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; }
  .card { padding: 20px; }
  .stat-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}

@media (max-width: 360px) {
  .vd-layout { padding: 12px 8px; }
  .stat-grid { grid-template-columns: 1fr; }
  .url-item { flex-direction: column; align-items: flex-start; gap: 6px; }
}
</style>
