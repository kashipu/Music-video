import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useQueueStore } from '../stores/queue.js'
import SongSubmit from './SongSubmit.vue'

function mountSubmit(props) {
  setActivePinia(createPinia())
  return mount(SongSubmit, { props })
}

describe('SongSubmit', () => {
  it('renders the rate-limit gate', () => {
    const wrapper = mountSubmit({ rateLimit: { songs_remaining: 0, max_songs: 3 } })
    expect(wrapper.text()).toContain('Limite alcanzado')
    expect(wrapper.find('.search-input').exists()).toBe(false)
  })

  it('shows no-results after a search without matches', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [] }) }))
    const wrapper = mountSubmit()
    await wrapper.get('.search-input').setValue('zz')
    await wrapper.get('.search-input').trigger('keydown.enter')
    await flushPromises()
    expect(wrapper.text()).toContain('Sin resultados para "zz"')
    vi.unstubAllGlobals()
  })

  it('emits preview after selecting a successful result', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [{ youtube_id: 'abc', title: 'Tema', url: 'https://youtu.be/abc' }] }) }))
    const wrapper = mountSubmit()
    vi.spyOn(useQueueStore(), 'submitSong').mockResolvedValue({ youtube_id: 'abc', title: 'Tema' })
    await wrapper.get('.search-input').setValue('tema')
    await wrapper.get('.search-input').trigger('keydown.enter')
    await flushPromises()
    await wrapper.get('.result-item').trigger('click')
    await flushPromises()
    expect(wrapper.emitted('preview')[0]).toEqual([{ youtube_id: 'abc', title: 'Tema' }])
    vi.unstubAllGlobals()
  })
})
