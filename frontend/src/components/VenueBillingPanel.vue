<script setup>
import { computed, inject, ref } from 'vue'
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

const markingPaid = ref(false)
const extendingTrial = ref(0)
const voidingEventId = ref(null)
const editingEventId = ref(null)
const editingNoteText = ref('')
const savingNote = ref(false)

const amountCOP = ref('')
const paymentNotes = ref('')
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
  const d = new Date(dateStr.replace(' ', 'T'))
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
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
    history: [],
  }
})

const visibleHistory = computed(() => {
  const list = billing.value.history || []
  if (showAllHistory.value) return list
  return list.slice(0, 4)
})

const isValidAmount = computed(() => {
  const n = Number(amountCOP.value)
  return !isNaN(n) && n > 0
})

const statusBadgeInfo = computed(() => {
  const s = billing.value.status
  if (s === 'active') return { variant: 'success', label: 'Al día' }
  if (s === 'overdue') return { variant: 'warning', label: 'Vencido (período de gracia)' }
  if (s === 'suspended') return { variant: 'danger', label: 'Suspendido por falta de pago' }
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

async function markAsPaid() {
  if (!isValidAmount.value) return

  const amountNumber = Number(amountCOP.value)
  const amountCents = Math.round(amountNumber * 100)
  const formatted = formatCurrency(amountNumber)
  const notesText = paymentNotes.value.trim()
  const confirmMsg = notesText
    ? `¿Registrar pago de ${formatted} (Nota: "${notesText}")? Esto extiende el vencimiento 1 mes.`
    : `¿Registrar pago de ${formatted}? Esto extiende el vencimiento 1 mes.`

  const ok = await confirm({
    title: 'Registrar pago',
    message: confirmMsg,
    danger: false,
    confirmText: 'Registrar pago',
  })
  if (!ok) return

  markingPaid.value = true
  errorMsg.value = ''
  try {
    const res = await fetch(`${API}/api/superadmin/venues/${venueId}/mark-paid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers() },
      body: JSON.stringify({
        months: 1,
        amount_cents: amountCents,
        notes: notesText || null,
      }),
    })
    if (res.ok) {
      saveMsg.value = 'Pago registrado con éxito'
      amountCOP.value = ''
      paymentNotes.value = ''
      await refresh()
      setTimeout(() => { saveMsg.value = '' }, 3000)
    } else {
      const err = await res.json().catch(() => ({}))
      errorMsg.value = err.detail || 'Error al registrar pago'
      setTimeout(() => { errorMsg.value = '' }, 5000)
    }
  } catch (e) {
    errorMsg.value = e.message || 'Error al registrar pago'
    setTimeout(() => { errorMsg.value = '' }, 5000)
  } finally {
    markingPaid.value = false
  }
}

async function extendTrial(days) {
  const ok = await confirm({
    title: 'Extender prueba',
    message: `¿Extender la prueba de este bar ${days} días?`,
    danger: false,
    confirmText: 'Extender prueba',
  })
  if (!ok) return

  extendingTrial.value = days
  errorMsg.value = ''
  try {
    const res = await fetch(`${API}/api/superadmin/venues/${venueId}/extend-trial`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers() },
      body: JSON.stringify({ days }),
    })
    if (res.ok) {
      saveMsg.value = `Prueba extendida ${days} días`
      await refresh()
      setTimeout(() => { saveMsg.value = '' }, 3000)
    } else {
      const err = await res.json().catch(() => ({}))
      errorMsg.value = err.detail || 'Error al extender la prueba'
      setTimeout(() => { errorMsg.value = '' }, 5000)
    }
  } catch (e) {
    errorMsg.value = e.message || 'Error al extender la prueba'
    setTimeout(() => { errorMsg.value = '' }, 5000)
  } finally {
    extendingTrial.value = 0
  }
}

async function voidEvent(item) {
  if (!item || item.status === 'voided') return

  let desc = 'este movimiento'
  if (item.kind === 'payment') {
    desc = `pago de ${formatCurrency(item.amount_cents != null ? item.amount_cents / 100 : 0)}`
  } else if (item.kind === 'trial') {
    desc = `prueba de ${item.days || 0} días`
  } else if (item.kind === 'legacy') {
    desc = 'registro previo'
  }

  const ok = await confirm({
    title: 'Anular movimiento',
    message: `¿Anular ${desc}? Esta acción no se puede deshacer.`,
    danger: true,
    confirmText: 'Anular movimiento',
  })
  if (!ok) return

  voidingEventId.value = item.id
  errorMsg.value = ''
  try {
    const res = await fetch(`${API}/api/superadmin/venues/${venueId}/billing/events/${item.id}/void`, {
      method: 'POST',
      headers: headers(),
    })
    if (res.ok) {
      saveMsg.value = 'Movimiento anulado'
      await refresh()
      setTimeout(() => { saveMsg.value = '' }, 3000)
    } else {
      const err = await res.json().catch(() => ({}))
      errorMsg.value = err.detail || 'Error al anular movimiento'
      setTimeout(() => { errorMsg.value = '' }, 5000)
    }
  } catch (e) {
    errorMsg.value = e.message || 'Error al anular movimiento'
    setTimeout(() => { errorMsg.value = '' }, 5000)
  } finally {
    voidingEventId.value = null
  }
}

function startEditNote(item) {
  editingEventId.value = item.id
  editingNoteText.value = item.notes || ''
}

function cancelEditNote() {
  editingEventId.value = null
  editingNoteText.value = ''
}

async function saveEventNote(item) {
  if (!item) return
  savingNote.value = true
  errorMsg.value = ''
  try {
    const res = await fetch(`${API}/api/superadmin/venues/${venueId}/billing/events/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...headers() },
      body: JSON.stringify({ notes: editingNoteText.value.trim() || null }),
    })
    if (res.ok) {
      editingEventId.value = null
      saveMsg.value = 'Nota actualizada'
      await refresh()
      setTimeout(() => { saveMsg.value = '' }, 2500)
    } else {
      const err = await res.json().catch(() => ({}))
      errorMsg.value = err.detail || 'Error al actualizar nota'
      setTimeout(() => { errorMsg.value = '' }, 5000)
    }
  } catch (e) {
    errorMsg.value = e.message || 'Error al actualizar nota'
    setTimeout(() => { errorMsg.value = '' }, 5000)
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
    <!-- Header: Title + Status Badge -->
    <div class="billing-header">
      <p class="section-title">FACTURACIÓN</p>
      <Badge :variant="statusBadgeInfo.variant">
        {{ statusBadgeInfo.label }}
      </Badge>
    </div>

    <!-- Hero Section: Days & Period Dates -->
    <div class="billing-hero">
      <div class="hero-days">
        <span class="days-number" :class="'ps-' + billing.status">
          {{ billing.days_remaining != null ? Math.abs(billing.days_remaining) : '—' }}
        </span>
        <span class="days-label">{{ periodSubtitle }}</span>
      </div>
      <div v-if="billing.period_start || billing.period_end" class="period-range">
        <span v-if="billing.period_start && billing.period_end">
          {{ billing.period_start }} → {{ billing.period_end }}
        </span>
        <span v-else-if="billing.period_end">
          Pagado hasta el {{ billing.period_end }}
        </span>
      </div>
    </div>

    <!-- Separator -->
    <div class="billing-divider" />

    <!-- Action Section: Mark Paid -->
    <div class="billing-action-wrap">
      <span class="action-label">Registrar pago</span>
      <div class="billing-action">
        <UiInput
          v-model="amountCOP"
          type="number"
          inputmode="numeric"
          placeholder="Monto en COP..."
          aria-label="Monto en pesos COP"
          class="amount-input"
        />
        <UiInput
          v-model="paymentNotes"
          placeholder="Nota del pago (opcional)..."
          aria-label="Nota del pago"
          class="notes-input"
        />
        <UiButton
          :disabled="markingPaid || !isValidAmount"
          class="pay-btn"
          @click="markAsPaid"
        >
          {{ markingPaid ? 'Registrando...' : 'Marcar pagado (+1 mes)' }}
        </UiButton>
      </div>
    </div>

    <!-- Separator -->
    <div class="billing-divider" />

    <!-- Action Section: Extend Trial -->
    <div class="trial-action">
      <span class="action-label">Extender prueba</span>
      <div class="trial-buttons">
        <UiButton
          v-for="days in [7, 15, 30]"
          :key="days"
          variant="secondary"
          class="trial-btn"
          :disabled="extendingTrial !== 0"
          @click="extendTrial(days)"
        >
          {{ extendingTrial === days ? 'Extendiendo...' : `+${days} días` }}
        </UiButton>
      </div>
    </div>

    <span v-if="saveMsg" class="save-msg">{{ saveMsg }}</span>
    <span v-if="errorMsg" class="error-msg" role="alert">{{ errorMsg }}</span>

    <!-- Separator -->
    <div class="billing-divider" />

    <!-- History Section -->
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
          <!-- Line 1: Kind/Amount + Origin/Status Badges + Card Actions -->
          <div class="history-line-1">
            <div class="history-main-label">
              <strong v-if="item.kind === 'payment'" class="payment-amount">
                {{ formatCurrency(item.amount_cents != null ? item.amount_cents / 100 : 0) }}
              </strong>
              <strong v-else-if="item.kind === 'trial'" class="trial-amount">
                Prueba +{{ item.days || 0 }} días
              </strong>
              <span v-else class="legacy-amount">
                Registro previo
              </span>
            </div>

            <div class="history-right-wrap">
              <div class="history-badges">
                <!-- Origin Badge -->
                <Badge v-if="item.source === 'manual'" variant="neutral">
                  Manual · {{ item.created_by_username || 'Admin' }}
                </Badge>
                <Badge v-else-if="item.source === 'wompi'" variant="info">
                  Wompi
                </Badge>
                <Badge v-else-if="item.source === 'legacy'" variant="neutral">
                  Histórico
                </Badge>
                <Badge v-else-if="item.source" variant="neutral">
                  {{ item.source }}
                </Badge>

                <!-- State Badge -->
                <Badge v-if="item.status === 'voided'" variant="danger">
                  Anulado
                </Badge>
                <Badge v-else-if="item.status === 'declined'" variant="danger">
                  Rechazado
                </Badge>
                <Badge v-else-if="item.status === 'pending'" variant="warning">
                  Pendiente
                </Badge>
              </div>

              <!-- Item Actions (Edit Note & Void) -->
              <div v-if="item.status !== 'voided'" class="item-actions">
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

          <!-- Line 2: Meta info -->
          <div class="history-line-2">
            <span>{{ formatDate(item.created_at) }}</span>
            <span v-if="item.days">&middot; {{ item.days }} días</span>
            <span v-if="item.period_start && item.period_end">&middot; {{ item.period_start }} → {{ item.period_end }}</span>
          </div>

          <!-- Line 3: Note (Display or Inline Edit) -->
          <div v-if="editingEventId === item.id" class="note-edit-row">
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

.ps-active {
  color: var(--success);
}

.ps-overdue {
  color: var(--warning);
}

.ps-suspended {
  color: var(--danger);
}

.billing-divider {
  border-top: 1px dashed var(--border);
  margin: 16px 0;
}

.action-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  display: block;
  margin-bottom: 8px;
}

.billing-action-wrap {
  display: flex;
  flex-direction: column;
}

.billing-action {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.amount-input,
.notes-input {
  width: 100%;
}

.pay-btn {
  width: 100%;
}

.trial-action {
  display: flex;
  flex-direction: column;
}

.trial-buttons {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.trial-btn {
  flex: 1;
  min-width: 80px;
  padding: 8px 10px;
  font-size: 12px;
  text-align: center;
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
.history-card-voided .trial-amount,
.history-card-voided .legacy-amount {
  text-decoration: line-through;
}

.history-line-1 {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.payment-amount,
.trial-amount {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
}

.legacy-amount {
  font-size: 13px;
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
}

.note-inline-input {
  flex: 1;
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

  .billing-action {
    flex-direction: row;
    align-items: center;
  }

  .amount-input {
    flex: 0 0 140px;
  }

  .notes-input {
    flex: 1;
  }

  .pay-btn {
    width: auto;
    white-space: nowrap;
  }

  .trial-action {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }

  .trial-buttons {
    flex: initial;
  }

  .trial-btn {
    flex: initial;
  }

  .payment-amount,
  .trial-amount {
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
