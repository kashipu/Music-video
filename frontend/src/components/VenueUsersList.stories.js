import VenueUsersList from './VenueUsersList.vue'

export default {
  title: 'Components/VenueUsersList',
  component: VenueUsersList,
}

const sampleUsers = [
  {
    id: 1,
    display_name: 'Carlos Mendoza',
    phone: '+57 300 123 4567',
    last_connection: '2026-08-27 10:30:00',
    first_seen_at_venue: '2026-08-01 20:00:00',
    songs_count: 8,
    is_recurring: true,
    data_consent: true,
  },
  {
    id: 2,
    display_name: 'Andrea Gómez',
    phone: '+57 311 987 6543',
    last_connection: '2026-08-26 22:15:00',
    first_seen_at_venue: '2026-08-26 21:00:00',
    songs_count: 2,
    is_recurring: false,
    data_consent: true,
  },
  {
    id: 3,
    display_name: '',
    phone: '+57 320 555 1234',
    last_connection: '2026-08-20 19:40:00',
    first_seen_at_venue: '2026-07-15 18:00:00',
    songs_count: 5,
    is_recurring: true,
    data_consent: false,
  },
]

export const ConUsuarios = {
  args: {
    users: sampleUsers,
  },
}
