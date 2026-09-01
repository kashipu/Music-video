import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FormField from './FormField.vue'

describe('FormField', () => {
  it('links the label to the slot id via the id prop', () => {
    const wrapper = mount(FormField, {
      props: { id: 'venue-name', label: 'Nombre del bar' },
      slots: { default: `<template #default="{ id }"><input :id="id" /></template>` },
    })
    expect(wrapper.find('label').attributes('for')).toBe('venue-name')
    expect(wrapper.find('input').attributes('id')).toBe('venue-name')
  })

  it('generates an id when none is passed', () => {
    const wrapper = mount(FormField, {
      props: { label: 'Correo' },
      slots: { default: `<template #default="{ id }"><input :id="id" /></template>` },
    })
    const generated = wrapper.find('input').attributes('id')
    expect(generated).toBeTruthy()
    expect(wrapper.find('label').attributes('for')).toBe(generated)
  })

  it('shows the required marker only when required', () => {
    const wrapper = mount(FormField, { props: { label: 'Correo', required: true } })
    expect(wrapper.find('label').text()).toContain('*')
  })

  it('forwards the error prop to FormError', () => {
    const wrapper = mount(FormField, { props: { label: 'Correo', error: 'Campo obligatorio' } })
    expect(wrapper.find('.error-msg').text()).toBe('Campo obligatorio')
  })
})
