import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BillingSummary from './BillingSummary.vue'

const props = {
  billing: { status: 'active', days_remaining: 12, period_start: '2026-08-01', period_end: '2026-08-13' },
  statusBadgeInfo: { variant: 'success', label: 'Al día' },
  periodSubtitle: 'días restantes',
  paymentTotals: { wompi: { amount_cents: 4900000, count: 1 }, manual: { amount_cents: 9800000, count: 2 } },
  hasTotals: true,
}

describe('BillingSummary', () => {
  it('renders subscription status, period and formatted COP totals', () => {
    const wrapper = mount(BillingSummary, { props })

    expect(wrapper.text()).toContain('Al día')
    expect(wrapper.get('.days-number').text()).toBe('12')
    expect(wrapper.get('.days-label').text()).toBe('días restantes')
    expect(wrapper.get('.period-range').text()).toMatch(/1 .*ago.*2026 → 13 .*ago.*2026/)
    expect(wrapper.text()).toMatch(/49.000/)
    expect(wrapper.text()).toContain('2 pagos')
  })

  it('renders a dash and hides totals when the values are absent', () => {
    const wrapper = mount(BillingSummary, { props: { ...props, billing: { status: 'suspended', days_remaining: null }, hasTotals: false } })

    expect(wrapper.find('.days-number').text()).toBe('—')
    expect(wrapper.find('.totals-row').exists()).toBe(false)
  })
})
