import { describe, it, expect } from 'vitest'

describe('Goodbye messages', () => {
  it('has exactly 30 messages', async () => {
    const { GOODBYE_MESSAGES } = await import('../src/brand/goodbye.js')
    expect(GOODBYE_MESSAGES).toHaveLength(30)
  })

  it('first is "goodbye"', async () => {
    const { GOODBYE_MESSAGES } = await import('../src/brand/goodbye.js')
    expect(GOODBYE_MESSAGES[0]).toBe('goodbye')
  })

  it('last is "iki pasimatymo"', async () => {
    const { GOODBYE_MESSAGES } = await import('../src/brand/goodbye.js')
    expect(GOODBYE_MESSAGES[29]).toBe('iki pasimatymo')
  })

  it('pickGoodbye returns a non-empty string from the array', async () => {
    const { GOODBYE_MESSAGES, pickGoodbye } = await import('../src/brand/goodbye.js')
    const msg = pickGoodbye()
    expect(typeof msg).toBe('string')
    expect(msg.length).toBeGreaterThan(0)
    expect(GOODBYE_MESSAGES).toContain(msg)
  })
})
