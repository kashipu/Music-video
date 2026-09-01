import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Button from './Button.vue'

describe('Button', () => {
  it('renders slot content', () => {
    const wrapper = mount(Button, { slots: { default: 'Guardar' } })
    expect(wrapper.text()).toBe('Guardar')
  })

  it('defaults to the primary variant', () => {
    const wrapper = mount(Button)
    expect(wrapper.classes()).toContain('btn-primary')
  })

  it('applies the variant prop as a class', () => {
    const wrapper = mount(Button, { props: { variant: 'danger' } })
    expect(wrapper.classes()).toContain('btn-danger')
    expect(wrapper.classes()).not.toContain('btn-primary')
  })
})
