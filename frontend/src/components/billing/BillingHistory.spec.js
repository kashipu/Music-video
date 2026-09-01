import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BillingHistory from './BillingHistory.vue'

const history = [
  { id: 1, kind: 'payment', source: 'manual', amount_cents: 4900000, days: 30, status: 'confirmed', created_at: '2026-08-01', period_start: '2026-08-01', period_end: '2026-08-31', notes: 'Transferencia' },
  { id: 2, kind: 'trial', source: 'manual', days: 15, status: 'confirmed', created_at: '2026-08-02' },
  { id: 3, kind: 'adjustment', source: 'manual', days: -2, status: 'voided', created_at: '2026-08-03' },
  { id: 4, kind: 'legacy', source: 'legacy', status: 'confirmed', created_at: '2026-08-04' },
  { id: 5, kind: 'payment', source: 'wompi', amount_cents: 4900000, status: 'confirmed', created_at: '2026-08-05' },
]

describe('BillingHistory', () => {
  it('formats payments and dates and limits the initial history', () => {
    const wrapper = mount(BillingHistory, { props: { billing: { history } } })

    expect(wrapper.findAll('.history-card')).toHaveLength(4)
    expect(wrapper.text()).toMatch(/49.000/)
    expect(wrapper.text()).toMatch(/1 .*ago.*2026/)
    expect(wrapper.text()).toContain('Ver todos (5)')
  })

  it('shows the full history when requested', async () => {
    const wrapper = mount(BillingHistory, { props: { billing: { history } } })

    await wrapper.get('.toggle-history-btn').trigger('click')
    expect(wrapper.findAll('.history-card')).toHaveLength(5)
    expect(wrapper.text()).toContain('Ver menos')
  })

  it('emits the selected event when voiding a manual movement', async () => {
    const wrapper = mount(BillingHistory, { props: { billing: { history } } })

    await wrapper.get('[aria-label="Anular movimiento"]').trigger('click')
    expect(wrapper.emitted('void')[0]).toEqual([history[0]])
  })
})
