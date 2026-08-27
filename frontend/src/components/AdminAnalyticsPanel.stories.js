import AdminAnalyticsPanel from './AdminAnalyticsPanel.vue'
export default { title: 'Components/AdminAnalyticsPanel', component: AdminAnalyticsPanel }
export const Loading = { args: { analytics: null, analyticsPeriod: 'week', fallbackYoutubeIds: new Set(), loadingAddToFallback: {} } }
