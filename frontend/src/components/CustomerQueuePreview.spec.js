import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import CustomerQueuePreview from './CustomerQueuePreview.vue'

describe('CustomerQueuePreview', () => {
  it('hides an empty queue and renders remaining count', () => {
    expect(mount(CustomerQueuePreview, { props: { queue: [] } }).find('.section').exists()).toBe(false)
    const wrapper = mount(CustomerQueuePreview, { props: { totalInQueue: 3, queue: [{ id: 1, youtube_id: 'abc', title: 'Tema', added_by: 'Ana' }] } })
    expect(wrapper.text()).toContain('Siguiente · 3 en cola')
    expect(wrapper.text()).toContain('+ 2 mas en la cola')
  })
})
