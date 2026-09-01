import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AdminStatsBar from './AdminStatsBar.vue'
describe('AdminStatsBar', () => { it('renders all status props', () => { const w = mount(AdminStatsBar, { props: { playbackBadge: { label: 'SONANDO', cls: 'ok' }, queueCount: 2, totalDuration: '6 min', wsState: { label: 'Offline', cls: 'bad', dotCls: 'dot' } } }); expect(w.text()).toContain('SONANDO'); expect(w.text()).toContain('2 en cola'); expect(w.text()).toContain('Offline') }) })
