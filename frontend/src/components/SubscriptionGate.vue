<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import UiButton from './ui/Button.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const API = import.meta.env.VITE_API_URL || ''
const venueSlug = route.params.venueSlug

const status = ref('active')
const daysRemaining = ref(null)
const graceDaysRemaining = ref(null)
const gracePeriodDays = ref(5)
const monthlyPriceCents = ref(0)
const paywallRef = ref(null)

const currencyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})
function formatCurrency(cents) { return currencyFormatter.format((cents || 0) / 100) }

const graceDaysLabel = computed(() => {
  const d = graceDaysRemaining.value != null
    ? graceDaysRemaining.value
    : (daysRemaining.value != null
      ? (daysRemaining.value < 0 ? Math.max(0, gracePeriodDays.value + daysRemaining.value) : daysRemaining.value)
      : null)
  if (d == null) return ''
  return d === 1 ? '1 día' : `${d} días`
})

function handleKeydown(e) {
  if (status.value !== 'suspended' || !paywallRef.value) return
  if (e.key !== 'Tab') return

  const focusable = paywallRef.value.querySelectorAll(
    'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
  )
  if (!focusable.length) {
    e.preventDefault()
    return
  }

  const first = focusable[0]
  const last = focusable[focusable.length - 1]

  if (e.shiftKey && document.activeElement === first) {
    last.focus()
    e.preventDefault()
  } else if (!e.shiftKey && document.activeElement === last) {
    first.focus()
    e.preventDefault()
  }
}

watch(status, async (newStatus) => {
  if (newStatus === 'suspended') {
    await nextTick()
    const first = paywallRef.value?.querySelector(
      'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
    )
    first?.focus()
  }
})

function goToSubscription() {
  router.push({ name: 'admin-subscription', params: { venueSlug } })
}

function logout() {
  auth.adminLogout()
  router.push({ name: 'admin-login', params: { venueSlug } })
}

onMounted(async () => {
  window.addEventListener('keydown', handleKeydown)
  try {
    const res = await fetch(`${API}/api/admin/billing`, { headers: auth.adminHeaders() })
    if (!res.ok) throw new Error('billing endpoint not ready')
    const data = await res.json()
    status.value = data.payment_status
    daysRemaining.value = data.days_remaining
    graceDaysRemaining.value = data.grace_days_remaining
    gracePeriodDays.value = data.grace_period_days ?? 5
    monthlyPriceCents.value = data.monthly_price_cents
  } catch {
    // Fail-open deliberado: un error de red no debe bloquear el panel del bar.
    // El bloqueo definitivo lo dará el backend cuando exista el gate (E1 del plan).
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div v-if="status === 'overdue'" class="grace-banner">
    <span>Tu suscripción venció. Te quedan {{ graceDaysLabel }} antes de que se suspenda el servicio.</span>
    <UiButton class="grace-cta" @click="goToSubscription">Pagar ahora</UiButton>
  </div>

  <div v-else-if="status === 'suspended'" ref="paywallRef" class="paywall-overlay" role="dialog" aria-modal="true">
    <div class="paywall-card glass-card glow-primary">
      <span class="paywall-pill">Suscripción suspendida</span>
      <h2 class="paywall-title font-display">
        Tu servicio está <span class="text-gradient">pausado</span>
      </h2>
      <p class="paywall-desc">
        Tu suscripción venció y el período de gracia terminó. Reactívala para seguir recibiendo pedidos de canciones en tu bar.
      </p>
      <div class="paywall-price">
        <strong class="font-display">{{ formatCurrency(monthlyPriceCents) }}</strong>
        <span>COP /mes</span>
      </div>
      <ul class="paywall-features">
        <li>Cola de canciones en tiempo real</li>
        <li>Pantalla de video para el bar</li>
        <li>Sin límite de usuarios conectados</li>
      </ul>
      <UiButton class="paywall-cta" @click="goToSubscription">Reactivar suscripción</UiButton>
      <button type="button" class="paywall-logout" @click="logout">Salir</button>
    </div>
  </div>
</template>

<style scoped>
/* Banner de período de gracia */
.grace-banner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 10px 16px;
  background: var(--warning-soft);
  border-bottom: 1px solid var(--border-soft);
  color: var(--warning);
  font-size: 13px;
  font-weight: 600;
  text-align: center;
}
.grace-cta {
  width: auto;
  padding: 6px 14px;
  font-size: 12px;
  white-space: nowrap;
}

/* Paywall a pantalla completa */
.paywall-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  background-color: var(--bg);
  background-image:
    radial-gradient(ellipse 80% 50% at 50% 85%, var(--secondary-soft) 0%, var(--primary-soft) 55%, transparent 75%),
    radial-gradient(circle at 50% 95%, var(--primary-soft) 0%, transparent 60%);
  background-repeat: no-repeat;
  background-attachment: fixed;
}

.paywall-card {
  width: 100%;
  max-width: 420px;
  padding: 32px 28px;
  border-radius: var(--radius-lg);
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}

.paywall-pill {
  padding: 4px 14px;
  border-radius: 999px;
  border: 1px solid var(--primary-soft);
  background: var(--bg-elevated);
  color: var(--primary);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.paywall-title {
  font-size: 22px;
  font-weight: 800;
  color: var(--text);
  margin: 0;
}

.paywall-desc {
  color: var(--text-muted);
  font-size: 14px;
  line-height: 1.5;
  margin: 0;
}

.paywall-price {
  display: flex;
  align-items: baseline;
  gap: 6px;
}
.paywall-price strong { font-size: 32px; color: var(--text); }
.paywall-price span { font-size: 13px; color: var(--text-muted); font-weight: 600; }

.paywall-features {
  list-style: none;
  padding: 14px 0;
  margin: 0;
  width: 100%;
  border-top: 1px solid var(--border-soft);
  border-bottom: 1px solid var(--border-soft);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.paywall-features li {
  font-size: 13px;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 8px;
}
.paywall-features li::before {
  content: '✓';
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--success-soft);
  color: var(--success);
  font-size: 11px;
  font-weight: 700;
  flex: none;
}

.paywall-cta {
  width: 100%;
}

.paywall-logout {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  padding: 4px;
}
.paywall-logout:hover {
  color: var(--text);
  text-decoration: underline;
}
</style>
