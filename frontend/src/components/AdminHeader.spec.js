import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AdminHeader from './AdminHeader.vue'
describe('AdminHeader', () => { it('renders venue name and emits header actions', async () => { const w = mount(AdminHeader, { props: { venueName: 'Bar' } }); expect(w.text()).toContain('Bar'); await w.get('.menu-btn').trigger('click'); await w.get('.btn-logout').trigger('click'); expect(w.emitted('toggle-sidebar')).toHaveLength(1); expect(w.emitted('logout')).toHaveLength(1) }) })
