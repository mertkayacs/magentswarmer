import { describe, it, expect } from 'vitest'
import { buildCommand, helpCommand, missingHelpFeatures } from '../src/launcher/providers.js'
import type { BuildCommandOptions } from '../src/launcher/providers.js'

describe('providers', () => {
  describe('buildCommand', () => {
    it('cc with skip permissions includes --dangerously-skip-permissions', () => {
      const opts: BuildCommandOptions = { provider: 'cc', permissions: 'skip', model: '' }
      expect(buildCommand(opts)).toContain('--dangerously-skip-permissions')
    })

    it('cc with ask permissions does not include skip flag', () => {
      const opts: BuildCommandOptions = { provider: 'cc', permissions: 'ask', model: '' }
      expect(buildCommand(opts)).not.toContain('--dangerously-skip-permissions')
    })

    it('cc with model includes --model flag', () => {
      const opts: BuildCommandOptions = { provider: 'cc', permissions: 'ask', model: 'opus' }
      const cmd = buildCommand(opts)
      expect(cmd).toContain('--model')
      expect(cmd).toContain('opus')
    })

    it('cc with api-key auth includes --bare', () => {
      const opts: BuildCommandOptions = { provider: 'cc', permissions: 'ask', model: '', auth_mode: 'api-key' }
      expect(buildCommand(opts)).toContain('--bare')
    })

    it('cc with effort includes --effort', () => {
      const opts: BuildCommandOptions = { provider: 'cc', permissions: 'ask', model: '', effort: 'high' }
      const cmd = buildCommand(opts)
      expect(cmd).toContain('--effort')
      expect(cmd).toContain('high')
    })

    it('codex with skip permissions includes correct flag', () => {
      const opts: BuildCommandOptions = { provider: 'codex', permissions: 'skip', model: '' }
      expect(buildCommand(opts)).toContain('--dangerously-bypass-approvals-and-sandbox')
    })

    it('codex with ask permissions does not include skip flag', () => {
      const opts: BuildCommandOptions = { provider: 'codex', permissions: 'ask', model: '' }
      expect(buildCommand(opts)).not.toContain('--dangerously-bypass-approvals-and-sandbox')
    })

    it('codex with rc_enabled includes --enable remote_control', () => {
      const opts: BuildCommandOptions = { provider: 'codex', permissions: 'ask', model: '', rc_enabled: true }
      const cmd = buildCommand(opts)
      expect(cmd).toContain('--enable')
      expect(cmd).toContain('remote_control')
    })

    it('gemini with skip permissions includes --yolo and --skip-trust', () => {
      const opts: BuildCommandOptions = { provider: 'gemini', permissions: 'skip', model: '' }
      const cmd = buildCommand(opts)
      expect(cmd).toContain('--yolo')
      expect(cmd).toContain('--skip-trust')
    })

    it('gemini with ask permissions does not include skip flags', () => {
      const opts: BuildCommandOptions = { provider: 'gemini', permissions: 'ask', model: '' }
      const cmd = buildCommand(opts)
      expect(cmd).not.toContain('--yolo')
      expect(cmd).not.toContain('--skip-trust')
    })

    it('first element is the binary name', () => {
      expect(buildCommand({ provider: 'cc', permissions: 'ask', model: '' })[0]).toBe('claude')
      expect(buildCommand({ provider: 'codex', permissions: 'ask', model: '' })[0]).toBe('codex')
      expect(buildCommand({ provider: 'gemini', permissions: 'ask', model: '' })[0]).toBe('gemini')
      expect(buildCommand({ provider: 'hermes', permissions: 'ask', model: '' })[0]).toBe('hermes')
    })

    it('always returns an array for all providers', () => {
      const providers = ['cc', 'codex', 'gemini', 'hermes'] as const
      for (const provider of providers) {
        const cmd = buildCommand({ provider, permissions: 'ask', model: '' })
        expect(Array.isArray(cmd)).toBe(true)
        expect(cmd.length).toBeGreaterThan(0)
        expect(typeof cmd[0]).toBe('string')
      }
    })

    it('every element is a string', () => {
      const cmd = buildCommand({ provider: 'cc', permissions: 'skip', model: 'opus' })
      for (const arg of cmd) {
        expect(typeof arg).toBe('string')
      }
    })

    it('rejects unsupported providers', () => {
      expect(() => buildCommand({ provider: 'unknown' as never, permissions: 'ask', model: '' })).toThrow(/Unsupported provider/)
    })
  })

  describe('detectAvailable', () => {
    it('returns object with supported provider keys', async () => {
      const { detectAvailable } = await import('../src/launcher/providers.js')
      const result = detectAvailable()
      expect(typeof result.cc).toBe('boolean')
      expect(typeof result.codex).toBe('boolean')
      expect(typeof result.gemini).toBe('boolean')
      expect(typeof result.hermes).toBe('boolean')
      expect(Object.keys(result)).toEqual(['cc', 'codex', 'gemini', 'hermes'])
    })
  })

  describe('provider compatibility helpers', () => {
    it('uses hermes chat --help for compatibility inspection', () => {
      expect(helpCommand('hermes')).toEqual(['hermes', 'chat', '--help'])
      expect(helpCommand('gemini')).toEqual(['gemini', '--help'])
    })

    it('detects missing gemini trust bypass support', () => {
      expect(missingHelpFeatures('gemini', 'Usage: gemini --yolo')).toEqual(['skip permissions'])
      expect(missingHelpFeatures('gemini', 'Usage: gemini --yolo --skip-trust')).toEqual([])
    })

    it('detects missing hermes chat support details', () => {
      expect(missingHelpFeatures('hermes', 'usage: hermes chat --model x')).toEqual(['skip permissions'])
      expect(missingHelpFeatures('hermes', 'usage: hermes chat --model x --yolo')).toEqual([])
    })
  })
})
