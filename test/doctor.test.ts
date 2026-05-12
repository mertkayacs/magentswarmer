import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'reeves-doctor-test-'))
  process.env.REEVES_REGISTRY = join(tmpDir, 'sessions')
})

afterEach(() => {
  delete process.env.REEVES_REGISTRY
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('doctor', () => {
  it('runDoctor returns result with checks array', async () => {
    const { runDoctor } = await import('../src/launcher/doctor.js')
    const result = runDoctor()
    expect(Array.isArray(result.checks)).toBe(true)
    expect(result.checks.length).toBeGreaterThan(0)
  })

  it('each check has name, status, detail', async () => {
    const { runDoctor } = await import('../src/launcher/doctor.js')
    const result = runDoctor()
    for (const check of result.checks) {
      expect(typeof check.name).toBe('string')
      expect(['ok', 'warn', 'fail']).toContain(check.status)
      expect(typeof check.detail).toBe('string')
    }
  })

  it('includes node check', async () => {
    const { runDoctor } = await import('../src/launcher/doctor.js')
    const result = runDoctor()
    const nodeCheck = result.checks.find(c => c.name === 'node')
    expect(nodeCheck).toBeDefined()
  })

  it('node check passes on node 20+', async () => {
    const { runDoctor } = await import('../src/launcher/doctor.js')
    const result = runDoctor()
    const nodeCheck = result.checks.find(c => c.name === 'node')
    expect(nodeCheck?.status).toBe('ok')
  })

  it('orphans returns array', async () => {
    const { runDoctor } = await import('../src/launcher/doctor.js')
    const result = runDoctor()
    expect(Array.isArray(result.orphans)).toBe(true)
  })

  it('pruneOrphans removes sessions from registry', async () => {
    const { pruneOrphans } = await import('../src/launcher/doctor.js')
    const { write, listAll } = await import('../src/state/registry.js')
    const session = {
      id: 'test',
      name: 'agent-test',
      parent_id: null,
      provider: 'cc' as const,
      auth: 'subscription' as const,
      base_url: null,
      model: null,
      key_ref: null,
      tag: null,
      permissions: 'skip' as const,
      effort: null,
      start_prompt: null,
      goal: null,
      tmux_session: 'reevesagents',
      tmux_window: 'agent-test',
      created_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
    }
    write(session)
    expect(listAll().length).toBe(1)
    pruneOrphans([session])
    expect(listAll().length).toBe(0)
  })
})
