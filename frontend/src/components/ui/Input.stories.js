import { ref } from 'vue'
import Input from './Input.vue'

export default { title: 'UI/Input', component: Input }

export const WithValue = {
  render: () => ({ components: { Input }, setup: () => ({ value: ref('admin@repitela.co') }), template: '<Input v-model="value" type="email" aria-label="Correo" />' }),
}
