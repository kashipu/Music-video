import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import VenueActivityPanel from './VenueActivityPanel.vue'

describe('VenueActivityPanel', () => {
  it('hides without analytics and renders best day with bars', () => {
    expect(mount(VenueActivityPanel).html()).toContain('v-if')
    const wrapper = mount(VenueActivityPanel, { props: { dailyAnalytics: { days: [{ date: '2026-08-10', people: 3 }] }, bestDay: { date: '2026-08-10', people: 3 } } })
    expect(wrapper.text()).toContain('10/08')
    expect(wrapper.get('.activity-bar i').attributes('style')).toContain('width: 100%')
  })
})
