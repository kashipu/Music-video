import CustomerHeader from './CustomerHeader.vue'

export default {
  title: 'Components/CustomerHeader',
  component: CustomerHeader,
  parameters: {
    layout: 'fullscreen',
  },
}

export const Default = {
  args: {
    venueName: 'Bar La Esquina',
  },
}

export const NombreLargo = {
  args: {
    venueName: 'Restaurante Bar y Parrilla La Cabaña del Abuelo Sucursal Centro',
  },
}
