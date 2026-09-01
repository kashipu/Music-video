import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Select from './Select.vue'

describe('Select', () => {
  const slots = {
    default: '<option value="a">A</option><option value="b">B</option>',
  }

  it('renders the modelValue as the selected option', () => {
    const wrapper = mount(Select, { props: { modelValue: 'b' }, slots })
    expect(wrapper.find('select').element.value).toBe('b')
  })

  it('emits update:modelValue when the selection changes', async () => {
    const wrapper = mount(Select, { props: { modelValue: 'a' }, slots })
    await wrapper.find('select').setValue('b')
    expect(wrapper.emitted('update:modelValue')).toEqual([['b']])
  })
})
