import BillingHistory from './BillingHistory.vue'

export default { title: 'Components/Billing/History', component: BillingHistory }
const history = [{ id: 1, kind: 'payment', source: 'manual', amount_cents: 4900000, days: 30, status: 'confirmed', created_at: '2026-08-09', period_end: '2026-09-08', notes: 'Transferencia confirmada' }]
export const PagoManual = { args: { billing: { history }, visibleHistory: history } }
export const PagoRechazado = { args: { billing: { history: [{ ...history[0], source: 'wompi', status: 'declined' }] }, visibleHistory: [{ ...history[0], source: 'wompi', status: 'declined' }] } }
