import { describe, it, expect, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ConfirmModal from './ConfirmModal.vue'
import { useConfirmModal } from '../../composables/useConfirmModal.js'

// ConfirmModal usa <Teleport to="body">: su contenido queda fuera del árbol
// del wrapper, así que se consulta directo sobre document (ver DESIGN_SYSTEM.md
// sobre trampas de Storybook/testing sin renderizado real).
describe('ConfirmModal', () => {
  let wrapper

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
  })

  it('stays hidden until confirm() is called', () => {
    wrapper = mount(ConfirmModal, { attachTo: document.body })
    expect(document.querySelector('.modal-backdrop')).toBeNull()
  })

  it('shows the title/message from confirm() and resolves true on accept', async () => {
    wrapper = mount(ConfirmModal, { attachTo: document.body })
    const { confirm } = useConfirmModal()

    const result = confirm({ title: '¿Borrar el bar?', message: 'No se puede deshacer', danger: true })
    await wrapper.vm.$nextTick()

    expect(document.querySelector('.modal-title').textContent).toBe('¿Borrar el bar?')
    expect(document.querySelector('.modal-body').textContent.trim()).toBe('No se puede deshacer')

    document.querySelectorAll('.action-btn')[1].click()
    expect(await result).toBe(true)
  })

  it('resolves false when cancelled', async () => {
    wrapper = mount(ConfirmModal, { attachTo: document.body })
    const { confirm } = useConfirmModal()

    const result = confirm({ title: '¿Salir sin guardar?' })
    await wrapper.vm.$nextTick()

    document.querySelectorAll('.action-btn')[0].click()
    expect(await result).toBe(false)
  })
})
