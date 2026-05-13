import { describe, it, expect } from 'vitest'

describe('Spawn name validation', () => {
  it('accepts empty string (auto-generate)', async () => {
    const { validateName } = await import('../src/utils/validateName.js')
    expect(validateName('')).toBeNull()
  })

  it('accepts alphanumeric', async () => {
    const { validateName } = await import('../src/utils/validateName.js')
    expect(validateName('agent1')).toBeNull()
    expect(validateName('AgentOne')).toBeNull()
  })

  it('accepts underscore and dash', async () => {
    const { validateName } = await import('../src/utils/validateName.js')
    expect(validateName('my-agent')).toBeNull()
    expect(validateName('my_agent')).toBeNull()
  })

  it('rejects spaces', async () => {
    const { validateName } = await import('../src/utils/validateName.js')
    expect(validateName('my agent')).not.toBeNull()
  })

  it('rejects special chars', async () => {
    const { validateName } = await import('../src/utils/validateName.js')
    expect(validateName('agent:1')).not.toBeNull()
    expect(validateName('agent.name')).not.toBeNull()
  })

  it('rejects length > 30', async () => {
    const { validateName } = await import('../src/utils/validateName.js')
    expect(validateName('a'.repeat(31))).not.toBeNull()
    expect(validateName('a'.repeat(30))).toBeNull()
  })
})
