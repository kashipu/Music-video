import { ref } from 'vue'
import Select from './Select.vue'

export default { title: 'UI/Select', component: Select }

export const WithValue = {
  render: () => ({ components: { Select }, setup: () => ({ value: ref('owner') }), template: '<Select v-model="value" aria-label="Cargo"><option value="owner">Dueño</option><option value="manager">Administrador</option></Select>' }),
}
