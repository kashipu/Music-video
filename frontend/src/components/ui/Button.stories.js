import Button from './Button.vue'

export default { title: 'UI/Button', component: Button }

export const Primary = { args: { variant: 'primary' }, render: args => ({ components: { Button }, setup: () => ({ args }), template: '<Button v-bind="args">Guardar cambios</Button>' }) }
export const AllVariants = {
  render: () => ({ components: { Button }, template: '<div style="display:grid;gap:12px;grid-template-columns:repeat(3,max-content)"><Button variant="primary">Primary</Button><Button variant="secondary">Secondary</Button><Button variant="danger">Danger</Button></div>' }),
}
