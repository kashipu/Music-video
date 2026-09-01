import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import VenuePlaylistCard from './VenuePlaylistCard.vue'

describe('VenuePlaylistCard', () => {
  it('renders an empty playlist after loading', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ songs: [] }) }))
    const wrapper = mount(VenuePlaylistCard, { props: { venueId: 'v1' } })
    await flushPromises()
    expect(wrapper.text()).toContain('Sin canciones.')
    vi.unstubAllGlobals()
  })

  it('shows imported playlist songs', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ songs: [{ id: 1, title: 'Tema', position: 1, duration_sec: 120, active: true, thumbnail_url: 'x' }] }) }))
    const wrapper = mount(VenuePlaylistCard, { props: { venueId: 'v1' } })
    await flushPromises()
    expect(wrapper.text()).toContain('Tema')
    expect(wrapper.text()).toContain('Desactivar')
    vi.unstubAllGlobals()
  })
})
