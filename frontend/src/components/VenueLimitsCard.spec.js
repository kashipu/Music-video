import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import VenueLimitsCard from './VenueLimitsCard.vue'

describe('VenueLimitsCard', () => {
  it('loads config props into inputs', () => {
    const wrapper = mount(VenueLimitsCard, { props: { venueId: 'v1', config: '{"max_duration_sec":900,"max_songs_per_window":4,"window_minutes":30}' } })
    expect(wrapper.findAll('input').map(input => input.element.value)).toEqual(['15', '4', '30'])
  })

  it('shows validation errors without making a request', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const wrapper = mount(VenueLimitsCard, { props: { venueId: 'v1' } })
    await wrapper.findAll('input')[1].setValue(0)
    await wrapper.get('button').trigger('click')
    expect(wrapper.text()).toContain('deben ser un número entero entre 1 y 50')
    expect(fetch).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
