import { describe, it, expect } from 'vitest'

function testSupportsColor(level: number): boolean { return level >= 2 }
function testSupportsHex(level: number): boolean { return level >= 3 }

describe('Color support detection', () => {
  it('detects hex at level 3', () => { expect(testSupportsHex(3)).toBe(true) })
  it('rejects hex at level 2', () => { expect(testSupportsHex(2)).toBe(false) })
  it('detects color at level 2', () => { expect(testSupportsColor(2)).toBe(true) })
  it('rejects at level 0', () => {
    expect(testSupportsColor(0)).toBe(false)
    expect(testSupportsHex(0)).toBe(false)
  })
})
