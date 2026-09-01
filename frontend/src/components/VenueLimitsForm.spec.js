import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import VenueLimitsForm from './VenueLimitsForm.vue'

describe('VenueLimitsForm', () => {
  it('converts minutes and emits each limit update', async () => {
    const wrapper = mount(VenueLimitsForm, { props: { maxDurationSec: 600, maxSongs: 3, windowMinutes: 20 } })
    const inputs = wrapper.findAll('input')
    expect(inputs[0].element.value).toBe('10')
    await inputs[0].setValue(12)
    await inputs[1].setValue(4)
    await inputs[2].setValue(30)
    expect(wrapper.emitted('update:maxDurationSec')[0]).toEqual([720])
    expect(wrapper.emitted('update:maxSongs')[0]).toEqual([4])
    expect(wrapper.emitted('update:windowMinutes')[0]).toEqual([30])
  })
})
