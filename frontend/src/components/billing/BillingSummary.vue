<script setup>
import Badge from '../ui/Badge.vue'

defineProps({
  billing: { type: Object, required: true },
  statusBadgeInfo: { type: Object, required: true },
  periodSubtitle: { type: String, required: true },
  definingLabel: { type: String, default: '' },
  paymentTotals: { type: Object, required: true },
  hasTotals: Boolean,
})

const currency = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
const formatCurrency = amount => currency.format(amount || 0)
const formatDate = value => value ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : ''
</script>

<template>
  <div class="billing-header">
    <p class="section-title">SUSCRIPCIÓN</p>
    <Badge :variant="statusBadgeInfo.variant">{{ statusBadgeInfo.label }}</Badge>
  </div>

  <div class="billing-hero">
    <div class="hero-days">
      <span class="days-number" :class="'ps-' + billing.status">{{ billing.days_remaining != null ? Math.abs(billing.days_remaining) : '—' }}</span>
      <span class="days-label">{{ periodSubtitle }}</span>
    </div>
    <div v-if="billing.period_start || billing.period_end" class="period-range">
      <span v-if="billing.period_start && billing.period_end">{{ formatDate(billing.period_start) }} → {{ formatDate(billing.period_end) }}</span>
      <span v-else-if="billing.period_end">Cubierto hasta el {{ formatDate(billing.period_end) }}</span>
    </div>
    <div v-if="definingLabel" class="defining-line">Definido por: <strong>{{ definingLabel }}</strong></div>
  </div>

  <div v-if="hasTotals" class="totals-row">
    <div v-if="paymentTotals.wompi" class="total-chip">
      <span class="total-label">Pagado vía Wompi</span>
      <strong>{{ formatCurrency(paymentTotals.wompi.amount_cents / 100) }}</strong>
      <span class="total-count">{{ paymentTotals.wompi.count }} pago{{ paymentTotals.wompi.count === 1 ? '' : 's' }}</span>
    </div>
    <div v-if="paymentTotals.manual" class="total-chip">
      <span class="total-label">Pagado manual</span>
      <strong>{{ formatCurrency(paymentTotals.manual.amount_cents / 100) }}</strong>
      <span class="total-count">{{ paymentTotals.manual.count }} pago{{ paymentTotals.manual.count === 1 ? '' : 's' }}</span>
    </div>
  </div>
</template>

<style scoped>
.billing-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 16px; }
.section-title { margin: 0; color: var(--text-muted); font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; }
.billing-hero { display: flex; flex-direction: column; gap: 4px; }
.hero-days { display: flex; align-items: baseline; gap: 10px; }
.days-number { font-size: 28px; font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; }
.days-label, .period-range { font-size: 13px; color: var(--text-muted); font-weight: 500; }
.period-range { font-variant-numeric: tabular-nums; margin-top: 2px; font-weight: normal; }
.defining-line { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
.defining-line strong { color: var(--text); font-weight: 600; }
.ps-active { color: var(--success); }
.ps-overdue { color: var(--warning); }
.ps-suspended { color: var(--danger); }
.totals-row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
.total-chip { display: flex; flex-direction: column; gap: 2px; padding: 8px 12px; background: var(--bg-elevated); border-radius: var(--radius-sm, 8px); min-width: 130px; }
.total-label, .total-count { font-size: 11px; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; }
.total-chip strong { font-size: 15px; color: var(--text); }
.total-count { font-weight: normal; text-transform: none; letter-spacing: 0; }
@media (min-width: 850px) { .days-number { font-size: 32px; } }
@media (max-width: 360px) { .hero-days { flex-direction: column; gap: 2px; } .days-number { font-size: 24px; } }
</style>
