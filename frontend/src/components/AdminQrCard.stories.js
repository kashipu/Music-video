import AdminQrCard from './AdminQrCard.vue'

export default {
  title: 'Admin/AdminQrCard',
  component: AdminQrCard,
  tags: ['autodocs'],
  argTypes: {
    venueSlug: { control: 'text' },
    venueName: { control: 'text' },
    qrCodeUrl: { control: 'text' },
    registroUrl: { control: 'text' },
    onDownload: { action: 'download' },
    onPrint: { action: 'print' },
  },
}

export const PorDefecto = {
  args: {
    venueSlug: 'la-paz',
    venueName: 'La Paz Bar',
    qrCodeUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=https%3A%2F%2Flapaz.bar%2Fregistro',
    registroUrl: 'https://lapaz.bar/registro',
  },
}

export const SinNombreLocal = {
  args: {
    venueSlug: 'demo-venue',
    venueName: '',
    qrCodeUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=https%3A%2F%2Frepitela.com%2Fdemo-venue%2Fregistro',
    registroUrl: 'https://repitela.com/demo-venue/registro',
  },
}
