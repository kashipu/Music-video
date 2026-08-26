import ToastContainer from './ToastContainer.vue'
import { useToast } from '../composables/useToast.js'

export default { title: 'Components/ToastContainer', component: ToastContainer }
export const SuccessToast = {
  render: () => ({
    components: { ToastContainer },
    setup() {
      const toast = useToast()
      return { notify: () => toast.success('Canción agregada a la cola', 10000) }
    },
    template: '<button class="btn btn-primary" @click="notify">Mostrar toast</button><ToastContainer />',
  }),
}
