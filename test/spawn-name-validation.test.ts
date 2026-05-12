import { describe, it, expect } from 'vitest'

function validateSpawnName(name: string): boolean {
  if (name.length > 30) return false
  return /^[A-Za-z0-9_-]*$/.test(name)
}

describe('Spawn name validation', () => {
  it('accepts empty string', () => {
    expect(validateSpawnName('')).toBe(true)
  })

  it('accepts alphanumeric', () => {
    expect(validateSpawnName('agent1')).toBe(true)
    expect(validateSpawnName('AgentOne')).toBe(true)
  })

  it('accepts underscore and dash', () => {
    expect(validateSpawnName('my-agent')).toBe(true)
    expect(validateSpawnName('my_agent')).toBe(true)
  })

  it('rejects spaces', () => {
    expect(validateSpawnName('my agent')).toBe(false)
  })

  it('rejects special chars', () => {
    expect(validateSpawnName('agent:1')).toBe(false)
    expect(validateSpawnName('agent.name')).toBe(false)
  })

  it('rejects length > 30', () => {
    expect(validateSpawnName('a'.repeat(31))).toBe(false)
    expect(validateSpawnName('a'.repeat(30))).toBe(true)
  })
})
