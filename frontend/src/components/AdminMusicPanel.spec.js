import { describe, expect, it } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import AdminMusicPanel from './AdminMusicPanel.vue'
describe('AdminMusicPanel', () => { it('passes top-level props to its sections', () => { const w = shallowMount(AdminMusicPanel, { props: { playbackBadge: { label: 'OK', cls: 'ok' }, wsState: { label: 'Conectado', cls: 'ok', dotCls: 'dot' }, queue: [{ id: 1 }], totalDuration: '2 min' }, global: { stubs: { AdminBrandingPanel: { template: '<div />' } } } }); expect(w.getComponent({ name: 'AdminStatsBar' }).props('queueCount')).toBe(1); expect(w.getComponent({ name: 'AdminQueueCard' }).props('queue')).toEqual([{ id: 1 }]) }) })
