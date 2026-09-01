import { ref } from 'vue'
import AuthLoginForm from './AuthLoginForm.vue'

export default { title: 'Components/AuthLoginForm', component: AuthLoginForm }
export const GoogleLogin = {
  render: () => ({ components: { AuthLoginForm }, setup: () => ({ username: ref('admin'), password: ref(''), submit: () => {} }), template: '<AuthLoginForm v-model:username="username" v-model:password="password" title="Admin Repítela" subtitle="Ingresa para administrar tu bar" show-google @submit="submit"><template #footer><a href="#">¿Olvidaste tu contraseña?</a></template></AuthLoginForm>' }),
}
