import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AdminFallbackCard from './AdminFallbackCard.vue'
describe('AdminFallbackCard', () => { it('shows empty state', () => expect(mount(AdminFallbackCard).text()).toContain('Sin playlist')); it('renders paused playlist and emits controls', async () => { const w = mount(AdminFallbackCard, { props: { fallbackPaused: true, fallbackSongs: [{ id: 1, title: 'Tema', duration_sec: 60 }] } }); expect(w.text()).toContain('Playlist pausada'); await w.findAll('.fb-toggle')[1].trigger('click'); await w.get('.q-btn-remove').trigger('click'); expect(w.emitted('toggle-fallback')).toHaveLength(1); expect(w.emitted('delete-song')[0]).toEqual([1]) }) })
