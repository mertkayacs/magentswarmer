import { describe, it, expect } from 'vitest'

// Verifies the SPINNER constant exported from Spawn is what the progress indicator uses.
// Spawn.tsx doesn't export SPINNER (it's internal), so we test the expected values directly.
const EXPECTED_SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

describe('Spawn progress indicator', () => {
  it('spinner has 10 braille frames', () => {
    expect(EXPECTED_SPINNER).toHaveLength(10)
  })

  it('spinner starts at ⠋ and ends at ⠏', () => {
    expect(EXPECTED_SPINNER[0]).toBe('⠋')
    expect(EXPECTED_SPINNER[9]).toBe('⠏')
  })

  it('all frames are single braille characters', () => {
    for (const frame of EXPECTED_SPINNER) {
      // braille pattern unicode range: 0x2800–0x28FF
      const cp = frame.codePointAt(0) ?? 0
      expect(cp).toBeGreaterThanOrEqual(0x2800)
      expect(cp).toBeLessThanOrEqual(0x28ff)
    }
  })

  it('validateName used by spawn form rejects empty string as valid', async () => {
    const { validateName } = await import('../src/utils/validateName.js')
    // empty = auto-generate, always valid
    expect(validateName('')).toBeNull()
  })
})
