<script setup>
import { computed, ref, watch } from 'vue'
import UiButton from '../ui/Button.vue'
import UiInput from '../ui/Input.vue'
import FormError from '../ui/FormError.vue'

const props = defineProps({
  referenceStartLabel: { type: String, required: true },
  referenceStart: { type: Date, required: true },
  periodEnd: { type: String, default: null },
  busy: Boolean,
  saveMsg: { type: String, default: '' },
  errorMsg: { type: String, default: '' },
  initialTab: { type: String, default: 'payment' },
})

const emit = defineEmits(['mark-paid', 'extend-trial', 'adjust-expiry'])

const actionTab = ref(props.initialTab)
const amountCOP = ref('')
const paymentNotes = ref('')
const paidUntilDate = ref('')
const trialUntilDate = ref('')
const adjustDate = ref('')
const adjustNotes = ref('')

const toISODate = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const daysBetween = (fromDate, toDateStr) => Math.round((new Date(`${toDateStr}T00:00:00`) - fromDate) / 86400000)

const isValidAmount = computed(() => {
  const n = Number(amountCOP.value)
  return !isNaN(n) && n > 0
})

watch(() => props.referenceStart, (start) => {
  if (!start) return
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

watch(() => props.periodEnd, (end) => {
  if (!adjustDate.value && end) adjustDate.value = end.slice(0, 10)
}, { immediate: true })

const isValidPaidUntilDate = computed(() => paidUntilDate.value && daysBetween(props.referenceStart, paidUntilDate.value) > 0)
const isValidTrialDate = computed(() => trialUntilDate.value && daysBetween(props.referenceStart, trialUntilDate.value) > 0)
const isValidAdjust = computed(() => !!adjustDate.value && adjustNotes.value.trim().length >= 3)

const adjustDelta = computed(() => {
  if (!adjustDate.value || !props.periodEnd) return null
  const from = new Date(`${props.periodEnd.slice(0, 10)}T00:00:00`)
  return daysBetween(from, adjustDate.value)
})

const adjustDeltaLabel = computed(() => {
  const d = adjustDelta.value
  if (d == null || d === 0) return ''
  const abs = Math.abs(d)
  const noun = abs === 1 ? 'día' : 'días'
  return d > 0 ? `Esto agrega ${abs} ${noun}.` : `Esto quita ${abs} ${noun}.`
})

function handleMarkPaid() {
  if (!isValidAmount.value || !isValidPaidUntilDate.value) return
  emit('mark-paid', {
    amountCOP: amountCOP.value,
    paidUntilDate: paidUntilDate.value,
    paymentNotes: paymentNotes.value,
    onSuccess: () => {
      amountCOP.value = ''
      paymentNotes.value = ''
      paidUntilDate.value = ''
    },
  })
}

function handleExtendTrial() {
  if (!isValidTrialDate.value) return
  emit('extend-trial', {
    trialUntilDate: trialUntilDate.value,
    onSuccess: () => {
      trialUntilDate.value = ''
    },
  })
}

function handleAdjustExpiry() {
  if (!isValidAdjust.value) return
  emit('adjust-expiry', {
    adjustDate: adjustDate.value,
    adjustNotes: adjustNotes.value,
    adjustDeltaLabel: adjustDeltaLabel.value,
    onSuccess: () => {
      adjustDate.value = ''
      adjustNotes.value = ''
    },
  })
}
</script>

<template>
  <div class="billing-actions">
    <div class="action-tabs" role="tablist" aria-label="Acciones de suscripción">
      <button role="tab" :aria-selected="actionTab === 'payment'" :class="{ selected: actionTab === 'payment' }" @click="actionTab = 'payment'">Registrar pago</button>
      <button role="tab" :aria-selected="actionTab === 'trial'" :class="{ selected: actionTab === 'trial' }" @click="actionTab = 'trial'">Dar prueba</button>
      <button role="tab" :aria-selected="actionTab === 'adjust'" :class="{ selected: actionTab === 'adjust' }" @click="actionTab = 'adjust'">Corregir</button>
    </div>

    <!-- Tab: Pago manual -->
    <div v-if="actionTab === 'payment'" class="action-panel">
      <p class="action-hint">Pago recibido por fuera de Wompi (efectivo, transferencia). El período nuevo arranca el <strong>{{ referenceStartLabel }}</strong>, donde termina el vigente.</p>
      <div class="action-fields">
        <UiInput v-model="amountCOP" type="number" inputmode="numeric" placeholder="Monto en COP..." aria-label="Monto en pesos COP" class="field-amount" />
        <label class="field-date-wrap">
          <span>Cubierto hasta</span>
          <UiInput v-model="paidUntilDate" type="date" aria-label="Pagado hasta" class="field-date" />
        </label>
        <UiInput v-model="paymentNotes" placeholder="Nota del pago (opcional)..." aria-label="Nota del pago" class="field-notes" />
        <UiButton :disabled="busy || !isValidAmount || !isValidPaidUntilDate" class="field-btn" @click="handleMarkPaid">
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
        <UiButton variant="secondary" :disabled="busy || !isValidTrialDate" class="field-btn" @click="handleExtendTrial">
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
        <UiInput v-model="adjustNotes" placeholder="Motivo de la corrección (obligatorio)..." aria-label="Motivo de la corrección" class="field-notes" />
        <UiButton variant="danger" :disabled="busy || !isValidAdjust" class="field-btn" @click="handleAdjustExpiry">
          {{ busy ? 'Guardando...' : 'Corregir vencimiento' }}
        </UiButton>
      </div>
      <p v-if="adjustDeltaLabel" class="adjust-delta">{{ adjustDeltaLabel }}</p>
    </div>

    <span v-if="saveMsg" class="save-msg">{{ saveMsg }}</span>
    <FormError :message="errorMsg" />
  </div>
</template>

<style scoped>
/* =========================================
   CSS GENERAL
   ========================================= */
.billing-actions { display: flex; flex-direction: column; }
.action-tabs { display: flex; gap: 4px; margin-bottom: 12px; background: var(--bg-elevated); border-radius: var(--radius-sm, 8px); padding: 3px; }
.action-tabs button { flex: 1; padding: 7px 10px; border: 0; border-radius: 6px; background: transparent; color: var(--text-muted); font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; }
.action-tabs button.selected { background: var(--bg-card); color: var(--text); }
.action-panel { display: flex; flex-direction: column; gap: 10px; }
.action-hint { margin: 0; font-size: 12px; color: var(--text-muted); line-height: 1.5; }
.action-hint strong { color: var(--text); }
.action-hint-danger { color: var(--warning); }
.action-hint-danger strong { color: var(--warning); }
.action-fields { display: flex; flex-direction: column; gap: 8px; }
.field-amount, .field-notes, .field-date, .field-btn { width: 100%; }
.field-date-wrap { display: flex; flex-direction: column; gap: 4px; font-size: 11px; color: var(--text-muted); font-weight: 600; }
.adjust-delta { margin: 0; font-size: 12px; font-weight: 700; color: var(--warning); }
.save-msg { display: block; margin-top: 8px; color: var(--success); font-size: 13px; font-weight: 600; }

/* =========================================
   BREAKPOINT 850px
   ========================================= */
@media (min-width: 850px) {
  .action-fields { flex-direction: row; align-items: flex-end; }
  .field-amount { flex: 0 0 140px; }
  .field-date-wrap { flex: 0 0 160px; }
  .field-notes { flex: 1; }
  .field-btn { width: auto; white-space: nowrap; }
}
</style>
