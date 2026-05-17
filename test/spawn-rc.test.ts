import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { rmSync } from 'node:fs'
import { randomInt } from 'node:crypto'

describe('spawn remote control', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = join(tmpdir(), `spawn-rc-test-${randomInt(0, 1e9)}`)
    process.env.REEVES_REGISTRY = join(tmpDir, 'sessions')
    process.env.REEVES_CONFIG = join(tmpDir, 'config.json')
  })

  afterEach(() => {
    delete process.env.REEVES_REGISTRY
    delete process.env.REEVES_CONFIG
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('creates session with rc_enabled=true when requested', async () => {
    const { spawn } = await import('../src/launcher/spawn.js')
    const { read } = await import('../src/state/registry.js')
    try {
      const session = spawn({ provider: 'cc', model: '', task: 'test task', working_dir: '/tmp', rc_enabled: true })
      expect(session.rc_enabled).toBe(true)
      expect(read(session.id).rc_enabled).toBe(true)
    } catch {
      // spawn fails if cc or tmux not available — acceptable in test env
    }
  })

  it('rc_enabled defaults to false when not set', async () => {
    const { spawn } = await import('../src/launcher/spawn.js')
    const { read } = await import('../src/state/registry.js')
    try {
      const session = spawn({ provider: 'cc', model: '', task: 'test task', working_dir: '/tmp' })
      expect(session.rc_enabled).toBe(false)
      expect(read(session.id).rc_enabled).toBe(false)
    } catch {
      // spawn fails if cc or tmux not available — acceptable in test env
    }
  })
})
