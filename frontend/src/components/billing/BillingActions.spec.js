import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BillingActions from './BillingActions.vue'

const props = { referenceStartLabel: '1 ago 2026', referenceStart: new Date('2026-08-01T00:00:00'), periodEnd: '2026-08-10' }

describe('BillingActions', () => {
  it('emits a manual payment with the entered values', async () => {
    const wrapper = mount(BillingActions, { props })
    await wrapper.get('[aria-label="Monto en pesos COP"]').setValue('49000')
    await wrapper.get('[aria-label="Pagado hasta"]').setValue('2026-08-31')
    await wrapper.get('.field-btn').trigger('click')

    expect(wrapper.emitted('mark-paid')[0][0]).toMatchObject({ amountCOP: '49000', paidUntilDate: '2026-08-31', paymentNotes: '' })
  })

  it('emits a trial extension from the trial tab', async () => {
    const wrapper = mount(BillingActions, { props })
    await wrapper.get('[role="tab"]:nth-child(2)').trigger('click')
    await wrapper.get('[aria-label="Prueba hasta"]').setValue('2026-08-16')
    await wrapper.get('.field-btn').trigger('click')

    expect(wrapper.emitted('extend-trial')[0][0]).toMatchObject({ trialUntilDate: '2026-08-16' })
  })

  it('emits an expiry adjustment with its calculated delta', async () => {
    const wrapper = mount(BillingActions, { props })
    await wrapper.get('[role="tab"]:nth-child(3)').trigger('click')
    await wrapper.get('[aria-label="Nuevo vencimiento"]').setValue('2026-08-12')
    await wrapper.get('[aria-label="Motivo de la corrección"]').setValue('Error')
    await wrapper.get('.field-btn').trigger('click')

    expect(wrapper.emitted('adjust-expiry')[0][0]).toMatchObject({ adjustDate: '2026-08-12', adjustNotes: 'Error', adjustDeltaLabel: 'Esto agrega 2 días.' })
  })
})
