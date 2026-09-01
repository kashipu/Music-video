import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import VenueGeneralConfig from './VenueGeneralConfig.vue'

describe('VenueGeneralConfig', () => {
  it('renders venue props and changes selected preset', async () => {
    const wrapper = mount(VenueGeneralConfig, { props: { venueId: 'v1', venue: { name: 'Bar Uno', slug: 'bar-uno', logo_url_light: '/light.png', config: { theme: { preset: 'red-fire' } } } } })
    expect(wrapper.get('input').element.value).toBe('Bar Uno')
    expect(wrapper.get('img').attributes('src')).toBe('/light.png')
    const presets = wrapper.findAll('.preset-card')
    expect(presets.find(card => card.text().includes('Fuego Rojo')).classes()).toContain('selected')
    await presets[0].trigger('click')
    expect(presets[0].classes()).toContain('selected')
  })
})
