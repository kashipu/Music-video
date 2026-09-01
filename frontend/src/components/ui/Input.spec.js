import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Input from './Input.vue'

describe('Input', () => {
  it('renders the modelValue prop', () => {
    const wrapper = mount(Input, { props: { modelValue: 'Bar La Esquina' } })
    expect(wrapper.find('input').element.value).toBe('Bar La Esquina')
  })

  it('emits update:modelValue on input', async () => {
    const wrapper = mount(Input, { props: { modelValue: '' } })
    await wrapper.find('input').setValue('nuevo valor')
    expect(wrapper.emitted('update:modelValue')).toEqual([['nuevo valor']])
  })
})
