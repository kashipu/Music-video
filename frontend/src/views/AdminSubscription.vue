<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import { useConfigStore } from '../stores/config.js'
import Badge from '../components/ui/Badge.vue'
import UiButton from '../components/ui/Button.vue'
import ThemeToggle from '../components/ui/ThemeToggle.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const config = useConfigStore()
const API = import.meta.env.VITE_API_URL || ''
const venueSlug = route.params.venueSlug

const loading = ref(true)
const paying = ref(false)
const errorMsg = ref('')
const billing = ref(null)
const processingReturn = ref(!!route.query.id)

const currencyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})
function formatCurrency(cents) {
  return currencyFormatter.format((cents || 0) / 100)
}
function formatDate(dateStr) {
  if (!dateStr) return ''
  // Fecha pura (sin hora) se ancla a medianoche LOCAL; si no, un huso horario
  // hacia atrás (ej. Colombia UTC-5) la corre un día atrás al formatear.
  const hasTime = dateStr.includes('T') || dateStr.includes(' ')
  const d = new Date(hasTime ? dateStr.replace(' ', 'T') : `${dateStr}T00:00:00`)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Solo pagos aprobados y pruebas: los intentos rechazados/pendientes no le aportan
// al dueño del bar y solo confunden — esos los revisa el superadmin.
const visibleHistory = computed(() => {
  return (billing.value?.history || []).filter(item => item.status !== 'declined' && item.status !== 'pending')
})

const statusBadgeInfo = computed(() => {
  const s = billing.value?.payment_status
  if (s === 'active') return { variant: 'success', label: 'Al día' }
  if (s === 'overdue') return { variant: 'warning', label: 'Vencido (período de gracia)' }
  if (s === 'suspended') return { variant: 'danger', label: 'Suspendido (período vencido)' }
  return { variant: 'neutral', label: s || 'Desconocido' }
})

const periodSubtitle = computed(() => {
  const days = billing.value?.days_remaining
  if (days == null || isNaN(days)) return 'Sin período registrado'
  if (days > 1) return 'días restantes'
  if (days === 1) return 'día restante'
  if (days === 0) return 'Vence hoy'
  return Math.abs(days) === 1 ? 'día vencido' : 'días vencido'
})

async function fetchBilling() {
  loading.value = true
  errorMsg.value = ''
  try {
    const res = await fetch(`${API}/api/admin/billing`, { headers: auth.adminHeaders() })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'No se pudo cargar tu suscripción')
    }
    billing.value = await res.json()
  } catch (e) {
    errorMsg.value = e.message || 'No se pudo cargar tu suscripción'
  } finally {
    loading.value = false
  }
}

async function payNow() {
  paying.value = true
  errorMsg.value = ''
  try {
    const res = await fetch(`${API}/api/admin/billing/checkout`, { headers: auth.adminHeaders() })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'No se pudo iniciar el pago')
    }
    const checkout = await res.json()
    const params = new URLSearchParams({
      'public-key': checkout.public_key,
      currency: checkout.currency,
      'amount-in-cents': checkout.amount_in_cents,
      reference: checkout.reference,
      'signature:integrity': checkout.signature,
    })
    // El WAF de Wompi bloquea el checkout (403 CloudFront) si redirect-url es
    // localhost/http: en dev se omite (vuelves a la pestaña a mano; el webhook
    // registra el pago igual). En producción https va normal.
    if (location.protocol === 'https:') {
      params.set('redirect-url', location.origin + location.pathname)
    }
    window.location.href = `https://checkout.wompi.co/p/?${params}`
  } catch (e) {
    errorMsg.value = e.message || 'No se pudo iniciar el pago'
    paying.value = false
  }
}

onMounted(async () => {
  await fetchBilling()
  if (processingReturn.value) {
    setTimeout(async () => {
      await fetchBilling()
      processingReturn.value = false
    }, 5000)
  }
})
</script>

<template>
  <div class="admin-subscription">
    <header class="admin-header">
      <div class="header-brand">
        <button class="back-btn" aria-label="Volver" @click="router.push({ name: 'admin', params: { venueSlug } })">&#8592;</button>
        <h1>Mi suscripción</h1>
      </div>
      <ThemeToggle />
    </header>

    <main class="as-content">
      <p v-if="loading" class="loading">Cargando...</p>

      <template v-else-if="billing">
        <div v-if="processingReturn" class="processing-banner">Procesando tu pago... Actualizaremos el estado en unos segundos.</div>

        <div
          class="card billing-card"
          :class="{
            'billing-overdue': billing.payment_status === 'overdue',
            'billing-suspended': billing.payment_status === 'suspended',
          }"
        >
          <div class="billing-header">
            <p class="section-title">SUSCRIPCIÓN</p>
            <Badge :variant="statusBadgeInfo.variant">{{ statusBadgeInfo.label }}</Badge>
          </div>

          <div class="billing-hero">
            <div class="hero-days">
              <span class="days-number" :class="'ps-' + billing.payment_status">
                {{ billing.days_remaining != null ? Math.abs(billing.days_remaining) : '—' }}
              </span>
              <span class="days-label">{{ periodSubtitle }}</span>
            </div>
            <div v-if="billing.period_start || billing.paid_until" class="period-range">
              {{ formatDate(billing.period_start) }} → {{ formatDate(billing.paid_until) }}
            </div>
          </div>

          <div class="billing-divider" />

          <div class="price-row">
            <span class="price-label">Precio mensual</span>
            <strong class="price-value">{{ formatCurrency(billing.monthly_price_cents) }}</strong>
          </div>

          <UiButton v-if="config.pagos" class="pay-btn" :disabled="paying" @click="payNow">
            {{ paying ? 'Redirigiendo a Wompi...' : 'Pagar con Wompi' }}
          </UiButton>
          <span v-if="errorMsg" class="error-msg" role="alert">{{ errorMsg }}</span>

          <div class="billing-divider" />

          <div class="history-section">
            <p class="history-title">HISTORIAL DE PAGOS ({{ visibleHistory.length }})</p>
            <div v-if="visibleHistory.length" class="history-list">
              <div v-for="item in visibleHistory" :key="item.id" class="history-card">
                <div class="history-line-1">
                  <strong v-if="item.kind === 'payment'" class="payment-amount">
                    {{ formatCurrency(item.amount_cents) }}
                  </strong>
                  <span v-else class="trial-amount">Prueba +{{ item.days || 0 }} días</span>
                  <Badge v-if="item.source === 'wompi'" variant="info">Wompi</Badge>
                  <Badge v-else-if="item.kind === 'payment'" variant="neutral">Manual</Badge>
                </div>
                <div class="history-line-2">
                  <span>{{ formatDate(item.created_at) }}</span>
                  <span v-if="item.period_start && item.period_end">&middot; {{ formatDate(item.period_start) }} → {{ formatDate(item.period_end) }}</span>
                </div>
              </div>
            </div>
            <p v-else class="history-empty">Sin pagos registrados</p>
          </div>
        </div>
      </template>

      <p v-else class="error-msg" role="alert">{{ errorMsg || 'No se pudo cargar tu suscripción' }}</p>
    </main>
  </div>
</template>

<style scoped>
.admin-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border);
}
.header-brand { display: flex; align-items: center; gap: 10px; }
.header-brand h1 { font-size: 18px; margin: 0; }
.back-btn, .theme-toggle {
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text);
  font-size: 16px;
  padding: 6px 10px;
  cursor: pointer;
}
.as-content { max-width: 560px; margin: auto; padding: 16px 12px; }
.loading { color: var(--text-muted); text-align: center; padding: 24px 0; }

.processing-banner {
  background: var(--warning-soft);
  color: var(--warning);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius);
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 12px;
}

.billing-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg, 12px); padding: 16px; }
.billing-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 16px; }
.section-title { margin: 0; color: var(--text-muted); font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; }
.billing-overdue { border-color: var(--warning) !important; }
.billing-suspended { border-color: var(--danger) !important; }

.billing-hero { display: flex; flex-direction: column; gap: 4px; }
.hero-days { display: flex; align-items: baseline; gap: 10px; }
.days-number { font-size: 32px; font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; }
.days-label { font-size: 13px; color: var(--text-muted); font-weight: 500; }
.period-range { font-size: 13px; color: var(--text-muted); font-variant-numeric: tabular-nums; margin-top: 2px; }
.ps-active { color: var(--success); }
.ps-overdue { color: var(--warning); }
.ps-suspended { color: var(--danger); }

.billing-divider { border-top: 1px dashed var(--border); margin: 16px 0; }

.price-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.price-label { font-size: 13px; color: var(--text-muted); }
.price-value { font-size: 18px; }

.pay-btn { width: 100%; }
.error-msg { display: block; margin-top: 8px; color: var(--danger); font-size: 13px; font-weight: 600; }

.history-title { margin: 0 0 10px; color: var(--text-muted); font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; }
.history-list { display: flex; flex-direction: column; gap: 8px; }
.history-card { background: var(--bg-elevated); border-radius: var(--radius-sm, 8px); padding: 10px 12px; display: flex; flex-direction: column; gap: 4px; }
.history-line-1 { display: flex; align-items: center; gap: 8px; }
.payment-amount, .trial-amount { font-size: 14px; font-weight: 700; color: var(--text); }
.history-line-2 { font-size: 12px; color: var(--text-muted); display: flex; align-items: center; gap: 4px; flex-wrap: wrap; font-variant-numeric: tabular-nums; }
.history-empty { text-align: center; padding: 16px 0; color: var(--text-muted); font-size: 13px; margin: 0; }
</style>
