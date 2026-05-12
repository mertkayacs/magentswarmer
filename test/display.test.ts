import { describe, it, expect } from 'vitest'
import type { Provider } from '../src/state/types.js'

function msAgo(ms: number): string {
  return new Date(Date.now() - ms).toISOString()
}

describe('display utilities', () => {
  describe('providerColor', () => {
    it('cc returns blue hex', async () => {
      const { providerColor } = await import('../src/utils/display.js')
      expect(providerColor('cc')).toBe('#5a96e0')
    })

    it('codex returns green hex', async () => {
      const { providerColor } = await import('../src/utils/display.js')
      expect(providerColor('codex')).toBe('#4ade80')
    })

    it('gemini returns yellow hex', async () => {
      const { providerColor } = await import('../src/utils/display.js')
      expect(providerColor('gemini')).toBe('#facc15')
    })

    it('unknown provider returns fallback gray', async () => {
      const { providerColor } = await import('../src/utils/display.js')
      expect(providerColor('unknown' as unknown as Provider)).toBe('gray')
    })

    it('always returns a non-empty string', async () => {
      const { providerColor } = await import('../src/utils/display.js')
      const providers: Provider[] = ['cc', 'codex', 'gemini']
      for (const p of providers) {
        expect(providerColor(p).length).toBeGreaterThan(0)
      }
    })
  })

  describe('formatAge', () => {
    it('returns seconds for durations under 60s', async () => {
      const { formatAge } = await import('../src/utils/display.js')
      expect(formatAge(msAgo(30_000))).toBe('30s')
    })

    it('returns 59s at the second boundary', async () => {
      const { formatAge } = await import('../src/utils/display.js')
      expect(formatAge(msAgo(59_000))).toBe('59s')
    })

    it('returns 1m at exactly 60s', async () => {
      const { formatAge } = await import('../src/utils/display.js')
      expect(formatAge(msAgo(60_000))).toBe('1m')
    })

    it('returns minutes for durations under 60m', async () => {
      const { formatAge } = await import('../src/utils/display.js')
      expect(formatAge(msAgo(2 * 60_000))).toBe('2m')
      expect(formatAge(msAgo(30 * 60_000))).toBe('30m')
    })

    it('returns 1h at exactly 3600s', async () => {
      const { formatAge } = await import('../src/utils/display.js')
      expect(formatAge(msAgo(3_600_000))).toBe('1h')
    })

    it('returns hours for durations under 24h', async () => {
      const { formatAge } = await import('../src/utils/display.js')
      expect(formatAge(msAgo(2 * 3_600_000))).toBe('2h')
      expect(formatAge(msAgo(12 * 3_600_000))).toBe('12h')
    })

    it('returns 1d at exactly 24h', async () => {
      const { formatAge } = await import('../src/utils/display.js')
      expect(formatAge(msAgo(86_400_000))).toBe('1d')
    })

    it('returns days for durations 24h+', async () => {
      const { formatAge } = await import('../src/utils/display.js')
      expect(formatAge(msAgo(2 * 86_400_000))).toBe('2d')
      expect(formatAge(msAgo(7 * 86_400_000))).toBe('7d')
    })

    it('returns negative seconds for future timestamps (no clamping)', async () => {
      const { formatAge } = await import('../src/utils/display.js')
      const future = new Date(Date.now() + 5_000).toISOString()
      // formatAge does not clamp; future dates produce a negative suffix
      expect(formatAge(future)).toMatch(/^-\d+s$/)
    })
  })

  describe('formatDuration', () => {
    it('seconds only when under 60s', async () => {
      const { formatDuration } = await import('../src/utils/display.js')
      const start = '2026-01-01T00:00:00.000Z'
      const end   = '2026-01-01T00:00:42.000Z'
      expect(formatDuration(start, end)).toBe('42s')
    })

    it('minutes and seconds when under 1h', async () => {
      const { formatDuration } = await import('../src/utils/display.js')
      const start = '2026-01-01T00:00:00.000Z'
      const end   = '2026-01-01T00:23:05.000Z'
      expect(formatDuration(start, end)).toBe('23m 5s')
    })

    it('hours and minutes when 1h or more', async () => {
      const { formatDuration } = await import('../src/utils/display.js')
      const start = '2026-01-01T00:00:00.000Z'
      const end   = '2026-01-01T03:45:00.000Z'
      expect(formatDuration(start, end)).toBe('3h 45m')
    })

    it('zero seconds returns 0s', async () => {
      const { formatDuration } = await import('../src/utils/display.js')
      const ts = '2026-01-01T00:00:00.000Z'
      expect(formatDuration(ts, ts)).toBe('0s')
    })
  })
})
