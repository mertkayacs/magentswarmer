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

describe('registry — extended', () => {
  describe('updateSession', () => {
    it('patches a single field and persists to disk', async () => {
      const { write, read, updateSession } = await import('../src/state/registry.js')
      write(makeSession('aa01'))
      updateSession('aa01', { model: 'opus' })
      expect(read('aa01').model).toBe('opus')
    })

    it('preserves fields not in the patch', async () => {
      const { write, read, updateSession } = await import('../src/state/registry.js')
      write(makeSession('aa02', { task: 'build app', task_note: 'sprint-1' }))
      updateSession('aa02', { model: 'sonnet' })
      const updated = read('aa02')
      expect(updated.task).toBe('build app')
      expect(updated.task_note).toBe('sprint-1')
    })

    it('can patch rc_enabled', async () => {
      const { write, read, updateSession } = await import('../src/state/registry.js')
      write(makeSession('aa03'))
      updateSession('aa03', { rc_enabled: true })
      expect(read('aa03').rc_enabled).toBe(true)
    })

    it('can patch ended_at to mark session complete', async () => {
      const { write, read, updateSession } = await import('../src/state/registry.js')
      write(makeSession('aa04'))
      const endTime = new Date().toISOString()
      updateSession('aa04', { ended_at: endTime })
      expect(read('aa04').ended_at).toBe(endTime)
    })

    it('can patch task_status', async () => {
      const { write, read, updateSession } = await import('../src/state/registry.js')
      write(makeSession('aa05'))
      updateSession('aa05', { task_status: 'done' })
      expect(read('aa05').task_status).toBe('done')
    })
  })

  describe('listAll', () => {
    it('returns empty array when registry dir is empty', async () => {
      const { listAll } = await import('../src/state/registry.js')
      expect(listAll()).toHaveLength(0)
    })

    it('includes sessions with ended_at set', async () => {
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

    it('returns sessions sorted newest started_at first', async () => {
      const { write, listAll } = await import('../src/state/registry.js')
      write(makeSession('ff01', { started_at: '2026-01-01T10:00:00.000Z' }))
      write(makeSession('ff02', { started_at: '2026-01-01T12:00:00.000Z' }))
      write(makeSession('ff03', { started_at: '2026-01-01T11:00:00.000Z' }))
      const ids = listAll().map(s => s.id)
      expect(ids).toEqual(['ff02', 'ff03', 'ff01'])
    })

    it('does not affect other sessions when one is updated', async () => {
      const { write, listAll, updateSession } = await import('../src/state/registry.js')
      write(makeSession('cc01'))
      write(makeSession('cc02'))
      write(makeSession('cc03'))
      updateSession('cc02', { ended_at: new Date().toISOString() })
      const all = listAll().map(s => s.id)
      expect(all).toContain('cc01')
      expect(all).toContain('cc03')
      expect(all).toContain('cc02')
      const active = listAll().filter(s => !s.ended_at).map(s => s.id)
      expect(active).not.toContain('cc02')
    })
  })
})
