import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AdminQrCard from './AdminQrCard.vue'
describe('AdminQrCard', () => { it('renders QR props and emits actions', async () => { const w = mount(AdminQrCard, { props: { venueSlug: 'bar', venueName: 'Bar', qrCodeUrl: 'qr.png', registroUrl: 'url' } }); expect(w.get('img').attributes('src')).toBe('qr.png'); await w.findAll('.qr-btn')[0].trigger('click'); await w.findAll('.qr-btn')[1].trigger('click'); expect(w.emitted('download')).toHaveLength(1); expect(w.emitted('print')).toHaveLength(1) }) })
