import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AdminPlayedCard from './AdminPlayedCard.vue'
describe('AdminPlayedCard', () => { it('shows empty state', () => expect(mount(AdminPlayedCard).text()).toContain('Sin historial de hoy')); it('renders and emits played actions', async () => { const w = mount(AdminPlayedCard, { props: { played: [{ id: 1, youtube_id: 'abc', title: 'Tema', user_name: 'Ana' }] } }); await w.get('.q-btn-requeue').trigger('click'); await w.get('.q-btn-fallback').trigger('click'); expect(w.emitted('requeue-song')[0]).toEqual(['abc']); expect(w.emitted('add-to-fallback')[0]).toEqual(['abc']) }) })
