import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import VenueAdminsCard from './VenueAdminsCard.vue'

const { addVenueAdmin, removeVenueAdmin } = vi.hoisted(() => ({ addVenueAdmin: vi.fn(), removeVenueAdmin: vi.fn() }))
vi.mock('../services/superadmin.js', () => ({ addVenueAdmin, removeVenueAdmin }))

describe('VenueAdminsCard', () => {
  it('renders empty state', () => {
    expect(mount(VenueAdminsCard, { props: { venueId: 'v1' } }).text()).toContain('Sin administradores asignados')
  })

  it('adds and removes admins then emits refresh', async () => {
    addVenueAdmin.mockResolvedValue({ ok: true })
    removeVenueAdmin.mockResolvedValue({ ok: true })
    const wrapper = mount(VenueAdminsCard, { props: { venueId: 'v1', admins: [{ id: 7, username: 'ana' }] } })
    await wrapper.get('[aria-label="Usuario nuevo administrador"]').setValue('luis')
    await wrapper.get('[aria-label="Contraseña nuevo administrador"]').setValue('clave')
    await wrapper.get('.add-btn').trigger('click')
    await wrapper.get('[aria-label="Quitar administrador ana"]').trigger('click')
    expect(addVenueAdmin).toHaveBeenCalledWith('v1', { username: 'luis', password: 'clave' })
    expect(removeVenueAdmin).toHaveBeenCalledWith('v1', 7)
    expect(wrapper.emitted('refresh')).toHaveLength(2)
  })
})
