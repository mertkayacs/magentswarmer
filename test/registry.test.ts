import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
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

function makeSession(id: string): Session {
  return {
    id,
    name: `agent-${id}`,
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
    tmux_window: `agent-${id}`,
    created_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
    working_dir: null,
    ended_at: null,
    rc_url: null,
  }
}

describe('registry', () => {
  it('newId returns 4-char lowercase alphanumeric string', async () => {
    const { newId } = await import('../src/state/registry.js')
    const id = newId()
    expect(id).toMatch(/^[a-z2-9]{4}$/)
  })

  it('newId generates unique IDs', async () => {
    const { newId } = await import('../src/state/registry.js')
    const ids = new Set(Array.from({ length: 20 }, () => newId()))
    expect(ids.size).toBe(20)
  })

  it('write and read roundtrip', async () => {
    const { write, read } = await import('../src/state/registry.js')
    const session = makeSession('abcd')
    write(session)
    const loaded = read('abcd')
    expect(loaded.id).toBe('abcd')
    expect(loaded.provider).toBe('cc')
  })

  it('listAll returns all sessions sorted newest first', async () => {
    const { write, listAll } = await import('../src/state/registry.js')
    const s1 = makeSession('aaaa')
    s1.created_at = new Date(Date.now() - 5000).toISOString()
    const s2 = makeSession('bbbb')
    s2.created_at = new Date().toISOString()
    write(s1)
    write(s2)
    const all = listAll()
    expect(all.length).toBe(2)
    expect(all[0]?.id).toBe('bbbb')
    expect(all[1]?.id).toBe('aaaa')
  })

  it('remove deletes session', async () => {
    const { write, remove, listAll } = await import('../src/state/registry.js')
    write(makeSession('cccc'))
    expect(listAll().length).toBe(1)
    remove('cccc')
    expect(listAll().length).toBe(0)
  })

  it('remove is no-op for non-existent session', async () => {
    const { remove } = await import('../src/state/registry.js')
    expect(() => remove('zzzz')).not.toThrow()
  })

  it('heartbeat updates last_seen_at', async () => {
    const { write, heartbeat, read } = await import('../src/state/registry.js')
    const s = makeSession('dddd')
    s.last_seen_at = new Date(Date.now() - 10000).toISOString()
    write(s)
    heartbeat('dddd')
    const updated = read('dddd')
    expect(new Date(updated.last_seen_at).getTime()).toBeGreaterThan(new Date(s.last_seen_at).getTime())
  })

  it('isStale returns true when past threshold', async () => {
    const { isStale } = await import('../src/state/registry.js')
    const s = makeSession('eeee')
    s.last_seen_at = new Date(Date.now() - 600_000).toISOString()
    expect(isStale(s, 300)).toBe(true)
  })

  it('isStale returns false when within threshold', async () => {
    const { isStale } = await import('../src/state/registry.js')
    const s = makeSession('ffff')
    s.last_seen_at = new Date().toISOString()
    expect(isStale(s, 300)).toBe(false)
  })

  it('listAll returns empty array when registry dir missing', async () => {
    process.env.REEVES_REGISTRY = join(tmpDir, 'nonexistent')
    const { listAll } = await import('../src/state/registry.js')
    expect(listAll()).toEqual([])
  })

  it('updateSession patches a single field without disturbing others', async () => {
    const { write, updateSession, read } = await import('../src/state/registry.js')
    const session = makeSession('upd1')
    write(session)
    updateSession('upd1', { ended_at: '2026-01-01T00:00:00.000Z' })
    const loaded = read('upd1')
    expect(loaded.ended_at).toBe('2026-01-01T00:00:00.000Z')
    expect(loaded.provider).toBe('cc')
    expect(loaded.name).toBe('agent-upd1')
  })

  it('updateSession patches working_dir', async () => {
    const { write, updateSession, read } = await import('../src/state/registry.js')
    const session = makeSession('upd2')
    write(session)
    updateSession('upd2', { working_dir: '/home/user/project' })
    const loaded = read('upd2')
    expect(loaded.working_dir).toBe('/home/user/project')
  })

  it('read returns null for new Session fields when absent from file', async () => {
    const { write, read } = await import('../src/state/registry.js')
    const session = makeSession('legacy1')
    const { working_dir, ended_at, rc_url, ...legacySession } = session
    void working_dir; void ended_at; void rc_url
    write(legacySession as Session)
    const loaded = read('legacy1')
    expect(loaded.working_dir).toBeNull()
    expect(loaded.ended_at).toBeNull()
    expect(loaded.rc_url).toBeNull()
  })
})
