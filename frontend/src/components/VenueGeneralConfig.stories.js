import VenueGeneralConfig from './VenueGeneralConfig.vue'

export default {
  title: 'Components/VenueGeneralConfig',
  component: VenueGeneralConfig,
}

const mockVenue = {
  id: 'venue-1',
  name: 'Bar Central',
  slug: 'bar-central',
  logo_url_light: '',
  logo_url_dark: '',
  qr_url: '',
  config: {
    theme: {
      preset: 'purple-night',
    },
  },
}

export const Default = {
  args: {
    venueId: 'venue-1',
    venue: mockVenue,
  },
}

