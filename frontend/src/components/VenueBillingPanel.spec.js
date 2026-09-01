import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import VenueBillingPanel from './VenueBillingPanel.vue'

vi.mock('vue-router', () => ({ useRoute: () => ({ params: { venueId: 'venue-1' } }) }))
vi.mock('../composables/useConfirmModal.js', () => ({ useConfirmModal: () => ({ confirm: vi.fn() }) }))

const billing = { status: 'overdue', days_remaining: -2, period_end: '2026-08-10', totals: [], history: [] }

describe('VenueBillingPanel', () => {
  it('renders the injected billing state and passes it to its sections', () => {
    const wrapper = mount(VenueBillingPanel, { global: { provide: { venueDetail: { detail: ref({ billing }), refresh: vi.fn() } } } })

    expect(wrapper.classes()).toContain('billing-overdue')
    expect(wrapper.text()).toContain('Vencido (período de gracia)')
    expect(wrapper.getComponent({ name: 'BillingActions' }).props('periodEnd')).toBe('2026-08-10')
  })

  it('renders nothing until venue detail is available', () => {
    const wrapper = mount(VenueBillingPanel, { global: { provide: { venueDetail: { detail: ref(null), refresh: vi.fn() } } } })

    expect(wrapper.find('.billing-card').exists()).toBe(false)
  })
})
