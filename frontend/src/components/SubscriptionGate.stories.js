import { onUnmounted } from 'vue'
import { useAuthStore } from '../stores/auth.js'
import SubscriptionGate from './SubscriptionGate.vue'

export default { title: 'Components/SubscriptionGate', component: SubscriptionGate }

export const Suspended = {
  render: () => ({
    components: { SubscriptionGate },
    setup() {
      const auth = useAuthStore()
      auth.adminToken = 'storybook-token'
      const fetchBeforeStory = window.fetch
      window.fetch = async () => new Response(JSON.stringify({ payment_status: 'suspended', monthly_price_cents: 4900000 }), { status: 200 })
      onUnmounted(() => { window.fetch = fetchBeforeStory })
    },
    template: '<SubscriptionGate />',
  }),
}
