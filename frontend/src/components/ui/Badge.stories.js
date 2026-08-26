import Badge from './Badge.vue'

export default { title: 'UI/Badge', component: Badge }

export const Status = { args: { variant: 'success' }, render: args => ({ components: { Badge }, setup: () => ({ args }), template: '<Badge v-bind="args">Al día</Badge>' }) }
export const AllVariants = {
  render: () => ({ components: { Badge }, template: '<div style="display:flex;gap:8px;flex-wrap:wrap"><Badge variant="neutral">Neutral</Badge><Badge variant="success">Success</Badge><Badge variant="warning">Warning</Badge><Badge variant="danger">Danger</Badge><Badge variant="info">Info</Badge></div>' }),
}
