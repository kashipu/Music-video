import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import AdminSongSearch from './AdminSongSearch.vue'

const { searchSongs } = vi.hoisted(() => ({ searchSongs: vi.fn() }))
vi.mock('../services/admin.js', () => ({ searchSongs }))

describe('AdminSongSearch', () => {
  it('loads YouTube results on enter and emits add-song', async () => {
    searchSongs.mockResolvedValue({ results: [{ youtube_id: 'abc', title: 'Tema', duration: '3:00' }] })
    const wrapper = mount(AdminSongSearch)
    await wrapper.get('input[placeholder="Buscar en YouTube..."]').setValue('tema')
    await wrapper.get('input[placeholder="Buscar en YouTube..."]').trigger('keydown.enter')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Tema'))
    await wrapper.get('.ctrl-add-sm').trigger('click')
    expect(wrapper.emitted('add-song')[0]).toEqual(['abc'])
  })

  it('requests an empty library and renders an error prop', async () => {
    const wrapper = mount(AdminSongSearch, { props: { addError: 'No se pudo agregar' } })
    await wrapper.get('.add-tab:nth-child(2)').trigger('click')
    expect(wrapper.text()).toContain('Sin canciones guardadas')
    expect(wrapper.text()).toContain('No se pudo agregar')
    expect(wrapper.emitted('fetch-library')[0]).toEqual([''])
  })
})
