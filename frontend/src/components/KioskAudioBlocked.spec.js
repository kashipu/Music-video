import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import KioskAudioBlocked from './KioskAudioBlocked.vue'

describe('KioskAudioBlocked', () => {
  it('explains the block and emits unlock from its button', async () => {
    const wrapper = mount(KioskAudioBlocked)
    expect(wrapper.text()).toContain('El navegador bloqueo el audio')
    await wrapper.get('.audio-blocked-btn').trigger('click')
    expect(wrapper.emitted('unlock')).toHaveLength(1)
  })
})
