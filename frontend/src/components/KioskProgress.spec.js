import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import KioskProgress from './KioskProgress.vue'

describe('KioskProgress', () => {
  it('maps progress prop to the fill width', () => {
    expect(mount(KioskProgress, { props: { progress: 64 } }).get('.progress-thin-fill').attributes('style')).toContain('width: 64%')
  })
})
