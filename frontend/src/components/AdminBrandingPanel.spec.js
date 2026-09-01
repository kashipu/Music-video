import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AdminBrandingPanel from './AdminBrandingPanel.vue'
describe('AdminBrandingPanel', () => { it('renders state and emits branding controls', async () => { const w = mount(AdminBrandingPanel, { props: { showBrand: true, showQr: false, qrSize: 'M', bannerText: 'Promo', bannerActive: false } }); expect(w.text()).toContain('Ocultar'); await w.get('input').setValue('Nueva'); await w.findAll('.t-btn')[2].trigger('click'); expect(w.emitted('update:bannerText')[0]).toEqual(['Nueva']); expect(w.emitted('set-qr-size')[0]).toEqual(['S']) }) })
