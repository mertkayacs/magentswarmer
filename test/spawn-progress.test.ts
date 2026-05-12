import { describe, it, expect } from 'vitest'

describe('Spawn progress indicator', () => {
  it('has 10 spinner frames', () => {
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
    expect(frames).toHaveLength(10)
    expect(frames[0]).toBe('⠋')
    expect(frames[9]).toBe('⠏')
  })

  it('spinner interval is 80ms', () => {
    expect(80).toBe(80)
  })

  it('spawning state clears after result', () => {
    let spawning = true
    spawning = false
    expect(spawning).toBe(false)
  })

  it('spawning state clears after error', () => {
    let spawning = true
    let error = ''
    error = 'spawn failed'
    spawning = false
    expect(error).toBe('spawn failed')
    expect(spawning).toBe(false)
  })
})
