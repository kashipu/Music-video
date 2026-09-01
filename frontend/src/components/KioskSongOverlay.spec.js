import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import KioskSongOverlay from './KioskSongOverlay.vue'

describe('KioskSongOverlay', () => {
  it('prefers the queued song as next', () => {
    const wrapper = mount(KioskSongOverlay, { props: { song: { title: 'Actual' }, queue: [{ title: 'Cola' }], pendingUserSong: { title: 'Pendiente' } } })
    expect(wrapper.text()).toContain('Actual')
    expect(wrapper.text()).toContain('Siguiente: Cola')
  })

  it('hides next song when no queue is pending', () => {
    expect(mount(KioskSongOverlay, { props: { song: { title: 'Actual' }, queue: [] } }).find('.overlay-meta').exists()).toBe(false)
  })
})
