import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import CustomerHeader from './CustomerHeader.vue'
describe('CustomerHeader', () => { it('renders venue and emits logout', async () => { const w = mount(CustomerHeader, { props: { venueName: 'Bar' } }); expect(w.text()).toContain('Bar'); await w.get('.logout-btn').trigger('click'); expect(w.emitted('logout')).toHaveLength(1) }) })
