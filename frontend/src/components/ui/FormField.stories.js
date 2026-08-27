import { ref } from 'vue'
import FormField from './FormField.vue'
import Input from './Input.vue'
import Select from './Select.vue'
import PasswordInput from './PasswordInput.vue'

export default { title: 'UI/FormField', component: FormField }

export const WithHint = {
  args: { label: 'Teléfono', hint: 'Incluye el código de país.' },
  render: args => ({ components: { FormField, Input }, setup: () => ({ args, value: ref('') }), template: '<FormField v-bind="args" v-slot="{ id }"><Input :id="id" v-model="value" type="tel" placeholder="+57 300 123 4567" /></FormField>' }),
}

export const WithError = {
  args: { label: 'Correo electrónico', error: 'Ingresa un correo válido.' },
  render: args => ({ components: { FormField, Input }, setup: () => ({ args, value: ref('correo') }), template: '<FormField v-bind="args" v-slot="{ id }"><Input :id="id" v-model="value" type="email" /></FormField>' }),
}

export const Required = {
  args: { label: 'Nombre del bar', required: true },
  render: args => ({ components: { FormField, Input }, setup: () => ({ args, value: ref('') }), template: '<FormField v-bind="args" v-slot="{ id, required }"><Input :id="id" v-model="value" :required="required" /></FormField>' }),
}

export const IdExplicito = {
  args: { id: 'telefono-bar', label: 'Teléfono' },
  render: args => ({ components: { FormField, Input }, setup: () => ({ args, value: ref('') }), template: '<FormField v-bind="args" v-slot="{ id }"><Input :id="id" v-model="value" type="tel" /></FormField>' }),
}

export const WithSelect = {
  args: { label: 'Cargo' },
  render: args => ({ components: { FormField, Select }, setup: () => ({ args, value: ref('owner') }), template: '<FormField v-bind="args" v-slot="{ id }"><Select :id="id" v-model="value"><option value="owner">Dueño</option><option value="manager">Administrador</option></Select></FormField>' }),
}

export const WithPasswordInput = {
  args: { label: 'Contraseña' },
  render: args => ({ components: { FormField, PasswordInput }, setup: () => ({ args, value: ref('') }), template: '<FormField v-bind="args" v-slot="{ id }"><PasswordInput :id="id" v-model="value" /></FormField>' }),
}
