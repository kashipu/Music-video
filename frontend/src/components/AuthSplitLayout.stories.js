import AuthSplitLayout from './AuthSplitLayout.vue'

export default { title: 'Components/AuthSplitLayout', component: AuthSplitLayout }
export const Standard = { render: () => ({ components: { AuthSplitLayout }, template: '<AuthSplitLayout><h1>Bienvenido</h1><p>Ingresa para continuar.</p></AuthSplitLayout>' }) }
export const Wide = { args: { wide: true }, render: args => ({ components: { AuthSplitLayout }, setup: () => ({ args }), template: '<AuthSplitLayout v-bind="args"><h1>Crear cuenta</h1><p>Contenido ancho de onboarding.</p></AuthSplitLayout>' }) }
