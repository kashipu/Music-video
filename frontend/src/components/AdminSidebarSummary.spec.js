import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AdminSidebarSummary from './AdminSidebarSummary.vue'
describe('AdminSidebarSummary', () => { it('hides empty and renders analytics', () => { expect(mount(AdminSidebarSummary).html()).toContain('v-if'); const w = mount(AdminSidebarSummary, { props: { analytics: { summary: { total_songs_played: 4, unique_users: 2 }, top_songs: [{ youtube_id: 'a', title: 'Tema', times_played: 3 }] } } }); expect(w.text()).toContain('Tema'); expect(w.text()).toContain('4 canciones') }) })
