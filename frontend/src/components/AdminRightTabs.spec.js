import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AdminRightTabs from './AdminRightTabs.vue'
describe('AdminRightTabs', () => { it('marks active tab and emits updates', async () => { const w = mount(AdminRightTabs, { props: { modelValue: 'tables' } }); expect(w.findAll('.rt')[1].classes()).toContain('active'); await w.findAll('.rt')[2].trigger('click'); expect(w.emitted('update:modelValue')[0]).toEqual(['analytics']); expect(w.emitted('change')[0]).toEqual(['analytics']) }) })
