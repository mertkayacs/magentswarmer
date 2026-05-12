import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { rmSync } from 'node:fs'
import { randomInt } from 'node:crypto'

describe('config global fields', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = join(tmpdir(), `config-global-test-${randomInt(0, 1e9)}`)
    process.env.REEVES_CONFIG = join(tmpDir, 'config.json')
  })

  afterEach(() => {
    delete process.env.REEVES_CONFIG
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('loads global defaults when config missing', async () => {
    const { loadConfig } = await import('../src/state/config.js')
    const cfg = loadConfig()
    expect(cfg.global.tmux_session_name).toBe('reevesagents')
    expect(cfg.global.peek_interval_seconds).toBe(5)
  })

  it('preserves global config on save', async () => {
    const { loadConfig, saveConfig } = await import('../src/state/config.js')
    const cfg = loadConfig()
    cfg.global.tmux_session_name = 'custom-session'
    cfg.global.peek_interval_seconds = 10
    saveConfig(cfg)
    const reloaded = loadConfig()
    expect(reloaded.global.tmux_session_name).toBe('custom-session')
    expect(reloaded.global.peek_interval_seconds).toBe(10)
  })
})
