<script setup>
import { computed, inject, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useConfirmModal } from '../composables/useConfirmModal.js'
import UiButton from './ui/Button.vue'
import UiInput from './ui/Input.vue'
import FormError from './ui/FormError.vue'
import BillingSummary from './billing/BillingSummary.vue'
import BillingHistory from './billing/BillingHistory.vue'
import { postBillingAction, updateBillingEvent } from '../services/billing.js'

const route = useRoute()
const venueId = route.params.venueId
const venueDetail = inject('venueDetail')
if (!venueDetail) throw new Error('venueDetail no disponible')
const { detail, refresh } = venueDetail
const { confirm } = useConfirmModal()

// ponytail: coordinación de formularios, confirmaciones y edición de historial;
// se mantiene aquí hasta extraer esos flujos sin duplicar su estado compartido.

const actionTab = ref('payment')
const busy = ref(false)
const voidingEventId = ref(null)
const editingEventId = ref(null)
const editingNoteText = ref('')
const editingAmountCOP = ref('')
const editingDate = ref('')
const savingNote = ref(false)

const amountCOP = ref('')
const paymentNotes = ref('')
const paidUntilDate = ref('')
const trialUntilDate = ref('')
const adjustDate = ref('')
const adjustNotes = ref('')
const saveMsg = ref('')
const errorMsg = ref('')
const showAllHistory = ref(false)

const currencyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})

function formatCurrency(amount) {
  return currencyFormatter.format(amount || 0)
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const hasTime = dateStr.includes('T') || dateStr.includes(' ')
  const d = new Date(hasTime ? dateStr.replace(' ', 'T') : `${dateStr}T00:00:00`)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}

function toISODate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function daysBetween(fromDate, toDateStr) {
  const to = new Date(`${toDateStr}T00:00:00`)
  return Math.round((to - fromDate) / 86400000)
}

const billing = computed(() => {
  if (detail.value?.billing) return detail.value.billing
  const status = detail.value?.venue?.payment_status || 'active'
  const paidUntil = detail.value?.venue?.paid_until || null
  let daysRemaining = 0
  if (paidUntil) {
    const value = new Date(`${paidUntil.slice(0, 10)}T00:00:00`)
    const today = new Date()
    daysRemaining = Math.round((value - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000)
  }
  return {
    status,
    period_start: null,
    period_end: paidUntil,
    days_remaining: daysRemaining,
    totals: [],
    history: [],
  }
})

const visibleHistory = computed(() => {
  const list = billing.value.history || []
  if (showAllHistory.value) return list
  return list.slice(0, 4)
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

// El movimiento no anulado más reciente es el que definió el vencimiento actual.
const definingEvent = computed(() =>
  (billing.value.history || []).find(e => e.status !== 'voided' && e.status !== 'declined') || null
)

function eventTitle(item) {
  if (item.kind === 'payment') return formatCurrency(item.amount_cents != null ? item.amount_cents / 100 : 0)
  if (item.kind === 'trial') return `Prueba +${item.days || 0} días`
  if (item.kind === 'adjustment') {
    if (item.days == null) return 'Ajuste de vencimiento'
    return `Ajuste de vencimiento (${item.days > 0 ? '+' : ''}${item.days} días)`
  }
  return 'Registro previo'
}

const definingLabel = computed(() => {
  const e = definingEvent.value
  if (!e) return null
  let what = eventTitle(e)
  if (e.kind === 'payment') what = `Pago de ${what}`
  if (e.source === 'wompi') return `${what} · Wompi`
  if (e.source === 'manual') return `${what} · ${e.created_by_username || 'Admin'}`
  if (e.source === 'legacy') return `${what} · registro histórico`
  return `${what} · ${e.source}`
})

const paymentTotals = computed(() => {
  const totals = billing.value.totals || []
  return {
    wompi: totals.find(t => t.source === 'wompi') || null,
    manual: totals.find(t => t.source === 'manual') || null,
  }
})
const hasTotals = computed(() => paymentTotals.value.wompi || paymentTotals.value.manual)

const isValidAmount = computed(() => {
  const n = Number(amountCOP.value)
  return !isNaN(n) && n > 0
})

// El período nuevo arranca donde termina el vigente (o hoy, si ya venció) —
// misma regla que aplica billing_service.record_event en el backend.
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

watch(referenceStart, (start) => {
  if (!paidUntilDate.value) {
    const d = new Date(start)
    d.setDate(d.getDate() + 30)
    paidUntilDate.value = toISODate(d)
  }
  if (!trialUntilDate.value) {
    const d = new Date(start)
    d.setDate(d.getDate() + 15)
    trialUntilDate.value = toISODate(d)
  }
}, { immediate: true })

watch(() => billing.value.period_end, (end) => {
  if (!adjustDate.value && end) adjustDate.value = end.slice(0, 10)
}, { immediate: true })

const isValidPaidUntilDate = computed(() => paidUntilDate.value && daysBetween(referenceStart.value, paidUntilDate.value) > 0)
const isValidTrialDate = computed(() => trialUntilDate.value && daysBetween(referenceStart.value, trialUntilDate.value) > 0)
const isValidAdjust = computed(() => !!adjustDate.value && adjustNotes.value.trim().length >= 3)

// Delta del ajuste contra el vencimiento actual, para anunciarlo antes de confirmar.
const adjustDelta = computed(() => {
  if (!adjustDate.value) return null
  const current = billing.value.period_end
  if (!current) return null
  const from = new Date(`${current.slice(0, 10)}T00:00:00`)
  return daysBetween(from, adjustDate.value)
})
const adjustDeltaLabel = computed(() => {
  const d = adjustDelta.value
  if (d == null || d === 0) return ''
  const abs = Math.abs(d)
  const noun = abs === 1 ? 'día' : 'días'
  return d > 0 ? `Esto agrega ${abs} ${noun}.` : `Esto quita ${abs} ${noun}.`
})

function flashError(msg) {
  errorMsg.value = msg
  setTimeout(() => { errorMsg.value = '' }, 5000)
}

function flashOk(msg) {
  saveMsg.value = msg
  setTimeout(() => { saveMsg.value = '' }, 3000)
}

async function markAsPaid() {
  if (!isValidAmount.value || !isValidPaidUntilDate.value) return
  const amountNumber = Number(amountCOP.value)
  const formatted = formatCurrency(amountNumber)
  const notesText = paymentNotes.value.trim()
  const untilLabel = formatDate(paidUntilDate.value)

  const ok = await confirm({
    title: 'Registrar pago',
    message: `¿Registrar pago manual de ${formatted}? El bar queda cubierto hasta el ${untilLabel}.`,
    danger: false,
    confirmText: 'Registrar pago',
  })
  if (!ok) return

  busy.value = true
  try {
    await postBillingAction(venueId, '/mark-paid', localStorage.getItem('bq_super_token'), {
      days: daysBetween(referenceStart.value, paidUntilDate.value),
      amount_cents: Math.round(amountNumber * 100),
      notes: notesText || null,
    })
    flashOk('Pago registrado con éxito')
    amountCOP.value = ''
    paymentNotes.value = ''
    paidUntilDate.value = ''
    await refresh()
  } catch (e) {
    flashError(e.message)
  } finally {
    busy.value = false
  }
}

async function extendTrial() {
  if (!isValidTrialDate.value) return
  const untilLabel = formatDate(trialUntilDate.value)
  const ok = await confirm({
    title: 'Dar prueba gratis',
    message: `¿Dar prueba gratis hasta el ${untilLabel}? No registra ningún cobro.`,
    danger: false,
    confirmText: 'Dar prueba',
  })
  if (!ok) return

  busy.value = true
  try {
    await postBillingAction(venueId, '/extend-trial', localStorage.getItem('bq_super_token'), { days: daysBetween(referenceStart.value, trialUntilDate.value) })
    flashOk(`Prueba extendida hasta el ${untilLabel}`)
    trialUntilDate.value = ''
    await refresh()
  } catch (e) {
    flashError(e.message)
  } finally {
    busy.value = false
  }
}

async function adjustExpiry() {
  if (!isValidAdjust.value) return
  const untilLabel = formatDate(adjustDate.value)
  const ok = await confirm({
    title: 'Corregir vencimiento',
    message: `¿Fijar el vencimiento exactamente en el ${untilLabel}? ${adjustDeltaLabel.value} Queda registrado en el historial y se puede anular.`,
    danger: true,
    confirmText: 'Corregir vencimiento',
  })
  if (!ok) return

  busy.value = true
  try {
    await postBillingAction(venueId, '/adjust-expiry', localStorage.getItem('bq_super_token'), {
      paid_until: adjustDate.value,
      notes: adjustNotes.value.trim(),
    })
    flashOk(`Vencimiento fijado en el ${untilLabel}`)
    adjustDate.value = ''
    adjustNotes.value = ''
    await refresh()
  } catch (e) {
    flashError(e.message)
  } finally {
    busy.value = false
  }
}

async function voidEvent(item) {
  if (!item || item.status === 'voided') return
  const desc = eventTitle(item)
  const ok = await confirm({
    title: 'Anular movimiento',
    message: `¿Anular "${desc}"? El vencimiento se recalcula. Esta acción no se puede deshacer.`,
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

// Qué campos se editan según el tipo: pago manual → monto y fecha;
// prueba → fecha; el resto (histórico, ajuste) → solo la nota.
function canEditAmount(item) {
  return item.kind === 'payment' && item.source === 'manual' && item.status !== 'voided'
}
function canEditDate(item) {
  return (item.kind === 'payment' || item.kind === 'trial') && item.source === 'manual' && item.status !== 'voided'
}

function startEditNote(item) {
  editingEventId.value = item.id
  editingNoteText.value = item.notes || ''
  editingAmountCOP.value = item.amount_cents != null ? String(item.amount_cents / 100) : ''
  editingDate.value = item.period_end ? item.period_end.slice(0, 10) : ''
}

function cancelEditNote() {
  editingEventId.value = null
  editingNoteText.value = ''
  editingAmountCOP.value = ''
  editingDate.value = ''
}

async function saveEventNote(item) {
  if (!item) return

  const body = { notes: editingNoteText.value.trim() || null }
  if (canEditAmount(item) && editingAmountCOP.value) {
    const n = Number(editingAmountCOP.value)
    if (isNaN(n) || n <= 0) return flashError('Monto inválido')
    body.amount_cents = Math.round(n * 100)
  }
  const dateChanged = canEditDate(item) && editingDate.value && editingDate.value !== (item.period_end || '').slice(0, 10)
  if (dateChanged) body.period_end = editingDate.value

  // Cambiar la fecha del movimiento que define el vencimiento mueve el vencimiento del bar.
  if (dateChanged && definingEvent.value?.id === item.id) {
    const ok = await confirm({
      title: 'Editar movimiento',
      message: `Este movimiento define el vencimiento actual: al guardarlo, el bar quedará cubierto hasta el ${formatDate(editingDate.value)}. ¿Guardar cambios?`,
      danger: false,
      confirmText: 'Guardar cambios',
    })
    if (!ok) return
  }

  savingNote.value = true
  try {
    await updateBillingEvent(venueId, item.id, localStorage.getItem('bq_super_token'), body)
    cancelEditNote()
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

    <!-- Acciones: tabs -->
    <div class="action-tabs" role="tablist" aria-label="Acciones de suscripción">
      <button role="tab" :aria-selected="actionTab === 'payment'" :class="{ selected: actionTab === 'payment' }" @click="actionTab = 'payment'">Registrar pago</button>
      <button role="tab" :aria-selected="actionTab === 'trial'" :class="{ selected: actionTab === 'trial' }" @click="actionTab = 'trial'">Dar prueba</button>
      <button role="tab" :aria-selected="actionTab === 'adjust'" :class="{ selected: actionTab === 'adjust' }" @click="actionTab = 'adjust'">Corregir</button>
    </div>

    <!-- Tab: Pago manual -->
    <div v-if="actionTab === 'payment'" class="action-panel">
      <p class="action-hint">Pago recibido por fuera de Wompi (efectivo, transferencia). El período nuevo arranca el <strong>{{ referenceStartLabel }}</strong>, donde termina el vigente.</p>
      <div class="action-fields">
        <UiInput
          v-model="amountCOP"
          type="number"
          inputmode="numeric"
          placeholder="Monto en COP..."
          aria-label="Monto en pesos COP"
          class="field-amount"
        />
        <label class="field-date-wrap">
          <span>Cubierto hasta</span>
          <UiInput v-model="paidUntilDate" type="date" aria-label="Pagado hasta" class="field-date" />
        </label>
        <UiInput
          v-model="paymentNotes"
          placeholder="Nota del pago (opcional)..."
          aria-label="Nota del pago"
          class="field-notes"
        />
        <UiButton :disabled="busy || !isValidAmount || !isValidPaidUntilDate" class="field-btn" @click="markAsPaid">
          {{ busy ? 'Guardando...' : 'Registrar pago' }}
        </UiButton>
      </div>
    </div>

    <!-- Tab: Prueba -->
    <div v-else-if="actionTab === 'trial'" class="action-panel">
      <p class="action-hint">Días gratis, sin cobro. Se extiende desde el <strong>{{ referenceStartLabel }}</strong> hasta la fecha que elijas.</p>
      <div class="action-fields">
        <label class="field-date-wrap">
          <span>Prueba hasta</span>
          <UiInput v-model="trialUntilDate" type="date" aria-label="Prueba hasta" class="field-date" />
        </label>
        <UiButton variant="secondary" :disabled="busy || !isValidTrialDate" class="field-btn" @click="extendTrial">
          {{ busy ? 'Guardando...' : 'Dar prueba gratis' }}
        </UiButton>
      </div>
    </div>

    <!-- Tab: Corregir -->
    <div v-else class="action-panel">
      <p class="action-hint action-hint-danger">Fija el vencimiento <strong>exactamente</strong> en la fecha elegida — sirve para quitar días mal asignados. La nota es obligatoria y el ajuste queda en el historial (se puede anular).</p>
      <div class="action-fields">
        <label class="field-date-wrap">
          <span>Nuevo vencimiento</span>
          <UiInput v-model="adjustDate" type="date" aria-label="Nuevo vencimiento" class="field-date" />
        </label>
        <UiInput
          v-model="adjustNotes"
          placeholder="Motivo de la corrección (obligatorio)..."
          aria-label="Motivo de la corrección"
          class="field-notes"
        />
        <UiButton variant="danger" :disabled="busy || !isValidAdjust" class="field-btn" @click="adjustExpiry">
          {{ busy ? 'Guardando...' : 'Corregir vencimiento' }}
        </UiButton>
      </div>
      <p v-if="adjustDeltaLabel" class="adjust-delta">{{ adjustDeltaLabel }}</p>
    </div>

    <span v-if="saveMsg" class="save-msg">{{ saveMsg }}</span>
    <FormError :message="errorMsg" />

    <div class="billing-divider" />

    <BillingHistory
      :billing="billing"
      :visible-history="visibleHistory"
      :show-all-history="showAllHistory"
      :editing-event-id="editingEventId"
      :editing-note-text="editingNoteText"
      :editing-amount-c-o-p="editingAmountCOP"
      :editing-date="editingDate"
      :saving-note="savingNote"
      :voiding-event-id="voidingEventId"
      @toggle-history="showAllHistory = !showAllHistory"
      @start-edit="startEditNote"
      @void="voidEvent"
      @save="saveEventNote"
      @cancel="cancelEditNote"
      @update:editing-note-text="editingNoteText = $event"
      @update:editing-amount-c-o-p="editingAmountCOP = $event"
      @update:editing-date="editingDate = $event"
    />
  </div>
</template>

<style scoped>
/* =========================================
   CSS GENERAL
   ========================================= */
.billing-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg, 12px);
  padding: 16px;
}

.billing-overdue {
  border-color: var(--warning) !important;
}

.billing-suspended {
  border-color: var(--danger) !important;
}

.billing-divider {
  border-top: 1px dashed var(--border);
  margin: 16px 0;
}

/* Tabs de acción */
.action-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 12px;
  background: var(--bg-elevated);
  border-radius: var(--radius-sm, 8px);
  padding: 3px;
}

.action-tabs button {
  flex: 1;
  padding: 7px 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.action-tabs button.selected {
  background: var(--bg-card);
  color: var(--text);
}

.action-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.action-hint {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.5;
}

.action-hint strong { color: var(--text); }

.action-hint-danger { color: var(--warning); }
.action-hint-danger strong { color: var(--warning); }

.action-fields {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-amount,
.field-notes,
.field-date,
.field-btn {
  width: 100%;
}

.field-date-wrap {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 600;
}

.adjust-delta {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  color: var(--warning);
}

.save-msg {
  display: block;
  margin-top: 8px;
  color: var(--success);
  font-size: 13px;
  font-weight: 600;
}

/* =========================================
   BREAKPOINT 850px
   ========================================= */
@media (min-width: 850px) {
  .billing-card {
    padding: 20px;
  }

  .action-fields {
    flex-direction: row;
    align-items: flex-end;
  }

  .field-amount {
    flex: 0 0 140px;
  }

  .field-date-wrap {
    flex: 0 0 160px;
  }

  .field-notes {
    flex: 1;
  }

  .field-btn {
    width: auto;
    white-space: nowrap;
  }
}

/* =========================================
   BREAKPOINT 360px
   ========================================= */
@media (max-width: 360px) {
  .billing-card {
    padding: 12px;
  }
}
</style>
