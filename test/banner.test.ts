import { describe, it, expect } from 'vitest'

describe('banner', () => {
  it('gradientChars horizontal: left and right chars have different colors', async () => {
    const { gradientChars } = await import('../src/brand/banner.js')
    const lines = gradientChars('ABCDE', ['#000000', '#ffffff'])
    expect(lines[0]).toBeDefined()
    const first = lines[0]![0]!.color
    const last = lines[0]![4]!.color
    expect(first).not.toBe(last)
  })

  it('gradientChars diagonal: top-left and bottom-right have different colors', async () => {
    const { gradientChars } = await import('../src/brand/banner.js')
    const art = 'ABC\nDEF\nGHI'
    const lines = gradientChars(art, ['#000000', '#ffffff'], 'diagonal')
    const topLeft = lines[0]![0]!.color
    const bottomRight = lines[2]![2]!.color
    expect(topLeft).not.toBe(bottomRight)
  })

  it('gradientChars diagonal: t=0 at top-left gives first stop color', async () => {
    const { gradientChars } = await import('../src/brand/banner.js')
    const art = 'AB\nCD'
    const lines = gradientChars(art, ['#000000', '#ffffff'], 'diagonal')
    // top-left: t = (0/(2-1) + 0/(2-1)) / 2 = 0 → first stop
    expect(lines[0]![0]!.color).toBe('#000000')
  })

  it('gradientChars diagonal: t=1 at bottom-right gives last stop color', async () => {
    const { gradientChars } = await import('../src/brand/banner.js')
    const art = 'AB\nCD'
    const lines = gradientChars(art, ['#000000', '#ffffff'], 'diagonal')
    // bottom-right: t = (1/(2-1) + 1/(2-1)) / 2 = 1 → last stop
    expect(lines[1]![1]!.color).toBe('#ffffff')
  })

  it('gradientChars default direction is horizontal (backward compat)', async () => {
    const { gradientChars } = await import('../src/brand/banner.js')
    const linesHoriz = gradientChars('ABCDE', ['#ff0000', '#0000ff'])
    const linesDefault = gradientChars('ABCDE', ['#ff0000', '#0000ff'], 'horizontal')
    expect(linesHoriz[0]![0]!.color).toBe(linesDefault[0]![0]!.color)
    expect(linesHoriz[0]![4]!.color).toBe(linesDefault[0]![4]!.color)
  })

  it('output line count matches input line count for single line', async () => {
    const { gradientChars } = await import('../src/brand/banner.js')
    const lines = gradientChars('HELLO', ['#ff0000', '#0000ff'])
    expect(lines.length).toBe(1)
  })

  it('output line count matches input line count for multi-line art', async () => {
    const { gradientChars } = await import('../src/brand/banner.js')
    const art = 'AAA\nBBB\nCCC\nDDD'
    const lines = gradientChars(art, ['#000000', '#ffffff'])
    expect(lines.length).toBe(4)
  })

  it('each output line has same character count as corresponding input line', async () => {
    const { gradientChars } = await import('../src/brand/banner.js')
    const art = 'HELLO\nWORLD\nABC'
    const lines = gradientChars(art, ['#ff0000', '#0000ff'])
    expect(lines[0]!.length).toBe(5)
    expect(lines[1]!.length).toBe(5)
    expect(lines[2]!.length).toBe(3)
  })

  it('single character art returns one line with one entry', async () => {
    const { gradientChars } = await import('../src/brand/banner.js')
    const lines = gradientChars('X', ['#aaaaaa', '#bbbbbb'])
    expect(lines.length).toBe(1)
    expect(lines[0]!.length).toBe(1)
  })
})
