import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BackButton from './BackButton.vue'

describe('BackButton', () => {
  it('renders slot content and defaults to type=button', () => {
    const wrapper = mount(BackButton, { slots: { default: 'Volver' } })
    expect(wrapper.text()).toBe('Volver')
    expect(wrapper.attributes('type')).toBe('button')
  })

  it('emits a native click event', async () => {
    const wrapper = mount(BackButton)
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(1)
  })
})
