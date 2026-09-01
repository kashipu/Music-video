import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import KioskFallback from './KioskFallback.vue'

describe('KioskFallback', () => {
  it('renders waiting state and QR props', () => {
    const wrapper = mount(KioskFallback, { props: { qrCodeUrl: 'qr.png', dailyPin: '1234' } })
    expect(wrapper.text()).toContain('Esperando canciones...')
    expect(wrapper.get('img').attributes('src')).toBe('qr.png')
    expect(wrapper.text()).toContain('1234')
  })

  it('renders the paused state', () => {
    expect(mount(KioskFallback, { props: { fallbackPaused: true } }).text()).toContain('Playlist pausada')
  })
})
