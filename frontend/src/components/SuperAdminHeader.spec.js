import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import SuperAdminHeader from './SuperAdminHeader.vue'
describe('SuperAdminHeader', () => { it('renders badge and emits logout', async () => { const w = mount(SuperAdminHeader, { props: { badge: 'Admin' }, global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } } }); expect(w.text()).toContain('Admin'); await w.get('.btn-logout').trigger('click'); expect(w.emitted('logout')).toHaveLength(1) }) })
