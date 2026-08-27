import BillingHistory from './BillingHistory.vue'

export default {
  title: 'Components/Billing/History',
  component: BillingHistory,
}

const baseHistory = [
  {
    id: 1,
    kind: 'payment',
    source: 'manual',
    amount_cents: 4900000,
    days: 30,
    status: 'confirmed',
    created_at: '2026-08-09',
    period_start: '2026-08-09',
    period_end: '2026-09-08',
    created_by_username: 'William',
    notes: 'Transferencia confirmada',
  },
  {
    id: 2,
    kind: 'adjustment',
    source: 'manual',
    days: 5,
    status: 'confirmed',
    created_at: '2026-08-10',
    created_by_username: 'William',
    notes: 'Cortesía por mantenimiento',
  },
  {
    id: 3,
    kind: 'payment',
    source: 'wompi',
    amount_cents: 4900000,
    days: 30,
    status: 'confirmed',
    created_at: '2026-07-09',
    period_start: '2026-07-09',
    period_end: '2026-08-08',
    provider_ref: 'WMP-987654321',
  },
]

export const PagoManual = {
  args: {
    billing: { history: baseHistory },
    visibleHistory: baseHistory,
    showAllHistory: false,
  },
}

export const PagoRechazado = {
  args: {
    billing: {
      history: [
        {
          id: 4,
          kind: 'payment',
          source: 'wompi',
          amount_cents: 4900000,
          status: 'declined',
          created_at: '2026-08-26',
        },
      ],
    },
    visibleHistory: [
      {
        id: 4,
        kind: 'payment',
        source: 'wompi',
        amount_cents: 4900000,
        status: 'declined',
        created_at: '2026-08-26',
      },
    ],
  },
}

export const EdicionActiva = {
  args: {
    billing: { history: baseHistory },
    visibleHistory: baseHistory,
    editingEventId: 1,
    editingAmountCOP: '49000',
    editingDate: '2026-09-08',
    editingNoteText: 'Transferencia Bancolombia verificada',
  },
}

export const SinMovimientos = {
  args: {
    billing: { history: [] },
    visibleHistory: [],
  },
}
