import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { Session } from '../src/state/types.js'

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'reeves-watcher-test-'))
  process.env.REEVES_REGISTRY = tmpDir
})

afterEach(async () => {
  const { stopAllWatchers } = await import('../src/launcher/watcher.js')
  stopAllWatchers()
  delete process.env.REEVES_REGISTRY
  rmSync(tmpDir, { recursive: true, force: true })
})

function makeSession(id: string): Session {
  return {
    id,
    nickname: `agent-${id}`,
    provider: 'cc',
    model: '',
    working_dir: '/tmp',
    task: 'test',
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
  }
}

describe('watcher', () => {
  it('activeWatcherCount starts at 0', async () => {
    const { activeWatcherCount } = await import('../src/launcher/watcher.js')
    expect(activeWatcherCount()).toBe(0)
  })

  it('watchSession registers a watcher', async () => {
    const { watchSession, activeWatcherCount } = await import('../src/launcher/watcher.js')
    const { write } = await import('../src/state/registry.js')
    write(makeSession('w01'))
    watchSession('w01', 1_000_000)
    expect(activeWatcherCount()).toBe(1)
  })

  it('watchSession for the same id twice only registers one watcher', async () => {
    const { watchSession, activeWatcherCount } = await import('../src/launcher/watcher.js')
    const { write } = await import('../src/state/registry.js')
    write(makeSession('w02'))
    watchSession('w02', 1_000_000)
    watchSession('w02', 1_000_000)
    expect(activeWatcherCount()).toBe(1)
  })

  it('stopWatcher removes the registered watcher', async () => {
    const { watchSession, stopWatcher, activeWatcherCount } = await import('../src/launcher/watcher.js')
    const { write } = await import('../src/state/registry.js')
    write(makeSession('w03'))
    watchSession('w03', 1_000_000)
    expect(activeWatcherCount()).toBe(1)
    stopWatcher('w03')
    expect(activeWatcherCount()).toBe(0)
  })

  it('stopWatcher on unknown id is a no-op', async () => {
    const { stopWatcher, activeWatcherCount } = await import('../src/launcher/watcher.js')
    stopWatcher('nonexistent')
    expect(activeWatcherCount()).toBe(0)
  })

  it('stopAllWatchers clears all registered watchers', async () => {
    const { watchSession, stopAllWatchers, activeWatcherCount } = await import('../src/launcher/watcher.js')
    const { write } = await import('../src/state/registry.js')
    write(makeSession('w04'))
    write(makeSession('w05'))
    watchSession('w04', 1_000_000)
    watchSession('w05', 1_000_000)
    expect(activeWatcherCount()).toBe(2)
    stopAllWatchers()
    expect(activeWatcherCount()).toBe(0)
  })

  it('multiple distinct sessions each get their own watcher', async () => {
    const { watchSession, activeWatcherCount } = await import('../src/launcher/watcher.js')
    const { write } = await import('../src/state/registry.js')
    write(makeSession('w06'))
    write(makeSession('w07'))
    write(makeSession('w08'))
    watchSession('w06', 1_000_000)
    watchSession('w07', 1_000_000)
    watchSession('w08', 1_000_000)
    expect(activeWatcherCount()).toBe(3)
  })
})
