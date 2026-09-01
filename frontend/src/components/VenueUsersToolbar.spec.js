import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import VenueUsersToolbar from './VenueUsersToolbar.vue'

describe('VenueUsersToolbar', () => {
  it('renders counts and emits filter and search updates', async () => {
    const wrapper = mount(VenueUsersToolbar, { props: { totalCount: 9, recurringCount: 4, firstTimeCount: 5, recurringFilter: 'recurring' } })
    expect(wrapper.text()).toContain('9')
    expect(wrapper.findAll('.stat-pill')[1].classes()).toContain('active')
    await wrapper.findAll('.stat-pill')[2].trigger('click')
    await wrapper.get('[aria-label="Buscar usuarios"]').setValue('Ana')
    expect(wrapper.emitted('update:recurringFilter')[0]).toEqual(['first_time'])
    expect(wrapper.emitted('update:search')[0]).toEqual(['Ana'])
  })
})
