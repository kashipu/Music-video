import VenueDangerZone from './VenueDangerZone.vue'

export default {
  title: 'Components/VenueDangerZone',
  component: VenueDangerZone,
}

export const Active = {
  args: {
    venueId: 'venue-1',
    active: true,
  },
}

export const Inactive = {
  args: {
    venueId: 'venue-1',
    active: false,
  },
}
