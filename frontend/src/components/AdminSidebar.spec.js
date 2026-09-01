import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AdminSidebar from './AdminSidebar.vue'
describe('AdminSidebar', () => { it('renders stats, links and emits close', async () => { const w = mount(AdminSidebar, { props: { venueSlug: 'bar', venueName: 'Bar', activeUsers: 2, queuedCount: 3, open: true }, global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } } }); expect(w.classes()).toContain('open'); expect(w.text()).toContain('Usuarios activos'); await w.get('.sidebar-close').trigger('click'); expect(w.emitted('close')).toHaveLength(1) }) })
