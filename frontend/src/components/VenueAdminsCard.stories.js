import VenueAdminsCard from './VenueAdminsCard.vue'

export default {
  title: 'Components/VenueAdminsCard',
  component: VenueAdminsCard,
}

export const WithAdmins = {
  args: {
    venueId: 'venue-1',
    admins: [
      { id: '1', username: 'admin1' },
      { id: '2', username: 'admin2' },
    ],
  },
}

export const Empty = {
  args: {
    venueId: 'venue-1',
    admins: [],
  },
}
