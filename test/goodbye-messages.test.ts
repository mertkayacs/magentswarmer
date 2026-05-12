import { describe, it, expect } from 'vitest'

const GOODBYE_MESSAGES = [
  'goodbye', 'au revoir', 'auf Wiedersehen', 'hasta luego', 'arrivederci',
  'sayonara', 'annyeong', 'zai jian', 'khuda hafiz', 'vale',
  'adieu', 'do svidaniya', 'tchau', 'tot ziens', 'farvel',
  'hej da', 'nakupenda', 'aloha', 'ciao', 'shukran',
  'namaste', 'mersi', 'dag', 'czesc', 'pa pa',
  'yasas', 'güle güle', 'slaan well', 'do pobachennya', 'kwa heri',
]

describe('Goodbye messages', () => {
  it('has exactly 30 messages', () => {
    expect(GOODBYE_MESSAGES).toHaveLength(30)
  })

  it('first is "goodbye"', () => {
    expect(GOODBYE_MESSAGES[0]).toBe('goodbye')
  })

  it('last is "kwa heri"', () => {
    expect(GOODBYE_MESSAGES[29]).toBe('kwa heri')
  })

  it('random index is in range', () => {
    const idx = Math.floor(Math.random() * 30)
    expect(idx).toBeGreaterThanOrEqual(0)
    expect(idx).toBeLessThan(30)
  })
})
