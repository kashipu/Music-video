import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { useToast } from '../composables/useToast.js'
import ToastContainer from './ToastContainer.vue'

describe('ToastContainer', () => {
  it('renders and dismisses shared toasts', async () => {
    const toast = useToast()
    toast.toasts.value = []
    const id = toast.success('Guardado', 10000)
    const wrapper = mount(ToastContainer, { attachTo: document.body })
    await flushPromises()
    expect(document.body.textContent).toContain('Guardado')
    document.querySelector('.toast-x').click()
    expect(toast.toasts.value.find(item => item.id === id)).toBeUndefined()
    wrapper.unmount()
  })
})
