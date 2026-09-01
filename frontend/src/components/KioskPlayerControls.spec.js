import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import KioskPlayerControls from './KioskPlayerControls.vue'

const props = { isPlaying: true, progress: 50, currentTime: 60, duration: 120, controlsVisible: true }

describe('KioskPlayerControls', () => {
  it('renders progress, times and visible controls', () => {
    const wrapper = mount(KioskPlayerControls, { props })
    expect(wrapper.get('.progress-thin-fill').attributes('style')).toContain('width: 50%')
    expect(wrapper.text()).toContain('1:00')
    expect(wrapper.text()).toContain('2:00')
  })

  it('emits playback and relative seek actions', async () => {
    const wrapper = mount(KioskPlayerControls, { props })
    await wrapper.get('.center-playpause').trigger('click')
    await wrapper.get('.kc-btn').trigger('click')
    await wrapper.findAll('.kc-btn')[2].trigger('click')
    expect(wrapper.emitted('toggle-play-pause')).toHaveLength(1)
    expect(wrapper.emitted('seek-relative')).toEqual([[-10], [10]])
  })

  it('hides the center control while playing until controls are visible', () => {
    const wrapper = mount(KioskPlayerControls, { props: { ...props, controlsVisible: false } })
    expect(wrapper.find('.center-playpause').exists()).toBe(false)
  })
})
