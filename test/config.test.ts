import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

let tmpDir: string
let cfgPath: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'reeves-config-test-'))
  cfgPath = join(tmpDir, 'config.json')
  process.env.REEVES_CONFIG = cfgPath
})

afterEach(() => {
  delete process.env.REEVES_CONFIG
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('config', () => {
  it('configExists returns false when no file', async () => {
    const { configExists } = await import('../src/state/config.js')
    expect(configExists()).toBe(false)
  })

  it('defaultConfig returns valid structure', async () => {
    const { defaultConfig } = await import('../src/state/config.js')
    const cfg = defaultConfig()
    expect(cfg.version).toBe(1)
    expect(cfg.providers.cc).toBeDefined()
    expect(cfg.providers.codex).toBeDefined()
    expect(cfg.providers.gemini).toBeDefined()
    expect(cfg.ui).toBeDefined()
  })

  it('saveConfig then loadConfig roundtrip', async () => {
    const { saveConfig, loadConfig, defaultConfig } = await import('../src/state/config.js')
    const original = defaultConfig()
    original.providers.cc.key_env = 'MY_KEY'
    saveConfig(original)
    const loaded = loadConfig()
    expect(loaded.providers.cc.key_env).toBe('MY_KEY')
  })

  it('loadConfig returns defaults when file missing', async () => {
    const { loadConfig, defaultConfig } = await import('../src/state/config.js')
    const loaded = loadConfig()
    const defaults = defaultConfig()
    expect(loaded.version).toBe(defaults.version)
    expect(loaded.providers.cc.auth).toBe(defaults.providers.cc.auth)
  })

  it('configExists returns true after save', async () => {
    const { saveConfig, defaultConfig, configExists } = await import('../src/state/config.js')
    saveConfig(defaultConfig())
    expect(configExists()).toBe(true)
  })

  it('getProvider returns correct provider', async () => {
    const { saveConfig, defaultConfig, getProvider } = await import('../src/state/config.js')
    const cfg = defaultConfig()
    cfg.providers.codex.key_env = 'OPENAI_KEY'
    saveConfig(cfg)
    const p = getProvider('codex')
    expect(p.key_env).toBe('OPENAI_KEY')
  })

  it('getProvider throws on unknown provider', async () => {
    const { getProvider } = await import('../src/state/config.js')
    expect(() => getProvider('unknown')).toThrow()
  })
})
