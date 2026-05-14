import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { Session } from '../src/state/types.js'

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'reeves-registry-ext-'))
  process.env.REEVES_REGISTRY = tmpDir
})

afterEach(() => {
  delete process.env.REEVES_REGISTRY
  rmSync(tmpDir, { recursive: true, force: true })
})

function makeSession(id: string, overrides: Partial<Session> = {}): Session {
  return {
    id,
    name: `agent-${id}`,
    parent_id: null,
    provider: 'cc',
    auth: 'subscription',
    base_url: null,
    model: null,
    key_ref: null,
    tag: null,
    permissions: 'skip',
    effort: null,
    start_prompt: null,
    goal: null,
    tmux_session: 'reevesagents',
    tmux_window: `win-${id}`,
    created_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
    working_dir: null,
    ended_at: null,
    rc_url: null,
    ...overrides,
  }
}

describe('registry — extended', () => {
  describe('updateSession', () => {
    it('patches a single field and persists to disk', async () => {
      const { write, read, updateSession } = await import('../src/state/registry.js')
      const s = makeSession('aa01')
      write(s)
      updateSession('aa01', { model: 'opus' })
      const updated = read('aa01')
      expect(updated.model).toBe('opus')
    })

    it('preserves fields not in the patch', async () => {
      const { write, read, updateSession } = await import('../src/state/registry.js')
      const s = makeSession('aa02', { goal: 'build app', tag: 'sprint-1' })
      write(s)
      updateSession('aa02', { model: 'sonnet' })
      const updated = read('aa02')
      expect(updated.goal).toBe('build app')
      expect(updated.tag).toBe('sprint-1')
    })

    it('can patch rc_url', async () => {
      const { write, read, updateSession } = await import('../src/state/registry.js')
      const s = makeSession('aa03')
      write(s)
      updateSession('aa03', { rc_url: 'https://claude.ai/code/session/abc123' })
      const updated = read('aa03')
      expect(updated.rc_url).toBe('https://claude.ai/code/session/abc123')
    })

    it('can patch ended_at to mark session complete', async () => {
      const { write, read, updateSession } = await import('../src/state/registry.js')
      const s = makeSession('aa04')
      write(s)
      const endTime = new Date().toISOString()
      updateSession('aa04', { ended_at: endTime })
      const updated = read('aa04')
      expect(updated.ended_at).toBe(endTime)
    })
  })

  describe('remove', () => {
    it('removes an existing session file', async () => {
      const { write, listAll, remove } = await import('../src/state/registry.js')
      write(makeSession('bb01'))
      expect(listAll()).toHaveLength(1)
      remove('bb01')
      expect(listAll()).toHaveLength(0)
    })

    it('is a no-op for a non-existent session id', async () => {
      const { remove } = await import('../src/state/registry.js')
      expect(() => remove('zzzz')).not.toThrow()
    })

    it('does not affect other sessions', async () => {
      const { write, listAll, remove } = await import('../src/state/registry.js')
      write(makeSession('cc01'))
      write(makeSession('cc02'))
      write(makeSession('cc03'))
      remove('cc02')
      const remaining = listAll().map(s => s.id)
      expect(remaining).toContain('cc01')
      expect(remaining).toContain('cc03')
      expect(remaining).not.toContain('cc02')
    })
  })

  describe('listAll', () => {
    it('returns empty array when registry dir is empty', async () => {
      const { listAll } = await import('../src/state/registry.js')
      expect(listAll()).toHaveLength(0)
    })

    it('includes sessions with ended_at set (no active-only filter in listAll)', async () => {
      const { write, listAll } = await import('../src/state/registry.js')
      write(makeSession('dd01', { ended_at: new Date().toISOString() }))
      write(makeSession('dd02'))
      expect(listAll()).toHaveLength(2)
    })

    it('active-only filter: ended_at null sessions only', async () => {
      const { write, listAll } = await import('../src/state/registry.js')
      write(makeSession('ee01', { ended_at: new Date().toISOString() }))
      write(makeSession('ee02'))
      write(makeSession('ee03', { ended_at: new Date().toISOString() }))
      const active = listAll().filter(s => s.ended_at === null)
      expect(active).toHaveLength(1)
      expect(active[0]?.id).toBe('ee02')
    })

    it('returns sessions sorted newest created_at first', async () => {
      const { write, listAll } = await import('../src/state/registry.js')
      write(makeSession('ff01', { created_at: '2026-01-01T10:00:00.000Z' }))
      write(makeSession('ff02', { created_at: '2026-01-01T12:00:00.000Z' }))
      write(makeSession('ff03', { created_at: '2026-01-01T11:00:00.000Z' }))
      const ids = listAll().map(s => s.id)
      expect(ids).toEqual(['ff02', 'ff03', 'ff01'])
    })
  })
})
