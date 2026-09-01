import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Badge from './Badge.vue'

describe('Badge', () => {
  it('renders slot content', () => {
    const wrapper = mount(Badge, { slots: { default: 'Activo' } })
    expect(wrapper.text()).toBe('Activo')
  })

  it('defaults to the neutral variant', () => {
    const wrapper = mount(Badge)
    expect(wrapper.classes()).toContain('badge-neutral')
  })

  it('applies the variant prop as a class', () => {
    const wrapper = mount(Badge, { props: { variant: 'danger' } })
    expect(wrapper.classes()).toContain('badge-danger')
  })
})
