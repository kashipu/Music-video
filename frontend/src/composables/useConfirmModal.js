import { ref } from 'vue'

const isOpen = ref(false)
const modalOptions = ref({
  title: '¿Estás seguro?',
  message: '',
  danger: false,
  confirmText: 'Confirmar',
  cancelText: 'Cancelar',
})
let resolvePromise = null

export function useConfirmModal() {
  function confirm({
    title = '¿Estás seguro?',
    message = '',
    danger = false,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
  } = {}) {
    modalOptions.value = { title, message, danger, confirmText, cancelText }
    isOpen.value = true
    return new Promise((resolve) => {
      resolvePromise = resolve
    })
  }

  function handleConfirm() {
    isOpen.value = false
    if (resolvePromise) {
      resolvePromise(true)
      resolvePromise = null
    }
  }

  function handleCancel() {
    isOpen.value = false
    if (resolvePromise) {
      resolvePromise(false)
      resolvePromise = null
    }
  }

  return {
    isOpen,
    modalOptions,
    confirm,
    handleConfirm,
    handleCancel,
  }
}
