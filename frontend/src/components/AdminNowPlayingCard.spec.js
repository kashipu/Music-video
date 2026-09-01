import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AdminNowPlayingCard from './AdminNowPlayingCard.vue'
describe('AdminNowPlayingCard', () => { it('renders empty start state and emits start', async () => { const w = mount(AdminNowPlayingCard, { props: { queueLength: 2 } }); expect(w.text()).toContain('2 canciones en cola'); await w.get('.ctrl-btn-lg').trigger('click'); expect(w.emitted('start')).toHaveLength(1) }); it('renders playing controls and emits pause', async () => { const w = mount(AdminNowPlayingCard, { props: { nowPlaying: { title: 'Tema' } } }); await w.get('.ctrl-pause').trigger('click'); expect(w.emitted('pause')).toHaveLength(1) }) })
