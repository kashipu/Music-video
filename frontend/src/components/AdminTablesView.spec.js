import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AdminTablesView from './AdminTablesView.vue'
describe('AdminTablesView', () => { it('shows empty state', () => expect(mount(AdminTablesView).text()).toContain('Sin mesas activas')); it('renders selected table and emits controls', async () => { const table = { table_number: 4, user_name: 'Ana', user_phone: '300', songs: [{ title: 'Tema', status: 'playing', added_at: 'hoy' }] }; const w = mount(AdminTablesView, { props: { selectedTable: table } }); expect(w.text()).toContain('Tema'); await w.get('.back-btn').trigger('click'); await w.get('.t-btn-reset').trigger('click'); expect(w.emitted('back')).toHaveLength(1); expect(w.emitted('reset-limit')[0]).toEqual([4]) }) })
