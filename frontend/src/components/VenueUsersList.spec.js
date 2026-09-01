import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import VenueUsersList from './VenueUsersList.vue'

describe('VenueUsersList', () => {
  it('renders user fallbacks, consent and relative dates', () => {
    const today = new Date().toISOString()
    const wrapper = mount(VenueUsersList, { props: { users: [{ id: 1, phone: '300', last_connection: today, first_seen_at_venue: 'bad', songs_count: 2, is_recurring: true, data_consent: true }] } })
    expect(wrapper.text()).toContain('Sin nombre')
    expect(wrapper.text()).toContain('Hoy')
    expect(wrapper.text()).toContain('—')
    expect(wrapper.text()).toContain('Autorizado (Registro)')
  })
})
