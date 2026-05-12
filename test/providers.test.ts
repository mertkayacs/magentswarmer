import { describe, it, expect } from 'vitest'
import { buildCommand, buildEnv } from '../src/launcher/providers.js'
import type { SpawnConfig } from '../src/state/types.js'

describe('providers', () => {
  describe('buildCommand', () => {
    it('cc with skip permissions includes --dangerously-skip-permissions', () => {
      const cfg: SpawnConfig = { provider: 'cc', auth: 'subscription', permissions: 'skip' }
      expect(buildCommand(cfg)).toContain('--dangerously-skip-permissions')
    })

    it('cc with ask permissions does not include skip flag', () => {
      const cfg: SpawnConfig = { provider: 'cc', auth: 'subscription', permissions: 'ask' }
      expect(buildCommand(cfg)).not.toContain('--dangerously-skip-permissions')
    })

    it('cc with model includes --model flag', () => {
      const cfg: SpawnConfig = { provider: 'cc', auth: 'subscription', permissions: 'ask', model: 'opus' }
      const cmd = buildCommand(cfg)
      expect(cmd).toContain('--model')
      expect(cmd).toContain('opus')
    })

    it('codex with skip permissions includes correct flag', () => {
      const cfg: SpawnConfig = { provider: 'codex', auth: 'subscription', permissions: 'skip' }
      expect(buildCommand(cfg)).toContain('--dangerously-bypass-approvals-and-sandbox')
    })

    it('codex with ask permissions does not include skip flag', () => {
      const cfg: SpawnConfig = { provider: 'codex', auth: 'subscription', permissions: 'ask' }
      expect(buildCommand(cfg)).not.toContain('--dangerously-bypass-approvals-and-sandbox')
    })

    it('gemini with skip permissions includes --yolo', () => {
      const cfg: SpawnConfig = { provider: 'gemini', auth: 'subscription', permissions: 'skip' }
      expect(buildCommand(cfg)).toContain('--yolo')
    })

    it('gemini with ask permissions does not include --yolo', () => {
      const cfg: SpawnConfig = { provider: 'gemini', auth: 'subscription', permissions: 'ask' }
      expect(buildCommand(cfg)).not.toContain('--yolo')
    })

    it('first element is the binary name', () => {
      expect(buildCommand({ provider: 'cc', auth: 'subscription', permissions: 'ask' })[0]).toBe('claude')
      expect(buildCommand({ provider: 'codex', auth: 'subscription', permissions: 'ask' })[0]).toBe('codex')
      expect(buildCommand({ provider: 'gemini', auth: 'subscription', permissions: 'ask' })[0]).toBe('gemini')
    })
  })

  describe('buildEnv', () => {
    it('subscription mode removes API key var for cc', () => {
      const env = { ANTHROPIC_API_KEY: 'sk-test', OTHER: 'val' }
      const cfg: SpawnConfig = { provider: 'cc', auth: 'subscription', permissions: 'ask' }
      const result = buildEnv(cfg, env)
      expect(result.ANTHROPIC_API_KEY).toBeUndefined()
      expect(result.OTHER).toBe('val')
    })

    it('api-key mode keeps existing env vars', () => {
      const env = { ANTHROPIC_API_KEY: 'sk-test' }
      const cfg: SpawnConfig = { provider: 'cc', auth: 'api-key', permissions: 'ask' }
      const result = buildEnv(cfg, env)
      expect(result.ANTHROPIC_API_KEY).toBe('sk-test')
    })

    it('custom mode sets base_url env var', () => {
      const env: Record<string, string> = {}
      const cfg: SpawnConfig = {
        provider: 'cc',
        auth: 'custom',
        permissions: 'ask',
        base_url: 'https://my.proxy.com',
        key_ref: 'sk-custom',
      }
      const result = buildEnv(cfg, env)
      expect(result.ANTHROPIC_BASE_URL).toBe('https://my.proxy.com')
      expect(result.ANTHROPIC_API_KEY).toBe('sk-custom')
    })

    it('custom mode resolves env: key ref', () => {
      const env = { MY_CUSTOM_KEY: 'sk-from-env' }
      const cfg: SpawnConfig = {
        provider: 'cc',
        auth: 'custom',
        permissions: 'ask',
        key_ref: 'env:MY_CUSTOM_KEY',
      }
      const result = buildEnv(cfg, env)
      expect(result.ANTHROPIC_API_KEY).toBe('sk-from-env')
    })
  })

  describe('detectAvailable', () => {
    it('returns object with cc, codex, gemini keys', async () => {
      const { detectAvailable } = await import('../src/launcher/providers.js')
      const result = detectAvailable()
      expect(typeof result.cc).toBe('boolean')
      expect(typeof result.codex).toBe('boolean')
      expect(typeof result.gemini).toBe('boolean')
    })
  })
})
