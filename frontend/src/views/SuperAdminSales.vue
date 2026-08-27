<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import UiButton from '../components/ui/Button.vue'
import UiInput from '../components/ui/Input.vue'
import Badge from '../components/ui/Badge.vue'
import ThemeToggle from '../components/ui/ThemeToggle.vue'
import BackButton from '../components/ui/BackButton.vue'

const router = useRouter()
const API = import.meta.env.VITE_API_URL || ''

const loading = ref(true)
const monthlyRevenue = ref([])
const recentMovements = ref([])
const settings = ref({ trial_days: 15, grace_period_days: 5, monthly_price_cents: 0 })
const priceCOP = ref('')
const trialDays = ref(15)
const graceDays = ref(5)
const savingSettings = ref(false)
const saveMsg = ref('')
const errorMsg = ref('')

let currentRole = 'super_admin'
try { currentRole = JSON.parse(localStorage.getItem('bq_super_admin'))?.role || 'super_admin' } catch { /* ignore */ }
const canEditSettings = currentRole === 'super_admin'

function headers() { return { Authorization: `Bearer ${localStorage.getItem('bq_super_token')}` } }

const currencyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})
function formatCurrency(cents) { return currencyFormatter.format((cents || 0) / 100) }
function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr.replace(' ', 'T'))
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}
function formatMonth(monthStr) {
  const d = new Date(`${monthStr}-01T00:00:00`)
  if (isNaN(d.getTime())) return monthStr
  return d.toLocaleDateString('es-CO', { month: 'short', year: 'numeric' })
}

async function fetchSummary() {
  loading.value = true
  try {
    const res = await fetch(`${API}/api/superadmin/billing/summary`, { headers: headers() })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'No se pudo cargar el resumen de ventas')
    }
    const data = await res.json()
    monthlyRevenue.value = data.months || []
    recentMovements.value = data.movements || []
  } catch (e) {
    errorMsg.value = e.message || 'No se pudo cargar el resumen de ventas'
    setTimeout(() => { errorMsg.value = '' }, 5000)
  } finally {
    loading.value = false
  }
}

async function fetchSettings() {
  try {
    const res = await fetch(`${API}/api/superadmin/settings`, { headers: headers() })
    if (!res.ok) return
    settings.value = await res.json()
    priceCOP.value = String((settings.value.monthly_price_cents || 0) / 100)
    trialDays.value = settings.value.trial_days
    graceDays.value = settings.value.grace_period_days
  } catch { /* mantiene defaults hasta el próximo fetch */ }
}

async function saveSettings() {
  savingSettings.value = true
  errorMsg.value = ''
  try {
    const res = await fetch(`${API}/api/superadmin/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...headers() },
      body: JSON.stringify({
        monthly_price_cents: Math.round(Number(priceCOP.value) * 100),
        trial_days: Number(trialDays.value),
        grace_period_days: Number(graceDays.value),
      }),
    })
    if (res.ok) {
      saveMsg.value = 'Ajustes guardados'
      await fetchSettings()
      setTimeout(() => { saveMsg.value = '' }, 3000)
    } else {
      const err = await res.json().catch(() => ({}))
      errorMsg.value = err.detail || 'Error al guardar ajustes'
      setTimeout(() => { errorMsg.value = '' }, 5000)
    }
  } catch (e) {
    errorMsg.value = e.message || 'Error al guardar ajustes'
    setTimeout(() => { errorMsg.value = '' }, 5000)
  } finally {
    savingSettings.value = false
  }
}

const kindLabel = computed(() => (item) => item.kind === 'payment' ? formatCurrency(item.amount_cents) : `Prueba +${item.days || 0}d`)

onMounted(() => {
  fetchSummary()
  fetchSettings()
})
</script>

<template>
  <div class="sales">
    <header class="sales-header">
      <div class="header-left">
        <BackButton aria-label="Volver" @click="router.push({ name: 'superadmin' })">&#8592;</BackButton>
        <h1>Ventas y facturación</h1>
      </div>
      <ThemeToggle />
    </header>

    <main class="sales-content">
      <p v-if="loading" class="loading">Cargando...</p>

      <template v-else>
        <section class="revenue-section">
          <p class="section-title">INGRESOS POR MES</p>
          <div class="revenue-grid">
            <article v-for="m in monthlyRevenue" :key="m.month" class="revenue-card">
              <strong>{{ formatCurrency(m.total_cents) }}</strong>
              <span>{{ formatMonth(m.month) }} &middot; {{ m.count }} pago{{ m.count === 1 ? '' : 's' }}</span>
            </article>
            <p v-if="!monthlyRevenue.length" class="empty">Sin ingresos registrados</p>
          </div>
        </section>

        <section class="movements-section">
          <p class="section-title">MOVIMIENTOS RECIENTES</p>
          <div class="movements-list">
            <div v-for="item in recentMovements" :key="item.id" class="movement-row">
              <div class="movement-main">
                <RouterLink :to="{ name: 'superadmin-venue', params: { venueId: item.venue_id } }" class="movement-venue">
                  {{ item.venue_name }}
                </RouterLink>
                <span class="movement-amount">{{ kindLabel(item) }}</span>
              </div>
              <div class="movement-meta">
                <Badge v-if="item.source === 'wompi'" variant="info">Wompi</Badge>
                <Badge v-else-if="item.source === 'manual'" variant="neutral">Manual</Badge>
                <Badge v-else variant="neutral">{{ item.source }}</Badge>
                <Badge v-if="item.status === 'declined'" variant="danger">Rechazado</Badge>
                <span>{{ formatDate(item.created_at) }}</span>
              </div>
            </div>
            <p v-if="!recentMovements.length" class="empty">Sin movimientos</p>
          </div>
        </section>

        <section class="settings-section card">
          <p class="section-title">AJUSTES DE FACTURACIÓN</p>
          <template v-if="canEditSettings">
            <div class="settings-grid">
              <label class="settings-field">
                <span>Precio mensual (COP)</span>
                <UiInput v-model="priceCOP" type="number" inputmode="numeric" />
              </label>
              <label class="settings-field">
                <span>Días de prueba</span>
                <UiInput v-model="trialDays" type="number" inputmode="numeric" />
              </label>
              <label class="settings-field">
                <span>Días de gracia</span>
                <UiInput v-model="graceDays" type="number" inputmode="numeric" />
              </label>
            </div>
            <UiButton :disabled="savingSettings" class="save-settings-btn" @click="saveSettings">
              {{ savingSettings ? 'Guardando...' : 'Guardar ajustes' }}
            </UiButton>
            <span v-if="saveMsg" class="save-msg">{{ saveMsg }}</span>
            <span v-if="errorMsg" class="error-msg" role="alert">{{ errorMsg }}</span>
          </template>
          <p v-else class="settings-readonly">
            Precio: {{ formatCurrency(settings.monthly_price_cents) }} &middot;
            Prueba: {{ settings.trial_days }} días &middot;
            Gracia: {{ settings.grace_period_days }} días
          </p>
        </section>
      </template>
    </main>
  </div>
</template>

<style scoped>
.sales-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border);
}
.header-left { display: flex; align-items: center; gap: 10px; }
.header-left h1 { font-size: 18px; margin: 0; }
.theme-toggle {
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text);
  font-size: 16px;
  padding: 6px 10px;
  cursor: pointer;
}
.sales-content { max-width: 900px; margin: auto; padding: 16px 12px; display: flex; flex-direction: column; gap: 20px; }
.loading, .empty { color: var(--text-muted); text-align: center; padding: 16px 0; }

/* Título compacto para secciones de analítica densa. */
.section-title { margin: 0 0 10px; color: var(--text-muted); font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; }

.revenue-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
.revenue-card { display: flex; flex-direction: column; gap: 4px; padding: 14px; border: 1px solid var(--border-soft); border-radius: var(--radius); background: var(--bg-card); }
.revenue-card strong { font-size: 20px; }
.revenue-card span { font-size: 12px; color: var(--text-muted); }

.movements-list { display: flex; flex-direction: column; gap: 8px; }
.movement-row { display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; border-radius: var(--radius-sm, 8px); background: var(--bg-elevated); }
.movement-main { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.movement-venue { color: var(--text); font-weight: 600; text-decoration: none; }
.movement-venue:hover { color: var(--primary); }
.movement-amount { font-weight: 700; font-variant-numeric: tabular-nums; }
.movement-meta { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 12px; color: var(--text-muted); }

.settings-section { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg, 12px); padding: 16px; }
.settings-grid { display: flex; flex-direction: column; gap: 10px; margin-bottom: 12px; }
.settings-field { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--text-muted); }
.save-settings-btn { width: 100%; }
.save-msg { display: block; margin-top: 8px; color: var(--success); font-size: 13px; font-weight: 600; }
.error-msg { display: block; margin-top: 8px; color: var(--danger); font-size: 13px; font-weight: 600; }
.settings-readonly { color: var(--text-muted); font-size: 13px; margin: 0; }

@media (min-width: 640px) {
  .sales-header { padding: 12px 24px; }
  .sales-content { padding: 24px; }
  .settings-grid { flex-direction: row; }
  .settings-field { flex: 1; }
  .save-settings-btn { width: auto; }
}
</style>
