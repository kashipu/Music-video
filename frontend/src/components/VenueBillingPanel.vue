<script setup>
import { computed, inject, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useConfirmModal } from '../composables/useConfirmModal.js'
import BillingSummary from './billing/BillingSummary.vue'
import BillingActions from './billing/BillingActions.vue'
import BillingHistory from './billing/BillingHistory.vue'
import { postBillingAction, updateBillingEvent } from '../services/billing.js'

const route = useRoute()
const venueId = route.params.venueId
const venueDetail = inject('venueDetail')
if (!venueDetail) throw new Error('venueDetail no disponible')
const { detail, refresh } = venueDetail
const { confirm } = useConfirmModal()

const busy = ref(false)
const voidingEventId = ref(null)
const savingNote = ref(false)
const saveMsg = ref('')
const errorMsg = ref('')

const currencyFormatter = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
const formatCurrency = amount => currencyFormatter.format(amount || 0)

function formatDate(dateStr) {
  if (!dateStr) return ''
  const hasTime = dateStr.includes('T') || dateStr.includes(' ')
  const d = new Date(hasTime ? dateStr.replace(' ', 'T') : `${dateStr}T00:00:00`)
  return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}

const toISODate = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const daysBetween = (fromDate, toDateStr) => Math.round((new Date(`${toDateStr}T00:00:00`) - fromDate) / 86400000)

const billing = computed(() => {
  if (detail.value?.billing) return detail.value.billing
  const status = detail.value?.venue?.payment_status || 'active'
  const paidUntil = detail.value?.venue?.paid_until || null
  let daysRemaining = null
  if (paidUntil) {
    const value = new Date(`${paidUntil.slice(0, 10)}T00:00:00`)
    const today = new Date()
    daysRemaining = Math.round((value - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000)
  }
  return { status, period_start: null, period_end: paidUntil, days_remaining: daysRemaining, totals: [], history: [] }
})

const statusBadgeInfo = computed(() => {
  const s = billing.value.status
  if (s === 'active') return { variant: 'success', label: 'Al día' }
  if (s === 'overdue') return { variant: 'warning', label: 'Vencido (período de gracia)' }
  if (s === 'suspended') return { variant: 'danger', label: 'Suspendido (período vencido)' }
  return { variant: 'neutral', label: s || 'Desconocido' }
})

const periodSubtitle = computed(() => {
  const days = billing.value.days_remaining
  if (days == null || isNaN(days)) return 'Sin período registrado'
  if (days > 1) return 'días restantes'
  if (days === 1) return 'día restante'
  if (days === 0) return 'Vence hoy'
  return Math.abs(days) === 1 ? 'día vencido' : 'días vencido'
})

const definingEvent = computed(() =>
  (billing.value.history || []).find(e => e.status !== 'voided' && e.status !== 'declined' && e.status !== 'pending') || null
)

function eventTitle(item) {
  if (item.kind === 'payment') return formatCurrency(item.amount_cents != null ? item.amount_cents / 100 : 0)
  if (item.kind === 'trial') return `Prueba +${item.days || 0} días`
  if (item.kind === 'adjustment') return item.days == null ? 'Ajuste de vencimiento' : `Ajuste de vencimiento (${item.days > 0 ? '+' : ''}${item.days} días)`
  return 'Registro previo'
}

const definingLabel = computed(() => {
  const e = definingEvent.value
  if (!e) return null
  const what = e.kind === 'payment' ? `Pago de ${eventTitle(e)}` : eventTitle(e)
  const by = e.source === 'wompi' ? 'Wompi' : e.source === 'manual' ? (e.created_by_username || 'Admin') : e.source === 'legacy' ? 'registro histórico' : e.source
  return `${what} · ${by}`
})

const paymentTotals = computed(() => {
  const totals = billing.value.totals || []
  return { wompi: totals.find(t => t.source === 'wompi') || null, manual: totals.find(t => t.source === 'manual') || null }
})
const hasTotals = computed(() => paymentTotals.value.wompi || paymentTotals.value.manual)

const referenceStart = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const end = billing.value.period_end
  if (end) {
    const d = new Date(`${end.slice(0, 10)}T00:00:00`)
    if (d > today) return d
  }
  return today
})
const referenceStartLabel = computed(() => formatDate(toISODate(referenceStart.value)))

function flashError(msg) { errorMsg.value = msg; setTimeout(() => { errorMsg.value = '' }, 5000) }
function flashOk(msg) { saveMsg.value = msg; setTimeout(() => { saveMsg.value = '' }, 3000) }

async function markAsPaid({ amountCOP, paidUntilDate, paymentNotes, onSuccess }) {
  if (busy.value) return
  const amountNumber = Number(amountCOP)
  const ok = await confirm({
    title: 'Registrar pago',
    message: `¿Registrar pago manual de ${formatCurrency(amountNumber)}? El bar queda cubierto hasta el ${formatDate(paidUntilDate)}.`,
    danger: false,
    confirmText: 'Registrar pago',
  })
  if (!ok) return
  busy.value = true
  try {
    await postBillingAction(venueId, '/mark-paid', localStorage.getItem('bq_super_token'), {
      days: daysBetween(referenceStart.value, paidUntilDate),
      amount_cents: Math.round(amountNumber * 100),
      notes: (paymentNotes || '').trim() || null,
    })
    flashOk('Pago registrado con éxito')
    if (onSuccess) onSuccess()
    await refresh()
  } catch (e) {
    flashError(e.message)
  } finally {
    busy.value = false
  }
}

async function extendTrial({ trialUntilDate, onSuccess }) {
  if (busy.value) return
  const ok = await confirm({
    title: 'Dar prueba gratis',
    message: `¿Dar prueba gratis hasta el ${formatDate(trialUntilDate)}? No registra ningún cobro.`,
    danger: false,
    confirmText: 'Dar prueba',
  })
  if (!ok) return
  busy.value = true
  try {
    await postBillingAction(venueId, '/extend-trial', localStorage.getItem('bq_super_token'), {
      days: daysBetween(referenceStart.value, trialUntilDate),
    })
    flashOk(`Prueba extendida hasta el ${formatDate(trialUntilDate)}`)
    if (onSuccess) onSuccess()
    await refresh()
  } catch (e) {
    flashError(e.message)
  } finally {
    busy.value = false
  }
}

async function adjustExpiry({ adjustDate, adjustNotes, adjustDeltaLabel, onSuccess }) {
  if (busy.value) return
  const ok = await confirm({
    title: 'Corregir vencimiento',
    message: `¿Fijar el vencimiento exactamente en el ${formatDate(adjustDate)}? ${adjustDeltaLabel} Queda registrado en el historial y se puede anular.`,
    danger: true,
    confirmText: 'Corregir vencimiento',
  })
  if (!ok) return
  busy.value = true
  try {
    await postBillingAction(venueId, '/adjust-expiry', localStorage.getItem('bq_super_token'), {
      paid_until: adjustDate,
      notes: adjustNotes.trim(),
    })
    flashOk(`Vencimiento fijado en el ${formatDate(adjustDate)}`)
    if (onSuccess) onSuccess()
    await refresh()
  } catch (e) {
    flashError(e.message)
  } finally {
    busy.value = false
  }
}

async function voidEvent(item) {
  if (!item || item.status === 'voided' || voidingEventId.value) return
  const ok = await confirm({
    title: 'Anular movimiento',
    message: `¿Anular "${eventTitle(item)}"? El vencimiento se recalcula. Esta acción no se puede deshacer.`,
    danger: true,
    confirmText: 'Anular movimiento',
  })
  if (!ok) return
  voidingEventId.value = item.id
  try {
    await postBillingAction(venueId, `/billing/events/${item.id}/void`, localStorage.getItem('bq_super_token'))
    flashOk('Movimiento anulado')
    await refresh()
  } catch (e) {
    flashError(e.message)
  } finally {
    voidingEventId.value = null
  }
}

async function saveEventNote({ item, body, dateChanged, newDate, onSuccess }) {
  if (!item || savingNote.value) return
  if (dateChanged && definingEvent.value?.id === item.id) {
    const ok = await confirm({
      title: 'Editar movimiento',
      message: `Este movimiento define el vencimiento actual: al guardarlo, el bar quedará cubierto hasta el ${formatDate(newDate)}. ¿Guardar cambios?`,
      danger: false,
      confirmText: 'Guardar cambios',
    })
    if (!ok) return
  }
  savingNote.value = true
  try {
    await updateBillingEvent(venueId, item.id, localStorage.getItem('bq_super_token'), body)
    if (onSuccess) onSuccess()
    flashOk('Movimiento actualizado')
    await refresh()
  } catch (e) {
    flashError(e.message)
  } finally {
    savingNote.value = false
  }
}
</script>

<template>
  <div
    v-if="detail"
    class="card billing-card"
    :class="{
      'billing-overdue': billing.status === 'overdue',
      'billing-suspended': billing.status === 'suspended',
    }"
  >
    <BillingSummary
      :billing="billing"
      :status-badge-info="statusBadgeInfo"
      :period-subtitle="periodSubtitle"
      :defining-label="definingLabel"
      :payment-totals="paymentTotals"
      :has-totals="hasTotals"
    />

    <div class="billing-divider" />

    <BillingActions
      :reference-start-label="referenceStartLabel"
      :reference-start="referenceStart"
      :period-end="billing.period_end"
      :busy="busy"
      :save-msg="saveMsg"
      :error-msg="errorMsg"
      @mark-paid="markAsPaid"
      @extend-trial="extendTrial"
      @adjust-expiry="adjustExpiry"
    />

    <div class="billing-divider" />

    <BillingHistory
      :billing="billing"
      :saving-note="savingNote"
      :voiding-event-id="voidingEventId"
      @save="saveEventNote"
      @void="voidEvent"
      @error="flashError"
    />
  </div>
</template>

<style scoped>
/* =========================================
   CSS GENERAL
   ========================================= */
.billing-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg, 12px); padding: 16px; }
.billing-overdue { border-color: var(--warning) !important; }
.billing-suspended { border-color: var(--danger) !important; }
.billing-divider { border-top: 1px dashed var(--border); margin: 16px 0; }

/* =========================================
   BREAKPOINT 850px
   ========================================= */
@media (min-width: 850px) {
  .billing-card { padding: 20px; }
}

/* =========================================
   BREAKPOINT 360px
   ========================================= */
@media (max-width: 360px) {
  .billing-card { padding: 12px; }
}
</style>
