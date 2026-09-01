import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import KioskBottomBar from './KioskBottomBar.vue'

describe('KioskBottomBar', () => {
  it('renders the next queued song', () => {
    const wrapper = mount(KioskBottomBar, { props: { song: { title: 'Actual' }, queue: [{ title: 'Cola' }], fallbackPlayed: new Set(), fallbackSongs: [] } })
    expect(wrapper.text()).toContain('Siguiente: Cola')
  })

  it('renders fallback progress when there is no pending song', () => {
    const wrapper = mount(KioskBottomBar, { props: { song: { title: 'Actual' }, playingFallback: true, queue: [], fallbackPlayed: new Set(['a']), fallbackSongs: ['a', 'b'] } })
    expect(wrapper.classes()).toContain('bottom-fallback')
    expect(wrapper.text()).toContain('1/2 reproducidas')
  })
})
