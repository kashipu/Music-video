import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import QueueList from './QueueList.vue'

describe('QueueList', () => {
  it('renders empty queue state', () => {
    expect(mount(QueueList).text()).toContain('No hay canciones en la cola')
  })

  it('renders each song through SongCard', () => {
    const wrapper = mount(QueueList, { props: { total: 2, songs: [{ id: 1, position: 1, title: 'Uno' }, { id: 2, position: 2, title: 'Dos' }] } })
    expect(wrapper.text()).toContain('Siguiente en la Cola (2)')
    expect(wrapper.findAll('.song-card')).toHaveLength(2)
  })
})
