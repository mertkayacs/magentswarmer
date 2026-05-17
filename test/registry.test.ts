import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { Session } from '../src/state/types.js'

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'reeves-registry-test-'))
  process.env.REEVES_REGISTRY = tmpDir
})

afterEach(() => {
  delete process.env.REEVES_REGISTRY
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

describe('registry', () => {
  it('write and read roundtrip', async () => {
    const { write, read } = await import('../src/state/registry.js')
    write(makeSession('abcd'))
    const loaded = read('abcd')
    expect(loaded.id).toBe('abcd')
    expect(loaded.provider).toBe('cc')
    expect(loaded.nickname).toBe('agent-abcd')
  })

  it('listAll returns all sessions', async () => {
    const { write, listAll } = await import('../src/state/registry.js')
    write(makeSession('aaaa', { started_at: new Date(Date.now() - 5000).toISOString() }))
    write(makeSession('bbbb', { started_at: new Date().toISOString() }))
    const all = listAll()
    expect(all.length).toBe(2)
  })

  it('listAll sorts newest started_at first', async () => {
    const { write, listAll } = await import('../src/state/registry.js')
    write(makeSession('aaaa', { started_at: '2026-01-01T10:00:00.000Z' }))
    write(makeSession('bbbb', { started_at: '2026-01-01T12:00:00.000Z' }))
    const all = listAll()
    expect(all[0]?.id).toBe('bbbb')
    expect(all[1]?.id).toBe('aaaa')
  })

  it('listAll returns empty array when registry dir missing', async () => {
    process.env.REEVES_REGISTRY = join(tmpDir, 'nonexistent')
    const { listAll } = await import('../src/state/registry.js')
    expect(listAll()).toEqual([])
  })

  it('updateSession patches a field without disturbing others', async () => {
    const { write, updateSession, read } = await import('../src/state/registry.js')
    write(makeSession('upd1'))
    updateSession('upd1', { ended_at: '2026-01-01T00:00:00.000Z' })
    const loaded = read('upd1')
    expect(loaded.ended_at).toBe('2026-01-01T00:00:00.000Z')
    expect(loaded.provider).toBe('cc')
    expect(loaded.nickname).toBe('agent-upd1')
  })

  it('updateSession patches working_dir', async () => {
    const { write, updateSession, read } = await import('../src/state/registry.js')
    write(makeSession('upd2'))
    updateSession('upd2', { working_dir: '/home/user/project' })
    expect(read('upd2').working_dir).toBe('/home/user/project')
  })

  it('heartbeat updates last_seen timestamp', async () => {
    const { write, heartbeat, read } = await import('../src/state/registry.js')
    const s = makeSession('dddd', { last_seen: Date.now() - 10000 })
    write(s)
    heartbeat('dddd')
    const updated = read('dddd')
    expect(updated.last_seen).toBeGreaterThan(s.last_seen)
  })

  it('computeStatus returns ended for session with ended_at', async () => {
    const { computeStatus } = await import('../src/state/registry.js')
    const s = makeSession('stat1', { ended_at: new Date().toISOString() })
    expect(computeStatus(s)).toBe('ended')
  })

  it('computeStatus returns working for recently heartbeated session', async () => {
    const { computeStatus } = await import('../src/state/registry.js')
    const s = makeSession('stat2', { last_seen: Date.now() })
    expect(computeStatus(s)).toBe('working')
  })

  it('computeStatus returns idle for stale session', async () => {
    const { computeStatus } = await import('../src/state/registry.js')
    const s = makeSession('stat3', { last_seen: Date.now() - 60_000 })
    expect(computeStatus(s)).toBe('idle')
  })

  it('write redacts api-key-shaped text in task field', async () => {
    const { write, read } = await import('../src/state/registry.js')
    write(makeSession('sec1', { task: 'leak my key sk-ant-api03-abcdefghij1234567890abcdef' }))
    expect(read('sec1').task).toContain('[REDACTED]')
    expect(read('sec1').task).not.toContain('sk-ant')
  })

  it('write redacts secrets in task_note', async () => {
    const { write, read } = await import('../src/state/registry.js')
    // pattern requires exactly 35 chars after AIza
    write(makeSession('sec2', { task_note: 'AIzaSyA1234567890abcdefghijklmnopqrstuv' }))
    expect(read('sec2').task_note).toBe('[REDACTED]')
  })

  it('write redacts secrets in inbox message text', async () => {
    const { write, read } = await import('../src/state/registry.js')
    const s = makeSession('sec3')
    s.inbox.push({
      id: 'm1', from_id: 'user', text: 'use sk-ant-api03-abcdefghij1234567890abcdef',
      sent_at: new Date().toISOString(), read: false,
    })
    write(s)
    expect(read('sec3').inbox[0]?.text).toContain('[REDACTED]')
  })

  it('withRegistryLock creates and releases a registry lock', async () => {
    const { withRegistryLock } = await import('../src/state/registry.js')
    const lockPath = join(tmpDir, '.registry.lock')
    expect(existsSync(lockPath)).toBe(false)
    withRegistryLock(() => {
      expect(existsSync(lockPath)).toBe(true)
    })
    expect(existsSync(lockPath)).toBe(false)
  })
})
