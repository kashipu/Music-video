import ConfirmModal from './ConfirmModal.vue'
import { useConfirmModal } from '../../composables/useConfirmModal.js'

export default { title: 'UI/ConfirmModal', component: ConfirmModal }

export const DestructiveAction = {
  render: () => ({
    components: { ConfirmModal },
    setup() {
      const { confirm } = useConfirmModal()
      return { open: () => confirm({ title: 'Anular movimiento', message: 'Esta acción no se puede deshacer.', danger: true, confirmText: 'Anular' }) }
    },
    template: '<button class="btn btn-danger" @click="open">Abrir confirmación</button><ConfirmModal />',
  }),
}
