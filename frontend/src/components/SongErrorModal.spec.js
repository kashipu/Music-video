import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import SongErrorModal from './SongErrorModal.vue'

describe('SongErrorModal', () => {
  it('hides without an error and dismisses an error modal', async () => {
    const empty = mount(SongErrorModal)
    expect(empty.find('.error-modal').exists()).toBe(false)
    const wrapper = mount(SongErrorModal, { props: { error: { title: 'Video bloqueado' } } })
    expect(wrapper.text()).toContain('Video bloqueado')
    await wrapper.get('.error-btn').trigger('click')
    expect(wrapper.emitted('dismiss')).toHaveLength(1)
  })
})
