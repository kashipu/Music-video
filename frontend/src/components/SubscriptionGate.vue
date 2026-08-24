<script setup>
import { computed, onMounted, ref } from 'vue'
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
const monthlyPriceCents = ref(0)

const currencyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})
function formatCurrency(cents) { return currencyFormatter.format((cents || 0) / 100) }

const graceDaysLabel = computed(() => {
  const d = daysRemaining.value != null ? Math.abs(daysRemaining.value) : null
  if (d == null) return ''
  return d === 1 ? '1 día' : `${d} días`
})

function goToSubscription() {
  router.push({ name: 'admin-subscription', params: { venueSlug } })
}

onMounted(async () => {
  try {
    const res = await fetch(`${API}/api/admin/billing`, { headers: auth.adminHeaders() })
    if (!res.ok) throw new Error('billing endpoint not ready')
    const data = await res.json()
    status.value = data.payment_status
    daysRemaining.value = data.days_remaining
    monthlyPriceCents.value = data.monthly_price_cents
    // ponytail: si el endpoint no existe todavía (Fase B), no bloqueamos por defecto.
  } catch { /* deja status en 'active': fail-open mientras no exista GET /api/admin/billing */ }
})
</script>

<template>
  <div v-if="status === 'overdue'" class="grace-banner">
    <span>Tu suscripción venció. Te quedan {{ graceDaysLabel }} antes de que se suspenda el servicio.</span>
    <UiButton class="grace-cta" @click="goToSubscription">Pagar ahora</UiButton>
  </div>

  <div v-else-if="status === 'suspended'" class="paywall-overlay">
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
</style>
