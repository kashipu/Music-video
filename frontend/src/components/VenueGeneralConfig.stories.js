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
  theme: {
    primary_color: '#6366f1',
    accent_color: '#818cf8',
    bg_dark: '#0f172a',
  },
}

export const Default = {
  args: {
    venueId: 'venue-1',
    venue: mockVenue,
  },
}
