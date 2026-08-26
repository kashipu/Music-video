import { ref } from 'vue'
import PasswordInput from './PasswordInput.vue'

export default { title: 'UI/PasswordInput', component: PasswordInput }

export const Hidden = {
  render: () => ({ components: { PasswordInput }, setup: () => ({ value: ref('contraseña-segura') }), template: '<PasswordInput v-model="value" aria-label="Contraseña" />' }),
}
