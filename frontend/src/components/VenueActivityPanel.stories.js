import VenueActivityPanel from './VenueActivityPanel.vue'

export default { title: 'Components/VenueActivityPanel', component: VenueActivityPanel }
export const WeeklyActivity = { args: { bestDay: { date: '2026-08-23', people: 48 }, dailyAnalytics: { days: [{ date: '2026-08-19', people: 12 }, { date: '2026-08-20', people: 31 }, { date: '2026-08-21', people: 22 }, { date: '2026-08-23', people: 48 }] } } }
export const NoActivity = { args: { bestDay: null, dailyAnalytics: { days: [] } } }
