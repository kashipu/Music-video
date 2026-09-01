import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import VenueDangerZone from './VenueDangerZone.vue'

const { updateVenue } = vi.hoisted(() => ({ updateVenue: vi.fn() }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('../composables/useConfirmModal.js', () => ({ useConfirmModal: () => ({ confirm: vi.fn() }) }))
vi.mock('../services/superadmin.js', () => ({ updateVenue, deleteVenue: vi.fn() }))

describe('VenueDangerZone', () => {
  it('renders activation state and refreshes after toggling', async () => {
    const wrapper = mount(VenueDangerZone, { props: { venueId: 'v1', active: false } })
    expect(wrapper.text()).toContain('Activar bar')
    await wrapper.get('.btn-venue-toggle').trigger('click')
    expect(updateVenue).toHaveBeenCalledWith('v1', { active: true })
    expect(wrapper.emitted('refresh')).toHaveLength(1)
  })
})
