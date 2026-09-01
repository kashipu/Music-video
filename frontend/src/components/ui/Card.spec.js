import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Card from './Card.vue'

describe('Card', () => {
  it('renders default slot content', () => {
    const wrapper = mount(Card, {
      slots: { default: '<p class="test-content">Hola</p>' },
    })
    expect(wrapper.classes()).toContain('card')
    expect(wrapper.find('.test-content').exists()).toBe(true)
    expect(wrapper.find('.section-title').exists()).toBe(false)
  })

  it('renders title when title prop is provided', () => {
    const wrapper = mount(Card, {
      props: { title: 'Mi Título' },
      slots: { default: '<span>Contenido</span>' },
    })
    expect(wrapper.find('.section-title').text()).toBe('Mi Título')
    expect(wrapper.text()).toContain('Contenido')
  })
})
