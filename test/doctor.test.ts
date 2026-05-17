import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { Session } from '../src/state/types.js'

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'reeves-doctor-test-'))
  process.env.REEVES_REGISTRY = tmpDir
  process.env.REEVES_DOCTOR_SKIP_PROVIDER_COMPAT = '1'
})

afterEach(() => {
  delete process.env.REEVES_REGISTRY
  delete process.env.REEVES_DOCTOR_SKIP_PROVIDER_COMPAT
  rmSync(tmpDir, { recursive: true, force: true })
})

function makeSession(id: string, overrides: Partial<Session> = {}): Session {
  return {
    id,
    nickname: `agent-${id}`,
    provider: 'cc',
    model: '',
    working_dir: '/tmp',
    task: 'test task',
    task_status: 'working',
    task_note: '',
    parent_id: null,
    root_id: id,
    depth_level: 0,
    last_seen: Date.now(),
    started_at: new Date().toISOString(),
    ended_at: null,
    tmux_session: `reeves_agent-${id}_${id.slice(0, 8)}`,
    rc_enabled: false,
    inbox: [],
    ...overrides,
  }
}

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
    expect(result.checks.find(c => c.name === 'node')).toBeDefined()
  })

  it('includes platform check', async () => {
    const { runDoctor } = await import('../src/launcher/doctor.js')
    const result = runDoctor()
    expect(result.checks.find(c => c.name === 'platform')).toBeDefined()
  })

  it('reports native Windows as unsupported', async () => {
    const { platformSupportCheck } = await import('../src/launcher/doctor.js')
    const check = platformSupportCheck('win32', {}, '')
    expect(check.status).toBe('fail')
    expect(check.detail).toContain('WSL')
  })

  it('reports Linux and WSL as supported', async () => {
    const { platformSupportCheck } = await import('../src/launcher/doctor.js')
    expect(platformSupportCheck('linux', {}, 'Linux version').detail).toBe('Linux supported')
    expect(platformSupportCheck('linux', { WSL_DISTRO_NAME: 'Ubuntu' }, 'Linux version').detail).toBe('WSL supported')
    expect(platformSupportCheck('linux', {}, 'Linux version microsoft-standard-WSL2').detail).toBe('WSL supported')
  })

  it('includes provider compatibility check', async () => {
    const { runDoctor } = await import('../src/launcher/doctor.js')
    const result = runDoctor()
    expect(result.checks.find(c => c.name === 'provider compat')).toBeDefined()
  })

  it('node check passes on node 20+', async () => {
    const { runDoctor } = await import('../src/launcher/doctor.js')
    const result = runDoctor()
    expect(result.checks.find(c => c.name === 'node')?.status).toBe('ok')
  })

  it('orphans returns array', async () => {
    const { runDoctor } = await import('../src/launcher/doctor.js')
    const result = runDoctor()
    expect(Array.isArray(result.orphans)).toBe(true)
  })

  it('pruneOrphans marks sessions as ended, does not delete from registry', async () => {
    const { pruneOrphans } = await import('../src/launcher/doctor.js')
    const { write, listAll } = await import('../src/state/registry.js')
    const session = makeSession('prune01')
    write(session)
    expect(listAll()).toHaveLength(1)
    pruneOrphans([session])
    const all = listAll()
    expect(all).toHaveLength(1)
    expect(all[0]?.ended_at).not.toBeNull()
  })
})
