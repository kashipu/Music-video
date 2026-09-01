import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AdminTablesCard from './AdminTablesCard.vue'
describe('AdminTablesCard', () => { it('shows empty state', () => expect(mount(AdminTablesCard).text()).toContain('Sin mesas activas')); it('renders a table and emits actions', async () => { const w = mount(AdminTablesCard, { props: { tables: [{ table_number: 4, user_name: 'Ana', songs: [{}], songs_pending: 1 }] } }); await w.get('.t-btn-reset').trigger('click'); await w.get('.t-btn-kick').trigger('click'); expect(w.emitted('reset-limit')[0]).toEqual([4]); expect(w.emitted('kick-table')[0]).toEqual([4]) }) })
