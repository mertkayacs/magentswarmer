import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'reeves-store-test-'))
  process.env.REEVES_STATE = join(tmpDir, 'state.json')
})

afterEach(() => {
  delete process.env.REEVES_STATE
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('store', () => {
  it('defaultState returns valid AppState structure', async () => {
    const { defaultState } = await import('../src/state/store.js')
    const s = defaultState()
    expect(s.version).toBe(1)
    expect(s.last_spawn).toBeDefined()
    expect(s.last_orchestrate).toBeDefined()
    expect(Array.isArray(s.presets)).toBe(true)
    expect(Array.isArray(s.recent_sessions)).toBe(true)
    expect(s.history.spawned_total).toBe(0)
  })

  it('saveState and loadState roundtrip', async () => {
    const { defaultState, saveState, loadState } = await import('../src/state/store.js')
    const s = defaultState()
    s.last_spawn.prompt = 'test prompt'
    saveState(s)
    const loaded = loadState()
    expect(loaded.last_spawn.prompt).toBe('test prompt')
  })

  it('loadState returns defaults when file missing', async () => {
    const { loadState, defaultState } = await import('../src/state/store.js')
    const loaded = loadState()
    const defaults = defaultState()
    expect(loaded.version).toBe(defaults.version)
  })

  it('setLastSpawn updates last_spawn and increments counter', async () => {
    const { setLastSpawn, loadState } = await import('../src/state/store.js')
    setLastSpawn({ prompt: 'spawn task', tag: 'v3' })
    const s = loadState()
    expect(s.last_spawn.prompt).toBe('spawn task')
    expect(s.last_spawn.tag).toBe('v3')
    expect(s.history.spawned_total).toBe(1)
  })

  it('addRecentSession caps at 10', async () => {
    const { addRecentSession, loadState } = await import('../src/state/store.js')
    for (let i = 0; i < 15; i++) {
      addRecentSession(`session-${i}`)
    }
    const s = loadState()
    expect(s.recent_sessions.length).toBe(10)
    expect(s.recent_sessions[0]).toBe('session-14')
  })

  it('addRecentSession deduplicates', async () => {
    const { addRecentSession, loadState } = await import('../src/state/store.js')
    addRecentSession('abc')
    addRecentSession('def')
    addRecentSession('abc')
    const s = loadState()
    expect(s.recent_sessions.length).toBe(2)
    expect(s.recent_sessions[0]).toBe('abc')
  })

  it('addPreset and removePreset', async () => {
    const { addPreset, removePreset, loadState } = await import('../src/state/store.js')
    addPreset('mypreset', 'build a feature', [{ name: 'agent-1', prompt: 'do the thing' }])
    expect(loadState().presets.length).toBe(1)
    removePreset('mypreset')
    expect(loadState().presets.length).toBe(0)
  })

  it('addPreset upserts by name', async () => {
    const { addPreset, loadState } = await import('../src/state/store.js')
    addPreset('p1', 'goal1', [])
    addPreset('p1', 'goal2', [])
    expect(loadState().presets.length).toBe(1)
    expect(loadState().presets[0]?.goal).toBe('goal2')
  })
})
