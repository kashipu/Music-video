import { ref } from 'vue'
import VenueLimitsForm from './VenueLimitsForm.vue'

export default { title: 'Components/VenueLimitsForm', component: VenueLimitsForm }
export const DefaultLimits = {
  render: () => ({ components: { VenueLimitsForm }, setup: () => ({ duration: ref(600), songs: ref(3), window: ref(20) }), template: '<VenueLimitsForm v-model:max-duration-sec="duration" v-model:max-songs="songs" v-model:window-minutes="window" />' }),
}
