import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ThemeToggle from './ThemeToggle.vue'

describe('ThemeToggle', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme')
    localStorage.clear()
  })

  it('toggles data-theme on click', async () => {
    document.documentElement.setAttribute('data-theme', 'dark')
    const wrapper = mount(ThemeToggle)

    await wrapper.trigger('click')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')

    await wrapper.trigger('click')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })
})
