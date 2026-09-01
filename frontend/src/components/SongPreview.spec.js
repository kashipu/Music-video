import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import SongPreview from './SongPreview.vue'

describe('SongPreview', () => {
  it('renders preview props, warning and emits actions', async () => {
    const preview = { youtube_id: 'abc', title: 'Tema', thumbnail_url: 'x', duration_sec: 125, recently_played_by_user: true, recently_played_minutes_ago: 4 }
    const wrapper = mount(SongPreview, { props: { preview } })
    expect(wrapper.text()).toContain('Duracion: 2:05')
    expect(wrapper.text()).toContain('hace 4 minutos')
    await wrapper.get('.btn-confirm').trigger('click')
    await wrapper.get('.btn-secondary').trigger('click')
    expect(wrapper.emitted('confirm')[0]).toEqual(['abc'])
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })
})
