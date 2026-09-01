import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import VenueLogo from './VenueLogo.vue'
describe('VenueLogo', () => { it('hides without a source and renders fallback source', () => { expect(mount(VenueLogo).find('img').exists()).toBe(false); const w = mount(VenueLogo, { props: { src: 'logo.png' } }); expect(w.get('img').attributes('src')).toBe('logo.png') }) })
