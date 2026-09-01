import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AdminVolumeControl from './AdminVolumeControl.vue'

describe('AdminVolumeControl', () => {
  it('renders the volume and emits both range events', async () => {
    const wrapper = mount(AdminVolumeControl, { props: { volume: 35 } })
    expect(wrapper.text()).toContain('35%')
    await wrapper.get('.volume-slider').setValue(42)
    expect(wrapper.emitted('update:volume')[0]).toEqual([42])
    expect(wrapper.emitted('change')[0]).toEqual([42])
  })

  it('renders the muted state and emits mute toggle', async () => {
    const wrapper = mount(AdminVolumeControl, { props: { muted: true } })
    expect(wrapper.get('.volume-slider').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('MUTE')
    await wrapper.get('.mute-btn').trigger('click')
    expect(wrapper.emitted('toggle-mute')).toHaveLength(1)
  })
})
