import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PasswordInput from './PasswordInput.vue'

describe('PasswordInput', () => {
  it('masks the value as type=password by default', () => {
    const wrapper = mount(PasswordInput, { props: { modelValue: 'secreto' } })
    expect(wrapper.find('input').attributes('type')).toBe('password')
  })

  it('reveals the value as type=text after clicking the eye button', async () => {
    const wrapper = mount(PasswordInput, { props: { modelValue: 'secreto' } })
    await wrapper.find('.eye-btn').trigger('click')
    expect(wrapper.find('input').attributes('type')).toBe('text')
  })

  it('emits update:modelValue when typing', async () => {
    const wrapper = mount(PasswordInput, { props: { modelValue: '' } })
    await wrapper.find('input').setValue('nuevo')
    expect(wrapper.emitted('update:modelValue')).toEqual([['nuevo']])
  })
})
