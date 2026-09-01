import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AuthSplitLayout from './AuthSplitLayout.vue'
describe('AuthSplitLayout', () => { it('renders slot and wide variant', () => { const w = mount(AuthSplitLayout, { props: { wide: true }, slots: { default: 'Acceso' } }); expect(w.text()).toContain('Acceso'); expect(w.get('.auth-card').classes()).toContain('auth-card--wide') }) })
