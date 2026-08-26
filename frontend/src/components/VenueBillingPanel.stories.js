import { provide, ref } from 'vue'
import VenueBillingPanel from './VenueBillingPanel.vue'

const detail = ref({
  billing: {
    status: 'active',
    days_remaining: 18,
    period_start: '2026-08-09',
    period_end: '2026-09-13',
    totals: [{ source: 'wompi', amount_cents: 4900000, count: 1 }, { source: 'manual', amount_cents: 9800000, count: 2 }],
    history: [
      { id: 1, kind: 'payment', source: 'manual', amount_cents: 4900000, days: 30, status: 'confirmed', created_at: '2026-08-09', period_start: '2026-08-09', period_end: '2026-09-08', created_by_username: 'William', notes: 'Transferencia confirmada' },
      { id: 2, kind: 'adjustment', source: 'manual', days: 5, status: 'confirmed', created_at: '2026-08-10', created_by_username: 'William', notes: 'Cortesía por mantenimiento' },
    ],
  },
})

export default { title: 'Components/VenueBillingPanel', component: VenueBillingPanel }
export const ActiveSubscription = {
  render: () => ({
    components: { VenueBillingPanel },
    setup() {
      provide('venueDetail', { detail, refresh: async () => {} })
    },
    template: '<VenueBillingPanel />',
  }),
}
