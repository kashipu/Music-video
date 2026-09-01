import Card from './Card.vue'

export default {
  title: 'UI/Card',
  component: Card,
}

export const Default = {
  render: () => ({
    components: { Card },
    template: '<Card><p>Contenido dentro de la tarjeta</p></Card>',
  }),
}

export const WithTitle = {
  render: () => ({
    components: { Card },
    template: '<Card title="COLA DE CANCIONES"><p>3 canciones en espera</p></Card>',
  }),
}
