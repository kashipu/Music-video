import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('AuthLoginForm', () => {
  const componentPath = path.resolve(process.cwd(), 'src/components/AuthLoginForm.vue')
  const content = fs.readFileSync(componentPath, 'utf8')

  it('imports VenueLogo', () => {
    expect(content).toMatch(/import VenueLogo from '\.\/VenueLogo\.vue'/)
  })

  it('uses VenueLogo for bar logoUrl', () => {
    expect(content).toMatch(/<VenueLogo[\s\S]*?:src="logoUrl"/)
  })

  it('preserves login-icon venue-logo classes on VenueLogo', () => {
    expect(content).toContain('class="login-icon venue-logo"')
  })

  it('keeps default brand logo intact', () => {
    expect(content).toContain("import RepitelaLogo from './RepitelaLogo.vue'")
    expect(content).toContain('<RepitelaLogo v-else class="login-icon" />')
  })
})
