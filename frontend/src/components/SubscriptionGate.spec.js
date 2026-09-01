import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import SubscriptionGate from './SubscriptionGate.vue'

const router = createRouter({ history: createMemoryHistory(), routes: [
  { path: '/:venueSlug/admin', name: 'admin-dashboard', component: { template: '<div />' } },
  { path: '/:venueSlug/subscription', name: 'admin-subscription', component: { template: '<div />' } },
  { path: '/:venueSlug/login', name: 'admin-login', component: { template: '<div />' } },
] })

async function mountGate(response) {
  setActivePinia(createPinia())
  await router.push('/bar/admin')
  await router.isReady()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => response }))
  const wrapper = mount(SubscriptionGate, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

afterEach(() => vi.unstubAllGlobals())

describe('SubscriptionGate', () => {
  it('does not gate an active subscription', async () => {
    const wrapper = await mountGate({ payment_status: 'active', days_remaining: 10, monthly_price_cents: 4900000 })

    expect(wrapper.text()).toBe('')
  })

  it('shows the upcoming-expiry banner within 3 days of paid_until', async () => {
    const wrapper = await mountGate({ payment_status: 'active', days_remaining: 2, monthly_price_cents: 4900000 })

    expect(wrapper.text()).toContain('Tu suscripción vence en 2 días')
    expect(wrapper.text()).toContain('Renovar')
  })

  it('does not show the upcoming-expiry banner beyond 3 days', async () => {
    const wrapper = await mountGate({ payment_status: 'active', days_remaining: 4, monthly_price_cents: 4900000 })

    expect(wrapper.text()).toBe('')
  })

  it('shows the grace banner with grace_days_remaining for an overdue subscription', async () => {
    const wrapper = await mountGate({
      payment_status: 'overdue',
      days_remaining: -1,
      grace_days_remaining: 4,
      grace_period_days: 5,
      monthly_price_cents: 4900000,
    })

    expect(wrapper.text()).toContain('Te quedan 4 días')
    expect(wrapper.text()).toContain('Pagar ahora')
  })

  it('shows the paywall and formatted price for a suspended subscription with focus trap', async () => {
    const wrapper = await mountGate({ payment_status: 'suspended', days_remaining: -3, monthly_price_cents: 4900000 }, { attachTo: document.body })

    expect(wrapper.text()).toContain('Suscripción suspendida')
    expect(wrapper.text()).toMatch(/49.000/)
    expect(wrapper.text()).toContain('Reactivar suscripción')
    expect(wrapper.find('.paywall-overlay').attributes('role')).toBe('dialog')
    expect(wrapper.find('.paywall-overlay').attributes('aria-modal')).toBe('true')
  })
})
