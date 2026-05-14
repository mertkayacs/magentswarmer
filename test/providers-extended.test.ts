import { describe, it, expect } from 'vitest'
import { buildCommand, buildEnv } from '../src/launcher/providers.js'
import type { SpawnConfig } from '../src/state/types.js'

describe('buildCommand — extended providers', () => {
  describe('opencode', () => {
    it('binary is opencode', () => {
      const cfg: SpawnConfig = { provider: 'opencode', auth: 'subscription', permissions: 'ask' }
      expect(buildCommand(cfg)[0]).toBe('opencode')
    })

    it('includes --model when set', () => {
      const cfg: SpawnConfig = { provider: 'opencode', auth: 'subscription', permissions: 'ask', model: 'gpt-4o' }
      const cmd = buildCommand(cfg)
      expect(cmd).toContain('--model')
      expect(cmd).toContain('gpt-4o')
    })

    it('skip permissions does not add any flag (no documented skip flag)', () => {
      const cfg: SpawnConfig = { provider: 'opencode', auth: 'subscription', permissions: 'skip' }
      const cmd = buildCommand(cfg)
      // opencode has no permissions-skip flag — only the binary name expected when no model
      expect(cmd).toEqual(['opencode'])
    })

    it('effort is not passed (unsupported for opencode)', () => {
      const cfg: SpawnConfig = { provider: 'opencode', auth: 'subscription', permissions: 'ask', effort: 'high' }
      const cmd = buildCommand(cfg)
      expect(cmd).not.toContain('--effort')
      expect(cmd).not.toContain('high')
    })
  })

  describe('aider', () => {
    it('binary is aider', () => {
      const cfg: SpawnConfig = { provider: 'aider', auth: 'subscription', permissions: 'ask' }
      expect(buildCommand(cfg)[0]).toBe('aider')
    })

    it('skip permissions adds --yes', () => {
      const cfg: SpawnConfig = { provider: 'aider', auth: 'subscription', permissions: 'skip' }
      expect(buildCommand(cfg)).toContain('--yes')
    })

    it('ask permissions does not include --yes', () => {
      const cfg: SpawnConfig = { provider: 'aider', auth: 'subscription', permissions: 'ask' }
      expect(buildCommand(cfg)).not.toContain('--yes')
    })

    it('includes --model when set', () => {
      const cfg: SpawnConfig = { provider: 'aider', auth: 'subscription', permissions: 'ask', model: 'claude-3-5-sonnet' }
      const cmd = buildCommand(cfg)
      expect(cmd).toContain('--model')
      expect(cmd).toContain('claude-3-5-sonnet')
    })

    it('effort is not passed (unsupported for aider)', () => {
      const cfg: SpawnConfig = { provider: 'aider', auth: 'subscription', permissions: 'ask', effort: 'low' }
      const cmd = buildCommand(cfg)
      expect(cmd).not.toContain('--effort')
      expect(cmd).not.toContain('low')
    })
  })

  describe('hermes', () => {
    it('binary is hermes', () => {
      const cfg: SpawnConfig = { provider: 'hermes', auth: 'subscription', permissions: 'ask' }
      expect(buildCommand(cfg)[0]).toBe('hermes')
    })

    it('includes --model when set', () => {
      const cfg: SpawnConfig = { provider: 'hermes', auth: 'subscription', permissions: 'ask', model: 'claude-opus-4' }
      const cmd = buildCommand(cfg)
      expect(cmd).toContain('--model')
      expect(cmd).toContain('claude-opus-4')
    })

    it('skip permissions does not add any flag (no documented skip flag)', () => {
      const cfg: SpawnConfig = { provider: 'hermes', auth: 'subscription', permissions: 'skip' }
      expect(buildCommand(cfg)).toEqual(['hermes'])
    })

    it('effort is not passed (unsupported for hermes)', () => {
      const cfg: SpawnConfig = { provider: 'hermes', auth: 'subscription', permissions: 'ask', effort: 'medium' }
      const cmd = buildCommand(cfg)
      expect(cmd).not.toContain('--effort')
    })
  })
})

describe('buildEnv — extended cases', () => {
  it('gemini subscription removes both GEMINI_API_KEY and GOOGLE_API_KEY', () => {
    const env: Record<string, string> = {
      GEMINI_API_KEY: 'gkey',
      GOOGLE_API_KEY: 'goog',
      OTHER: 'keep',
    }
    const cfg: SpawnConfig = { provider: 'gemini', auth: 'subscription', permissions: 'ask' }
    const result = buildEnv(cfg, env)
    expect(result.GEMINI_API_KEY).toBeUndefined()
    expect(result.GOOGLE_API_KEY).toBeUndefined()
    expect(result.OTHER).toBe('keep')
  })

  it('opencode subscription leaves env untouched', () => {
    const env: Record<string, string> = { OPENAI_API_KEY: 'sk-x', SOME_VAR: 'val' }
    const cfg: SpawnConfig = { provider: 'opencode', auth: 'subscription', permissions: 'ask' }
    const result = buildEnv(cfg, env)
    expect(result.OPENAI_API_KEY).toBe('sk-x')
    expect(result.SOME_VAR).toBe('val')
  })

  it('hermes subscription leaves env untouched', () => {
    const env: Record<string, string> = { ANTHROPIC_API_KEY: 'sk-h', FOO: 'bar' }
    const cfg: SpawnConfig = { provider: 'hermes', auth: 'subscription', permissions: 'ask' }
    const result = buildEnv(cfg, env)
    expect(result.ANTHROPIC_API_KEY).toBe('sk-h')
    expect(result.FOO).toBe('bar')
  })

  it('aider subscription leaves env untouched', () => {
    const env: Record<string, string> = { ANTHROPIC_API_KEY: 'sk-a' }
    const cfg: SpawnConfig = { provider: 'aider', auth: 'subscription', permissions: 'ask' }
    const result = buildEnv(cfg, env)
    expect(result.ANTHROPIC_API_KEY).toBe('sk-a')
  })

  it('custom auth env: prefix resolves key from environment for opencode', () => {
    const env: Record<string, string> = { MY_OAI_KEY: 'sk-openai-xyz' }
    const cfg: SpawnConfig = {
      provider: 'opencode',
      auth: 'custom',
      permissions: 'ask',
      key_ref: 'env:MY_OAI_KEY',
    }
    const result = buildEnv(cfg, env)
    expect(result.OPENAI_API_KEY).toBe('sk-openai-xyz')
  })

  it('custom auth resolves base_url for hermes', () => {
    const cfg: SpawnConfig = {
      provider: 'hermes',
      auth: 'custom',
      permissions: 'ask',
      base_url: 'https://custom.hermes.endpoint',
      key_ref: 'sk-custom',
    }
    const result = buildEnv(cfg, {})
    expect(result.ANTHROPIC_BASE_URL).toBe('https://custom.hermes.endpoint')
    expect(result.ANTHROPIC_API_KEY).toBe('sk-custom')
  })
})
