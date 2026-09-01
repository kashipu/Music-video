import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import CustomerMySongs from './CustomerMySongs.vue'

describe('CustomerMySongs', () => {
  it('hides empty songs and renders playing and pending states', async () => {
    expect(mount(CustomerMySongs, { props: { songs: [] } }).find('.section').exists()).toBe(false)
    const wrapper = mount(CustomerMySongs, { props: { songs: [{ id: 1, youtube_id: 'a', title: 'Actual', status: 'playing' }, { id: 2, youtube_id: 'b', title: 'Cola', status: 'pending', position: 3 }] } })
    expect(wrapper.text()).toContain('Sonando')
    expect(wrapper.text()).toContain('#3 en cola')
    await wrapper.get('.cancel-btn').trigger('click')
    expect(wrapper.emitted('cancel-song')[0]).toEqual([2])
  })
})
