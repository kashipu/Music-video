import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FormError from './FormError.vue'

describe('FormError', () => {
  it('renders nothing when there is no message', () => {
    const wrapper = mount(FormError, { props: { message: '' } })
    expect(wrapper.find('.error-msg').exists()).toBe(false)
  })

  it('renders the message with role=alert when present', () => {
    const wrapper = mount(FormError, { props: { message: 'Usuario ya existe' } })
    const error = wrapper.find('.error-msg')
    expect(error.exists()).toBe(true)
    expect(error.attributes('role')).toBe('alert')
    expect(error.text()).toBe('Usuario ya existe')
  })
})
