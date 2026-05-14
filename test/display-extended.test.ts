import { describe, it, expect } from 'vitest'
import type { Provider } from '../src/state/types.js'

describe('providerColor — extended providers', () => {
  it('opencode returns purple hex', async () => {
    const { providerColor } = await import('../src/utils/display.js')
    expect(providerColor('opencode')).toBe('#a78bfa')
  })

  it('aider returns orange hex', async () => {
    const { providerColor } = await import('../src/utils/display.js')
    expect(providerColor('aider')).toBe('#fb923c')
  })

  it('hermes returns pink hex', async () => {
    const { providerColor } = await import('../src/utils/display.js')
    expect(providerColor('hermes')).toBe('#f472b6')
  })

  it('all six providers return distinct colors', async () => {
    const { providerColor } = await import('../src/utils/display.js')
    const providers: Provider[] = ['cc', 'codex', 'gemini', 'opencode', 'aider', 'hermes']
    const colors = providers.map(providerColor)
    const unique = new Set(colors)
    expect(unique.size).toBe(providers.length)
  })

  it('all six providers return non-empty strings', async () => {
    const { providerColor } = await import('../src/utils/display.js')
    const providers: Provider[] = ['cc', 'codex', 'gemini', 'opencode', 'aider', 'hermes']
    for (const p of providers) {
      const color = providerColor(p)
      expect(typeof color).toBe('string')
      expect(color.length).toBeGreaterThan(0)
    }
  })
})
