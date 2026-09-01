import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import SongCard from './SongCard.vue'

describe('SongCard', () => {
  it('renders song props and formatted metadata', () => {
    const wrapper = mount(SongCard, { props: { song: { position: 3, title: 'Tema', added_by: 'Ana', table_number: 4, duration_sec: 125, thumbnail_url: 'thumb.png' } } })
    expect(wrapper.text()).toContain('3.')
    expect(wrapper.text()).toContain('Ana · #4 · 2:05')
    expect(wrapper.get('img').attributes('src')).toBe('thumb.png')
  })

  it('hides the image and optional metadata when missing', () => {
    const wrapper = mount(SongCard, { props: { song: { position: 1, title: 'Tema' } } })
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.get('.meta').text()).toBe('')
  })
})
