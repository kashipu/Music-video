import BillingSummary from './BillingSummary.vue'

export default { title: 'Components/Billing/Summary', component: BillingSummary }

const render = billing => ({ components: { BillingSummary }, setup: () => ({ billing, statusBadgeInfo: billing.status === 'active' ? { variant: 'success', label: 'Al día' } : billing.status === 'overdue' ? { variant: 'warning', label: 'Vencido (período de gracia)' } : { variant: 'danger', label: 'Suspendido (período vencido)' }, periodSubtitle: billing.days_remaining > 1 ? 'días restantes' : billing.days_remaining === 0 ? 'Vence hoy' : 'día vencido', paymentTotals: { wompi: null, manual: null } }), template: '<div class="card"><BillingSummary :billing="billing" :status-badge-info="statusBadgeInfo" :period-subtitle="periodSubtitle" :payment-totals="paymentTotals" /></div>' })

export const Activa = { render: () => render({ status: 'active', days_remaining: 18, period_start: '2026-08-09', period_end: '2026-09-13' }) }
export const EnPrueba = { render: () => render({ status: 'active', days_remaining: 7, period_start: '2026-08-20', period_end: '2026-09-03' }) }
export const Vencida = { render: () => render({ status: 'overdue', days_remaining: -2, period_end: '2026-08-25' }) }
