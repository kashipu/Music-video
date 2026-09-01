import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import NowPlaying from './NowPlaying.vue'

describe('NowPlaying', () => {
  it('renders the empty state without a song', () => {
    expect(mount(NowPlaying).text()).toContain('No hay nada sonando')
  })

  it('renders a user song with metadata and controls slot', () => {
    const wrapper = mount(NowPlaying, { props: { song: { title: 'Tema', user_name: 'Ana', table_number: 4 }, mine: true }, slots: { controls: 'Control' } })
    expect(wrapper.classes()).toContain('np-mine')
    expect(wrapper.text()).toContain('TU CANCIÓN SUENA')
    expect(wrapper.text()).toContain('Ana · #4')
    expect(wrapper.text()).toContain('Control')
  })

  it('renders paused fallback and queue length', () => {
    const wrapper = mount(NowPlaying, { props: { fallback: true, playbackStatus: 'paused', queueLength: 2 } })
    expect(wrapper.classes()).toContain('np-fallback-paused')
    expect(wrapper.text()).toContain('PAUSADO')
    expect(wrapper.text()).toContain('2 canciones en cola')
  })
})
