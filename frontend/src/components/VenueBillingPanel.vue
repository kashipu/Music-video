<script setup>
import { computed, inject, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useConfirmModal } from '../composables/useConfirmModal.js'
import Badge from './ui/Badge.vue'
import UiButton from './ui/Button.vue'
import UiInput from './ui/Input.vue'

const route = useRoute()
const API = import.meta.env.VITE_API_URL || ''
const venueId = route.params.venueId
const venueDetail = inject('venueDetail')
if (!venueDetail) throw new Error('venueDetail no disponible')
const { detail, refresh } = venueDetail
const { confirm } = useConfirmModal()

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

function headers() {
  return { Authorization: `Bearer ${localStorage.getItem('bq_super_token')}` }
}

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

async function post(path, body) {
  const res = await fetch(`${API}/api/superadmin/venues/${venueId}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers() },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Error al guardar')
  }
  return res
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
    await post('/mark-paid', {
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
    await post('/extend-trial', { days: daysBetween(referenceStart.value, trialUntilDate.value) })
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
    await post('/adjust-expiry', {
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
    await post(`/billing/events/${item.id}/void`)
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
    const res = await fetch(`${API}/api/superadmin/venues/${venueId}/billing/events/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...headers() },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Error al actualizar el movimiento')
    }
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
    <!-- Header -->
    <div class="billing-header">
      <p class="section-title">SUSCRIPCIÓN</p>
      <Badge :variant="statusBadgeInfo.variant">
        {{ statusBadgeInfo.label }}
      </Badge>
    </div>

    <!-- Hero: días + período + qué lo define -->
    <div class="billing-hero">
      <div class="hero-days">
        <span class="days-number" :class="'ps-' + billing.status">
          {{ billing.days_remaining != null ? Math.abs(billing.days_remaining) : '—' }}
        </span>
        <span class="days-label">{{ periodSubtitle }}</span>
      </div>
      <div v-if="billing.period_start || billing.period_end" class="period-range">
        <span v-if="billing.period_start && billing.period_end">
          {{ formatDate(billing.period_start) }} → {{ formatDate(billing.period_end) }}
        </span>
        <span v-else-if="billing.period_end">
          Cubierto hasta el {{ formatDate(billing.period_end) }}
        </span>
      </div>
      <div v-if="definingLabel" class="defining-line">
        Definido por: <strong>{{ definingLabel }}</strong>
      </div>
    </div>

    <!-- Totales de conciliación -->
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
    <span v-if="errorMsg" class="error-msg" role="alert">{{ errorMsg }}</span>

    <div class="billing-divider" />

    <!-- Historial -->
    <div class="history-section">
      <div class="history-header">
        <p class="history-title">HISTORIAL ({{ billing.history?.length || 0 }})</p>
        <button
          v-if="billing.history?.length > 4"
          type="button"
          class="toggle-history-btn"
          @click="showAllHistory = !showAllHistory"
        >
          {{ showAllHistory ? 'Ver menos' : `Ver todos (${billing.history.length})` }}
        </button>
      </div>

      <div v-if="visibleHistory.length" class="history-list">
        <div
          v-for="item in visibleHistory"
          :key="item.id || item.created_at"
          class="history-card"
          :class="{ 'history-card-voided': item.status === 'voided' }"
        >
          <div class="history-line-1">
            <div class="history-main-label">
              <strong :class="item.kind === 'adjustment' ? 'adjustment-amount' : item.kind === 'legacy' ? 'legacy-amount' : 'payment-amount'">
                {{ eventTitle(item) }}
              </strong>
            </div>

            <div class="history-right-wrap">
              <div class="history-badges">
                <Badge v-if="item.source === 'wompi'" variant="info">Wompi</Badge>
                <Badge v-else-if="item.kind === 'adjustment'" variant="warning">
                  Ajuste · {{ item.created_by_username || 'Admin' }}
                </Badge>
                <Badge v-else-if="item.source === 'manual'" variant="neutral">
                  Manual · {{ item.created_by_username || 'Admin' }}
                </Badge>
                <Badge v-else-if="item.source === 'legacy'" variant="neutral">Histórico</Badge>
                <Badge v-else-if="item.source" variant="neutral">{{ item.source }}</Badge>

                <Badge v-if="item.status === 'voided'" variant="danger">Anulado</Badge>
                <Badge v-else-if="item.status === 'declined'" variant="danger">Rechazado</Badge>
                <Badge v-else-if="item.status === 'pending'" variant="warning">Pendiente</Badge>
              </div>

              <!-- Wompi es el registro contra el que se concilia: no se edita ni anula -->
              <div v-if="item.status !== 'voided' && item.source !== 'wompi'" class="item-actions">
                <button
                  type="button"
                  class="action-icon-btn"
                  title="Editar nota"
                  aria-label="Editar nota"
                  @click="startEditNote(item)"
                >
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                </button>
                <button
                  type="button"
                  class="action-icon-btn action-void-btn"
                  :disabled="voidingEventId === item.id"
                  title="Anular movimiento"
                  aria-label="Anular movimiento"
                  @click="voidEvent(item)"
                >
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div class="history-line-2">
            <span>{{ formatDate(item.created_at) }}</span>
            <span v-if="item.days && item.kind !== 'adjustment'">&middot; {{ item.days }} días</span>
            <span v-if="item.period_start && item.period_end">&middot; {{ formatDate(item.period_start) }} → {{ formatDate(item.period_end) }}</span>
            <span v-if="item.provider_ref" class="provider-ref" :title="item.provider_ref">&middot; ref {{ item.provider_ref }}</span>
          </div>

          <div v-if="editingEventId === item.id" class="note-edit-row">
            <UiInput
              v-if="canEditAmount(item)"
              v-model="editingAmountCOP"
              type="number"
              inputmode="numeric"
              placeholder="Monto COP..."
              aria-label="Editar monto en pesos COP"
              class="edit-inline-amount"
              @keydown.esc="cancelEditNote"
            />
            <UiInput
              v-if="canEditDate(item)"
              v-model="editingDate"
              type="date"
              aria-label="Editar fecha de fin del período"
              class="edit-inline-date"
              @keydown.esc="cancelEditNote"
            />
            <UiInput
              v-model="editingNoteText"
              placeholder="Nota del movimiento..."
              aria-label="Editar nota del movimiento"
              class="note-inline-input"
              @keydown.enter="saveEventNote(item)"
              @keydown.esc="cancelEditNote"
            />
            <div class="note-inline-buttons">
              <button
                type="button"
                class="note-btn note-save-btn"
                :disabled="savingNote"
                title="Guardar nota"
                aria-label="Guardar nota"
                @click="saveEventNote(item)"
              >
                ✓
              </button>
              <button
                type="button"
                class="note-btn note-cancel-btn"
                :disabled="savingNote"
                title="Cancelar edición"
                aria-label="Cancelar edición"
                @click="cancelEditNote"
              >
                ✕
              </button>
            </div>
          </div>
          <div v-else-if="item.notes" class="history-line-3">
            {{ item.notes }}
          </div>
        </div>
      </div>

      <p v-else class="history-empty">
        Sin movimientos registrados
      </p>
    </div>
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

.billing-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.section-title {
  margin: 0;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.billing-overdue {
  border-color: var(--warning) !important;
}

.billing-suspended {
  border-color: var(--danger) !important;
}

.billing-hero {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.hero-days {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.days-number {
  font-size: 28px;
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.days-label {
  font-size: 13px;
  color: var(--text-muted);
  font-weight: 500;
}

.period-range {
  font-size: 13px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  margin-top: 2px;
}

.defining-line {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}

.defining-line strong {
  color: var(--text);
  font-weight: 600;
}

.ps-active { color: var(--success); }
.ps-overdue { color: var(--warning); }
.ps-suspended { color: var(--danger); }

/* Totales de conciliación */
.totals-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 12px;
}

.total-chip {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 12px;
  background: var(--bg-elevated);
  border-radius: var(--radius-sm, 8px);
  min-width: 130px;
}

.total-label {
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.total-chip strong {
  font-size: 15px;
  color: var(--text);
}

.total-count {
  font-size: 11px;
  color: var(--text-muted);
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

.error-msg {
  display: block;
  margin-top: 8px;
  color: var(--danger);
  font-size: 13px;
  font-weight: 600;
}

/* History */
.history-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.history-title {
  margin: 0;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.toggle-history-btn {
  background: transparent;
  border: none;
  color: var(--primary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  padding: 2px 4px;
}

.toggle-history-btn:hover {
  text-decoration: underline;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.history-card {
  background: var(--bg-elevated);
  border-radius: var(--radius-sm, 8px);
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition: opacity 0.15s ease;
}

.history-card-voided {
  opacity: 0.55;
}

.history-card-voided .payment-amount,
.history-card-voided .adjustment-amount,
.history-card-voided .legacy-amount {
  text-decoration: line-through;
}

.history-line-1 {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.payment-amount {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
}

.adjustment-amount {
  font-size: 13px;
  font-weight: 700;
  color: var(--warning);
}

.legacy-amount {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
}

.history-right-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.history-badges {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.item-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.action-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s ease;
  padding: 0;
}

.action-icon-btn:hover {
  color: var(--text);
  border-color: var(--primary);
  background: var(--bg-card);
}

.action-void-btn:hover {
  color: var(--danger);
  border-color: var(--danger);
  background: var(--danger-soft);
}

.action-icon-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.history-line-2 {
  font-size: 12px;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  font-variant-numeric: tabular-nums;
}

.provider-ref {
  font-family: ui-monospace, monospace;
  font-size: 11px;
  overflow-wrap: anywhere;
}

.history-line-3 {
  font-size: 12px;
  color: var(--text-muted);
  font-style: italic;
  margin-top: 2px;
  word-break: break-word;
}

/* Note edit row */
.note-edit-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  flex-wrap: wrap;
}

.note-inline-input {
  flex: 1;
  min-width: 140px;
  font-size: 12px;
  padding: 4px 8px;
}

.edit-inline-amount {
  flex: 0 0 110px;
  font-size: 12px;
  padding: 4px 8px;
}

.edit-inline-date {
  flex: 0 0 130px;
  font-size: 12px;
  padding: 4px 8px;
}

.note-inline-buttons {
  display: flex;
  gap: 4px;
}

.note-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  border: 1px solid var(--border);
  transition: all 0.15s ease;
}

.note-save-btn {
  background: var(--success-soft);
  color: var(--success);
  border-color: var(--border-soft);
}

.note-save-btn:hover {
  background: var(--success);
  color: var(--bg);
}

.note-cancel-btn {
  background: var(--bg-card);
  color: var(--text-muted);
}

.note-cancel-btn:hover {
  color: var(--text);
  border-color: var(--text-muted);
}

.history-empty {
  text-align: center;
  padding: 16px 0;
  color: var(--text-muted);
  font-size: 13px;
  margin: 0;
}

/* =========================================
   BREAKPOINT 850px
   ========================================= */
@media (min-width: 850px) {
  .billing-card {
    padding: 20px;
  }

  .days-number {
    font-size: 32px;
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

  .payment-amount {
    font-size: 15px;
  }
}

/* =========================================
   BREAKPOINT 360px
   ========================================= */
@media (max-width: 360px) {
  .billing-card {
    padding: 12px;
  }

  .hero-days {
    flex-direction: column;
    gap: 2px;
  }

  .days-number {
    font-size: 24px;
  }

  .history-line-1 {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }

  .history-right-wrap {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
