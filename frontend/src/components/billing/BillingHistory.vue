<script setup>
import { computed, ref } from 'vue'
import Badge from '../ui/Badge.vue'
import UiInput from '../ui/Input.vue'

const props = defineProps({
  billing: { type: Object, required: true },
  savingNote: Boolean,
  voidingEventId: { type: [String, Number], default: null },
})

const emit = defineEmits(['save', 'void', 'error'])

const showAllHistory = ref(false)
const editingEventId = ref(null)
const editingNoteText = ref('')
const editingAmountCOP = ref('')
const editingDate = ref('')

const currency = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})

const formatDate = (value) => {
  if (!value) return ''
  const hasTime = value.includes('T') || value.includes(' ')
  const d = new Date(hasTime ? value.replace(' ', 'T') : `${value}T00:00:00`)
  if (isNaN(d.getTime())) return value
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}

function eventTitle(item) {
  if (item.kind === 'payment') return currency.format((item.amount_cents || 0) / 100)
  if (item.kind === 'trial') return `Prueba +${item.days || 0} días`
  if (item.kind === 'adjustment') {
    if (item.days == null) return 'Ajuste de vencimiento'
    return `Ajuste de vencimiento (${item.days > 0 ? '+' : ''}${item.days} días)`
  }
  return 'Registro previo'
}

const visibleHistory = computed(() => {
  const list = props.billing.history || []
  if (showAllHistory.value) return list
  return list.slice(0, 4)
})

const canEditAmount = item => item.kind === 'payment' && item.source === 'manual' && item.status !== 'voided'
const canEditDate = item => (item.kind === 'payment' || item.kind === 'trial') && item.source === 'manual' && item.status !== 'voided'

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

function saveEditNote(item) {
  if (!item) return
  const body = { notes: editingNoteText.value.trim() || null }
  if (canEditAmount(item) && editingAmountCOP.value) {
    const n = Number(editingAmountCOP.value)
    if (isNaN(n) || n <= 0) {
      emit('error', 'Monto inválido')
      return
    }
    body.amount_cents = Math.round(n * 100)
  }
  const dateChanged = canEditDate(item) && editingDate.value && editingDate.value !== (item.period_end || '').slice(0, 10)
  if (dateChanged) body.period_end = editingDate.value

  emit('save', {
    item,
    body,
    dateChanged,
    newDate: editingDate.value,
    onSuccess: cancelEditNote,
  })
}
</script>

<template>
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
                @click="$emit('void', item)"
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
            @keydown.enter="saveEditNote(item)"
            @keydown.esc="cancelEditNote"
          />
          <div class="note-inline-buttons">
            <button
              type="button"
              class="note-btn note-save-btn"
              :disabled="savingNote"
              title="Guardar nota"
              aria-label="Guardar nota"
              @click="saveEditNote(item)"
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
</template>

<style scoped>
/* =========================================
   CSS GENERAL
   ========================================= */
.history-section { display: flex; flex-direction: column; gap: 10px; }
.history-header { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.history-title { margin: 0; color: var(--text-muted); font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; }
.toggle-history-btn { background: transparent; border: none; color: var(--primary); font-size: 12px; font-weight: 600; cursor: pointer; padding: 2px 4px; }
.toggle-history-btn:hover { text-decoration: underline; }
.history-list { display: flex; flex-direction: column; gap: 8px; }
.history-card { background: var(--bg-elevated); border-radius: var(--radius-sm, 8px); padding: 10px 12px; display: flex; flex-direction: column; gap: 4px; transition: opacity 0.15s ease; }
.history-card-voided { opacity: 0.55; }
.history-card-voided .payment-amount, .history-card-voided .adjustment-amount, .history-card-voided .legacy-amount { text-decoration: line-through; }
.history-line-1 { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.payment-amount { font-size: 14px; font-weight: 700; color: var(--text); }
.adjustment-amount { font-size: 13px; font-weight: 700; color: var(--warning); }
.legacy-amount { font-size: 13px; font-weight: 600; color: var(--text-muted); }
.history-right-wrap { display: flex; align-items: center; gap: 8px; }
.history-badges { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.item-actions { display: flex; align-items: center; gap: 4px; }
.action-icon-btn { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 4px; background: transparent; border: 1px solid var(--border); color: var(--text-muted); cursor: pointer; transition: all 0.15s ease; padding: 0; }
.action-icon-btn:hover { color: var(--text); border-color: var(--primary); background: var(--bg-card); }
.action-void-btn:hover { color: var(--danger); border-color: var(--danger); background: var(--danger-soft); }
.action-icon-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.history-line-2 { font-size: 12px; color: var(--text-muted); display: flex; align-items: center; gap: 4px; flex-wrap: wrap; font-variant-numeric: tabular-nums; }
.provider-ref { font-family: ui-monospace, monospace; font-size: 11px; overflow-wrap: anywhere; }
.history-line-3 { font-size: 12px; color: var(--text-muted); font-style: italic; margin-top: 2px; word-break: break-word; }
.note-edit-row { display: flex; align-items: center; gap: 6px; margin-top: 4px; flex-wrap: wrap; }
.note-inline-input { flex: 1; min-width: 140px; font-size: 12px; padding: 4px 8px; }
.edit-inline-amount { flex: 0 0 110px; font-size: 12px; padding: 4px 8px; }
.edit-inline-date { flex: 0 0 130px; font-size: 12px; padding: 4px 8px; }
.note-inline-buttons { display: flex; gap: 4px; }
.note-btn { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 4px; font-size: 12px; font-weight: 700; cursor: pointer; border: 1px solid var(--border); transition: all 0.15s ease; }
.note-save-btn { background: var(--success-soft); color: var(--success); border-color: var(--border-soft); }
.note-save-btn:hover { background: var(--success); color: var(--bg); }
.note-cancel-btn { background: var(--bg-card); color: var(--text-muted); }
.note-cancel-btn:hover { color: var(--text); border-color: var(--text-muted); }
.history-empty { text-align: center; padding: 16px 0; color: var(--text-muted); font-size: 13px; margin: 0; }

/* =========================================
   BREAKPOINT 850px
   ========================================= */
@media (min-width: 850px) {
  .payment-amount { font-size: 15px; }
}

/* =========================================
   BREAKPOINT 360px
   ========================================= */
@media (max-width: 360px) {
  .history-line-1 { flex-direction: column; align-items: flex-start; gap: 6px; }
  .history-right-wrap { width: 100%; justify-content: space-between; }
}
</style>
