import VenueUsersToolbar from './VenueUsersToolbar.vue'

export default {
  title: 'Components/VenueUsersToolbar',
  component: VenueUsersToolbar,
}

export const Todos = {
  args: {
    totalCount: 42,
    recurringCount: 28,
    firstTimeCount: 14,
    recurringFilter: 'all',
    search: '',
  },
}

export const Recurrentes = {
  args: {
    totalCount: 42,
    recurringCount: 28,
    firstTimeCount: 14,
    recurringFilter: 'recurring',
    search: '',
  },
}

export const ConBusqueda = {
  args: {
    totalCount: 42,
    recurringCount: 28,
    firstTimeCount: 14,
    recurringFilter: 'all',
    search: 'Carlos',
  },
}
