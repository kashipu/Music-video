import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AdminQueueCard from './AdminQueueCard.vue'

const queue = [{ id: 1, youtube_id: 'abc', title: 'Tema', user_name: 'Ana', table_number: 4, duration_sec: 125 }]

describe('AdminQueueCard', () => {
  it('renders an empty queue', () => {
    expect(mount(AdminQueueCard).text()).toContain('Cola vacía')
  })

  it('renders songs and emits queue actions', async () => {
    const wrapper = mount(AdminQueueCard, { props: { queue } })
    expect(wrapper.text()).toContain('Tema')
    expect(wrapper.text()).toContain('2:05')
    await wrapper.get('.q-btn-play').trigger('click')
    await wrapper.findAll('.q-btn-remove')[1].trigger('click')
    await wrapper.get('.clear-btn').trigger('click')
    expect(wrapper.emitted('play-now')[0]).toEqual([1])
    expect(wrapper.emitted('remove-song')[0]).toEqual([1])
    expect(wrapper.emitted('clear-queue')).toHaveLength(1)
  })
})
